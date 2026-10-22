import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  activateGoldFromCheckout,
  activateTopupFromCheckout,
  downgradeFromGold,
  getStripe,
  handleChargeRefunded,
  handleDispute,
  handleGoldInvoicePaid,
  invoiceSubscriptionId,
  markPaymentPastDue,
  recordCancellationChange,
  TOPUP_AMOUNT_PENCE,
} from "@/lib/stripe";
import { ensureP1Schema } from "@/lib/ensure-p1-schema";
import { ensureStripeWebhookSchema } from "@/lib/ensure-stripe-webhook-schema";
import { raiseAdminAlert } from "@/lib/billing-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (secret) {
      if (!sig) throw new Error("missing stripe-signature");
      event = stripe.webhooks.constructEvent(body, sig, secret);
    } else if (process.env.NODE_ENV !== "production") {
      // Local dev without a whsec only — production always verifies.
      event = JSON.parse(body) as Stripe.Event;
    } else {
      await raiseAdminAlert({
        kind: "config_error",
        severity: "critical",
        message: "STRIPE_WEBHOOK_SECRET is not set in production — Stripe webhooks are being rejected.",
        dedupeKey: `nowhsec_${new Date().toISOString().slice(0, 10)}`,
      });
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }
  } catch (err) {
    console.error("webhook verify", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await ensureP1Schema();
  await ensureStripeWebhookSchema();

  // Stripe redelivers on anything but a fast 200, and can send the same event twice outright.
  // Claim the event id atomically before doing any work; a concurrent/duplicate delivery sees 0.
  const claim = await prisma.$executeRaw`
    INSERT INTO stripe_webhook_events (event_id, type)
    VALUES (${event.id}, ${event.type})
    ON CONFLICT (event_id) DO NOTHING
  `;
  if (claim === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
  } catch (err) {
    console.error("webhook handler", event.type, err);
    // Release the claim so Stripe's retry is processed instead of skipped as a duplicate.
    await prisma.$executeRaw`DELETE FROM stripe_webhook_events WHERE event_id = ${event.id}`.catch(() => undefined);
    await raiseAdminAlert({
      kind: "webhook_error",
      severity: "critical",
      message: `Stripe ${event.type} (${event.id}) failed: ${err instanceof Error ? err.message : String(err)}. Stripe will retry; check the member's billing if it keeps failing.`,
      data: { eventId: event.id, type: event.type },
      dedupeKey: `webhook_${event.id}`,
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userIdRaw = session.metadata?.userId || session.client_reference_id;
      if (!userIdRaw) return;
      if (session.metadata?.checkoutType === "topup") {
        await activateTopupFromCheckout({
          userId: BigInt(userIdRaw),
          sessionId: session.id,
          amountPence: session.amount_total ?? TOPUP_AMOUNT_PENCE,
          currency: session.currency,
          tokens: Number(session.metadata?.tokens) || null,
          paymentIntentId: idOf(session.payment_intent as string | { id: string } | null),
        });
        return;
      }
      await activateGoldFromCheckout({
        userId: BigInt(userIdRaw),
        sessionId: session.id,
        customerId: idOf(session.customer as string | { id: string } | null),
        subscriptionId: idOf(session.subscription as string | { id: string } | null),
        amountPence: session.amount_total ?? 999,
        currency: session.currency,
      });
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as unknown as Parameters<typeof handleGoldInvoicePaid>[0];
      if (!invoiceSubscriptionId(invoice)) return;
      await handleGoldInvoicePaid(invoice);
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Parameters<typeof handleGoldInvoicePaid>[0];
      const subId = invoiceSubscriptionId(invoice);
      if (!subId) return;
      const user = await prisma.users.findFirst({ where: { stripe_subscription_id: subId } });
      if (user) await markPaymentPastDue(user.id, invoice);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const user =
        (await prisma.users.findFirst({ where: { stripe_subscription_id: sub.id } })) ||
        (sub.metadata?.userId ? await prisma.users.findUnique({ where: { id: BigInt(sub.metadata.userId) } }) : null);
      // Only the member's current subscription can end their Gold (an old duplicate ending can't).
      if (user && (!user.stripe_subscription_id || user.stripe_subscription_id === sub.id)) {
        await downgradeFromGold(user.id, "canceled", sub.id);
      }
      return;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const user = await prisma.users.findFirst({ where: { stripe_subscription_id: sub.id } });
      if (!user) return;
      const prev = await prisma.$queryRaw<{ subscription_cancel_at: Date | null; payment_grace_until: Date | null }[]>`
        SELECT subscription_cancel_at, payment_grace_until FROM users WHERE id = ${user.id}
      `;
      if (sub.status === "active" || sub.status === "trialing") {
        await prisma.users.update({
          where: { id: user.id },
          data: { plan: "gold", subscription_status: sub.status, updated_at: new Date() },
        });
        await prisma.$executeRaw`UPDATE users SET payment_grace_until = NULL WHERE id = ${user.id}`;
        // Cancelled-at-period-end stays "active" until the period ends; cancel_at is that moment.
        const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : null;
        await prisma.$executeRaw`UPDATE users SET subscription_cancel_at = ${cancelAt} WHERE id = ${user.id}`;
        await recordCancellationChange(user.id, sub, prev[0]?.subscription_cancel_at ?? null);
      } else if (sub.status === "past_due") {
        await markPaymentPastDue(user.id);
      } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
        const grace = prev[0]?.payment_grace_until;
        if (!grace || grace.getTime() <= Date.now()) {
          await downgradeFromGold(user.id, sub.status, sub.id);
        } else {
          await prisma.users.update({
            where: { id: user.id },
            data: { subscription_status: sub.status, updated_at: new Date() },
          });
        }
      }
      return;
    }
    case "charge.refunded": {
      await handleChargeRefunded(event.data.object as unknown as Parameters<typeof handleChargeRefunded>[0]);
      return;
    }
    case "refund.failed":
    case "charge.refund.updated":
    case "refund.updated": {
      const refund = event.data.object as Stripe.Refund;
      if (refund.status === "failed" || refund.status === "canceled") {
        await raiseAdminAlert({
          kind: "refund_error",
          severity: "critical",
          message: `Refund ${refund.id} (${(refund.amount / 100).toFixed(2)} ${refund.currency.toUpperCase()}) ${refund.status}: ${refund.failure_reason || "no reason given"}.`,
          data: { refundId: refund.id, charge: idOf(refund.charge as string | { id: string } | null) },
          dedupeKey: `refundfail_${refund.id}`,
        });
      }
      return;
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const d = event.data.object as Stripe.Dispute;
      await handleDispute(
        {
          id: d.id,
          amount: d.amount,
          currency: d.currency,
          reason: d.reason,
          status: d.status,
          charge: idOf(d.charge as string | { id: string } | null),
          payment_intent: idOf(d.payment_intent as string | { id: string } | null),
        },
        event.type === "charge.dispute.created" ? "opened" : "closed"
      );
      return;
    }
    default:
      return;
  }
}
