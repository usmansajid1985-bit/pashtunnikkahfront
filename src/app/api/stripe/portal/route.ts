import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl, ensureStripeCustomer, getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.users.findUnique({ where: { id: BigInt(session.userId) } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(user);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/settings/membership`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("stripe portal", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not open billing portal" },
      { status: 500 }
    );
  }
}
