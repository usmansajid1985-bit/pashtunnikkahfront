import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goldOffer } from "@/lib/gold-offer";
import { TOPUP_AMOUNT_PENCE, TOPUP_CREDITS } from "@/lib/stripe-constants";

export const dynamic = "force-dynamic";

/** What the app-wide "Upgrade to Gold" popup shows: price, benefits, and whether you're Gold already. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [offer, user] = await Promise.all([
    goldOffer(),
    prisma.users.findUnique({ where: { id: BigInt(session.userId) }, select: { plan: true, requests_remaining: true } }),
  ]);
  return NextResponse.json({
    ...offer,
    isGold: (user?.plan || "").toLowerCase() === "gold",
    tokens: user?.requests_remaining ?? 0,
    topup: { tokens: TOPUP_CREDITS, priceLabel: `£${(TOPUP_AMOUNT_PENCE / 100).toFixed(2)}` },
  });
}
