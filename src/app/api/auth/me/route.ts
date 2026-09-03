import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maybeRenewMonthlyCredits } from "@/lib/credit-renewal";
import { ensureP1Schema } from "@/lib/ensure-p1-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  await ensureP1Schema();

  const user = await prisma.users.findUnique({
    where: { id: BigInt(session.userId) },
    select: {
      email_verified: true,
      requests_remaining: true,
      subscription_status: true,
      plan: true,
    },
  });

  let credits = user?.requests_remaining ?? 0;
  if (user) {
    const renewed = await maybeRenewMonthlyCredits(BigInt(session.userId));
    if (renewed != null) credits = renewed;
  }

  let paymentPastDue = false;
  let paymentGraceUntil: string | null = null;
  if (user?.subscription_status === "past_due") {
    paymentPastDue = true;
    const graceRows = await prisma.$queryRaw<{ payment_grace_until: Date | null }[]>`
      SELECT payment_grace_until FROM users WHERE id = ${BigInt(session.userId)} LIMIT 1
    `.catch(() => [] as { payment_grace_until: Date | null }[]);
    const grace = graceRows[0]?.payment_grace_until;
    if (grace && grace.getTime() > Date.now()) {
      paymentGraceUntil = grace.toISOString();
    } else if (!grace) {
      paymentPastDue = false;
    }
  }

  return NextResponse.json({
    user: {
      ...session,
      emailVerified: Boolean(user?.email_verified),
      credits,
      paymentPastDue,
      paymentGraceUntil,
    },
  });
}
