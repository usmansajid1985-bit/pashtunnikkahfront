import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  activateGoldFromCheckout,
  activateTopupFromCheckout,
  applyGoldRenewal,
  downgradeFromGold,
  getStripe,
  markPaymentPastDue,
  TOPUP_AMOUNT_PENCE,
} from "@/lib/stripe";
import { ensureP1Schema } from "@/lib/ensure-p1-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (secret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, secret);
    } else {
      // Local/dev without whsec — parse JSON (do not use in production).
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("webhook verify", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await ensureP1Schema();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userIdRaw = session.metadata?.userId || session.client_reference_id;
        if (!userIdRaw) break;
        if (session.metadata?.checkoutType === "topup") {
          await activateTopupFromCheckout({
            userId: BigInt(userIdRaw),
            sessionId: session.id,
            amountPence: session.amount_total ?? TOPUP_AMOUNT_PENCE,
          });
          break;
        }
        const sub =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        const customer =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        await activateGoldFromCheckout({
          userId: BigInt(userIdRaw),
          sessionId: session.id,
          customerId: customer,
          subscriptionId: sub,
          amountPence: session.amount_total ?? 1000,
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subId) break;
        const user = await prisma.users.findFirst({
          where: { stripe_subscription_id: subId },
        });
        if (!user) break;
        await prisma.users.update({
          where: { id: user.id },
          data: { plan: "gold", subscription_status: "active", updated_at: new Date() },
        });
        await applyGoldRenewal(user.id, user.requests_remaining ?? 0);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subId) break;
        const user = await prisma.users.findFirst({
          where: { stripe_subscription_id: subId },
        });
        if (user) await markPaymentPastDue(user.id);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const user =
          (await prisma.users.findFirst({
            where: { stripe_subscription_id: sub.id },
          })) ||
          (sub.metadata?.userId
            ? await prisma.users.findUnique({ where: { id: BigInt(sub.metadata.userId) } })
            : null);
        if (user) await downgradeFromGold(user.id, "canceled");
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await prisma.users.findFirst({
          where: { stripe_subscription_id: sub.id },
        });
        if (!user) break;
        if (sub.status === "active" || sub.status === "trialing") {
          await prisma.users.update({
            where: { id: user.id },
            data: { plan: "gold", subscription_status: sub.status, updated_at: new Date() },
          });
          await prisma.$executeRaw`UPDATE users SET payment_grace_until = NULL WHERE id = ${user.id}`.catch(
            () => undefined
          );
        } else if (sub.status === "past_due") {
          await markPaymentPastDue(user.id);
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          const graceRows = await prisma.$queryRaw<{ payment_grace_until: Date | null }[]>`
            SELECT payment_grace_until FROM users WHERE id = ${user.id} LIMIT 1
          `.catch(() => [] as { payment_grace_until: Date | null }[]);
          const grace = graceRows[0]?.payment_grace_until;
          if (!grace || grace.getTime() <= Date.now()) {
            await downgradeFromGold(user.id, sub.status);
          } else {
            await prisma.users.update({
              where: { id: user.id },
              data: { subscription_status: sub.status, updated_at: new Date() },
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("webhook handler", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
