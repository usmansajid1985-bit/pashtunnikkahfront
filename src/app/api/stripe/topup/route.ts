import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl, currentTopupPack, ensureStripeCustomer, getStripe } from "@/lib/stripe";
import { raiseAdminAlert } from "@/lib/billing-events";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.users.findUnique({ where: { id: BigInt(session.userId) } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  // Top-ups are for Gold members only — refuse direct requests from Basic accounts too.
  if ((user.plan || "").toLowerCase() !== "gold") {
    return NextResponse.json({ error: "Buying extra Match Tokens is a Gold benefit. Upgrade to Gold to top up." }, { status: 403 });
  }

  try {
    const stripe = getStripe();
    const pack = await currentTopupPack();
    const priceId = pack.priceId;
    if (!priceId) {
      return NextResponse.json({ error: "Top-up price is not configured." }, { status: 500 });
    }
    // Never charge a price that disagrees with what the member was shown.
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount !== pack.pricePence || !price.active) {
      await raiseAdminAlert({
        kind: "config_error",
        severity: "critical",
        message: `Top-up checkout blocked: Stripe price ${priceId} is ${price.active ? `£${((price.unit_amount ?? 0) / 100).toFixed(2)}` : "inactive"} but Admin → Billing says £${(pack.pricePence / 100).toFixed(2)}. Re-save the top-up settings to resync.`,
        dedupeKey: `topupmismatch_${priceId}_${pack.pricePence}`,
      });
      return NextResponse.json({ error: "Top-ups are temporarily unavailable. Please try again later." }, { status: 503 });
    }

    const customerId = await ensureStripeCustomer(user);
    const origin = appUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id.toString(),
      metadata: { userId: user.id.toString(), checkoutType: "topup", tokens: String(pack.tokens) },
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
        plan_or_pack: `${pack.tokens}_credits`,
        amount_pence: checkout.amount_total ?? pack.pricePence,
        currency: (checkout.currency || "gbp").toLowerCase(),
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
