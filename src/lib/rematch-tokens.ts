import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";
import { ensureP2Schema } from "@/lib/ensure-p2-schema";

export type RematchPlanConfig = {
  tokensPerCycle: number;
  maxStack: number;
};

const DEFAULT_REMATCH: RematchPlanConfig = {
  tokensPerCycle: 1,
  maxStack: 2,
};

export async function getRematchPlanConfig(plan: string | null | undefined): Promise<RematchPlanConfig> {
  await ensureP2Schema();
  const key = (plan || "basic").toLowerCase() === "gold" ? "gold" : "free";
  const rows = await prisma.$queryRaw<
    { rematch_tokens_per_cycle: number; rematch_max_stack: number }[]
  >`
    SELECT rematch_tokens_per_cycle, rematch_max_stack
    FROM plan_settings WHERE plan = ${key}
  `.catch(() => []);
  const row = rows[0];
  if (!row) return DEFAULT_REMATCH;
  return {
    tokensPerCycle: row.rematch_tokens_per_cycle ?? 1,
    maxStack: row.rematch_max_stack ?? 2,
  };
}

export async function getRematchBalance(userId: bigint): Promise<number> {
  await ensureP2Schema();
  const rows = await prisma.$queryRaw<{ rematch_tokens_remaining: number }[]>`
    SELECT COALESCE(rematch_tokens_remaining, 0) AS rematch_tokens_remaining
    FROM users WHERE id = ${userId}
  `.catch(() => [{ rematch_tokens_remaining: 0 }]);
  return rows[0]?.rematch_tokens_remaining ?? 0;
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lazy monthly rematch token grant (Gold + verified Basic). Stacks up to maxStack. */
export async function maybeRenewRematchTokens(userId: bigint): Promise<number> {
  await ensureP2Schema();
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { plan: true, email_verified: true },
  });
  if (!user?.email_verified) return getRematchBalance(userId);

  const config = await getRematchPlanConfig(user.plan);
  if (config.tokensPerCycle <= 0) return getRematchBalance(userId);

  const key = `rematch_allowance_${userId}_${monthKey(new Date())}`;
  const existing = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM rematch_token_ledger WHERE idempotency_key = ${key} LIMIT 1
  `.catch(() => []);
  if (existing.length > 0) return getRematchBalance(userId);

  const current = await getRematchBalance(userId);
  const grant = Math.min(config.tokensPerCycle, Math.max(0, config.maxStack - current));
  const newBalance = current + grant;
  const now = new Date();

  if (grant > 0) {
    await prisma.$executeRaw`
      UPDATE users SET rematch_tokens_remaining = ${newBalance}, updated_at = ${now}
      WHERE id = ${userId}
    `;
  }

  await prisma.$executeRaw`
    INSERT INTO rematch_token_ledger (user_id, amount, reason, previous_balance, new_balance, idempotency_key, created_at)
    VALUES (${userId}, ${grant}, ${grant > 0 ? "monthly_allowance" : "monthly_allowance_skip"}, ${current}, ${grant > 0 ? newBalance : current}, ${key}, ${now})
    ON CONFLICT (idempotency_key) DO NOTHING
  `.catch(() => undefined);

  return grant > 0 ? newBalance : current;
}

export async function consumeRematchToken(
  userId: bigint,
  priorRequestId: bigint
): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  await ensureP2Schema();
  await maybeRenewRematchTokens(userId);

  const balance = await getRematchBalance(userId);
  if (balance <= 0) {
    return {
      ok: false,
      error: "No rematch tokens left. Gold members receive 1 per month (max 2 stacked).",
    };
  }

  const newBalance = balance - 1;
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE users SET rematch_tokens_remaining = ${newBalance}, updated_at = ${now}
    WHERE id = ${userId}
  `;
  await prisma.$executeRaw`
    INSERT INTO rematch_token_ledger (user_id, amount, reason, previous_balance, new_balance, related_request_id, created_at)
    VALUES (${userId}, -1, 'rematch_used', ${balance}, ${newBalance}, ${priorRequestId}, ${now})
  `.catch(() => undefined);

  return { ok: true, remaining: newBalance };
}

export async function findPriorEndedMatch(me: bigint, peer: bigint) {
  await ensureMatchRequestsSchema();
  return prisma.match_requests.findFirst({
    where: {
      OR: [
        { sender_id: me, receiver_id: peer },
        { sender_id: peer, receiver_id: me },
      ],
      status: "ended",
    },
    orderBy: { ended_at: "desc" },
  });
}
