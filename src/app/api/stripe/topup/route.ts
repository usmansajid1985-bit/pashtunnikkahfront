import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  appUrl,
  ensureStripeCustomer,
  getStripe,
  resolveTopupPriceId,
  TOPUP_AMOUNT_PENCE,
} from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.users.findUnique({ where: { id: BigInt(session.userId) } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const stripe = getStripe();
    const priceId = await resolveTopupPriceId();
    if (!priceId) {
      return NextResponse.json({ error: "Top-up price is not configured." }, { status: 500 });
    }

    const customerId = await ensureStripeCustomer(user);
    const origin = appUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id.toString(),
      metadata: { userId: user.id.toString(), checkoutType: "topup" },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/membership?topup=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/membership?canceled=1`,
    });

    await prisma.payments.create({
      data: {
        id:
          ((
            await prisma.payments.aggregate({ _max: { id: true } })
          )._max.id ?? BigInt(0)) + BigInt(1),
        user_id: user.id,
        stripe_session_id: checkout.id,
        type: "topup",
        plan_or_pack: "5_credits",
        amount_pence: checkout.amount_total ?? TOPUP_AMOUNT_PENCE,
        status: "pending",
        created_at: new Date(),
      },
    });

    return NextResponse.json({ url: checkout.url, sessionId: checkout.id });
  } catch (err) {
    console.error("stripe topup", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start checkout" },
      { status: 500 }
    );
  }
}
