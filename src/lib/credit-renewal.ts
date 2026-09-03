import { prisma } from "@/lib/prisma";
import { recordCreditChange } from "@/lib/credit-ledger";
import { getPlanSettings, type PlanSettings } from "@/lib/plan-settings";

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lazy monthly allowance for Basic users (Gold renews via Stripe invoice.paid). */
export async function maybeRenewMonthlyCredits(userId: bigint): Promise<number | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { plan: true, requests_remaining: true, email_verified: true },
  });
  if (!user) return null;

  const plan = (user.plan || "basic").toLowerCase();
  if (plan === "gold") return user.requests_remaining;

  const settings = await getPlanSettings(user.plan);
  const now = new Date();
  const key = monthKey(now);
  const idempotencyKey = `monthly_allowance_${userId}_${key}`;

  const existing = await prisma.credit_ledger.findUnique({
    where: { idempotency_key: idempotencyKey },
  });
  if (existing) return user.requests_remaining;

  // Only renew verified Basic members (spec: after verification).
  if (!user.email_verified) return user.requests_remaining;

  const previous = user.requests_remaining ?? 0;
  const newBalance = Math.min(settings.monthlyCredits, settings.maxBalance);

  if (previous >= newBalance) {
    // Still record idempotency so we don't re-check every request this month.
    await recordCreditChange({
      userId,
      amount: 0,
      balanceType: "monthly",
      reason: "monthly_free_allowance",
      previousBalance: previous,
      newBalance: previous,
      idempotencyKey,
    });
    return previous;
  }

  await prisma.users.update({
    where: { id: userId },
    data: { requests_remaining: newBalance, updated_at: now },
  });

  await recordCreditChange({
    userId,
    amount: newBalance - previous,
    balanceType: "monthly",
    reason: "monthly_free_allowance",
    previousBalance: previous,
    newBalance,
    idempotencyKey,
  });

  return newBalance;
}

export function creditsLowWarning(balance: number, settings: PlanSettings) {
  return balance <= 1 && settings.plan === "free";
}
