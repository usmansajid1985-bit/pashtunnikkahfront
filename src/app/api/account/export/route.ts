import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRematchBalance } from "@/lib/rematch-tokens";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const [user, profile, ledger, rematchTokens] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    prisma.credit_ledger.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
    }),
    getRematchBalance(userId),
  ]);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id.toString(),
      email: user.email,
      plan: user.plan,
      credits: user.requests_remaining,
      rematchTokens,
      emailVerified: user.email_verified,
      registeredAt: user.registered_at,
    },
    profile: profile
      ? {
          profileCode: profile.profile_code,
          gender: profile.gender,
          age: profile.age,
          country: profile.country,
          city: profile.city,
          status: profile.status,
        }
      : null,
    creditLedger: ledger.map((r) => ({
      amount: r.amount,
      balanceType: r.balance_type,
      reason: r.reason,
      previousBalance: r.previous_balance,
      newBalance: r.new_balance,
      createdAt: r.created_at,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="pashtun-nikah-export-${user.id}.json"`,
    },
  });
}
