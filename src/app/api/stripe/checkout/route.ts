import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl, ensureStripeCustomer, getStripe, goldPriceId, goldProductId } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.users.findUnique({ where: { id: BigInt(session.userId) } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if ((user.plan || "").toLowerCase() === "gold" && user.subscription_status === "active") {
    return NextResponse.json({ error: "Already on Gold." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    let priceId = goldPriceId();
    if (!priceId) {
      const prices = await stripe.prices.list({
        product: goldProductId(),
        active: true,
        type: "recurring",
        limit: 1,
      });
      priceId = prices.data[0]?.id || "";
    }
    if (!priceId) {
      return NextResponse.json({ error: "Gold price is not configured." }, { status: 500 });
    }

    const customerId = await ensureStripeCustomer(user);
    const origin = appUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id.toString(),
      metadata: { userId: user.id.toString(), plan: "gold" },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/membership?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/membership?canceled=1`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: user.id.toString(), plan: "gold" },
      },
    });

    await prisma.payments.create({
      data: {
        id:
          ((
            await prisma.payments.aggregate({ _max: { id: true } })
          )._max.id ?? BigInt(0)) + BigInt(1),
        user_id: user.id,
        stripe_session_id: checkout.id,
        type: "subscription",
        plan_or_pack: "gold",
        amount_pence: checkout.amount_total ?? 1000,
        status: "pending",
        created_at: new Date(),
      },
    });

    return NextResponse.json({ url: checkout.url, sessionId: checkout.id });
  } catch (err) {
    console.error("stripe checkout", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start checkout" },
      { status: 500 }
    );
  }
}
