import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function makeReferralCode(userId: bigint) {
  return `PN${userId.toString(36).toUpperCase().slice(-8)}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  let user = await prisma.users.findUnique({
    where: { id: userId },
    select: { referral_code: true },
  });

  if (!user?.referral_code) {
    const code = makeReferralCode(userId);
    user = await prisma.users.update({
      where: { id: userId },
      data: { referral_code: code },
      select: { referral_code: true },
    });
  }

  const referrals = await prisma.referrals.findMany({
    where: { referrer_id: userId },
    orderBy: { created_at: "desc" },
    take: 20,
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return NextResponse.json({
    code: user?.referral_code,
    link: `${base}/signup?ref=${encodeURIComponent(user?.referral_code ?? "")}`,
    count: referrals.length,
  });
}
