import type { TransactionClient } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "@/lib/prisma";
import { ensureBillingSchema } from "@/lib/billing-schema";

/**
 * Match Token engine. Every grant is a "lot" with its own source and expiry; the balance is the
 * sum of live lots. `users.requests_remaining` stays as a cached total so every existing reader
 * keeps working — it is rewritten from the lots after each change, never edited directly.
 *
 * Rules (admin-configurable in token_settings):
 *   Basic   basic_monthly per calendar month, no rollover (lot expires at the month's end).
 *   Gold    gold_monthly per paid cycle IN TOTAL — upgrading mid-month gives gold_monthly minus the
 *           Basic tokens already used that month, and the unused Basic lot is closed (never 13).
 *   Rollover up to rollover_max unused GOLD tokens carry into the next paid cycle only (a rollover
 *           lot never rolls again); gold + rollover is capped at gold_max_total.
 *   Top-up  topup_tokens per pack, never expire, kept after Gold ends.
 *   Spend   earliest-expiring eligible lot first, purchased tokens last.
 *   Refund  back into the lot it came from while that lot is still live; otherwise into a refund
 *           lot that lasts until the member's current cycle ends.
 * Every change is one transaction holding the member's row lock, and every grant carries an
 * idempotency key, so webhook retries, double-taps and concurrent cron runs can't double-credit.
 */

export type TokenSource = "basic" | "gold" | "rollover" | "purchased" | "admin" | "refund";

export type TokenSettings = {
  basicMonthly: number;
  goldMonthly: number;
  rolloverEnabled: boolean;
  rolloverMax: number;
  rolloverCycles: number;
  goldMaxTotal: number;
  topupTokens: number;
  topupPricePence: number;
  topupPriceId: string | null;
  graceDays: number;
  reminderDays: number;
};

type Db = TransactionClient;

type SettingsRow = {
  basic_monthly: number;
  gold_monthly: number;
  rollover_enabled: boolean;
  rollover_max: number;
  rollover_cycles: number;
  gold_max_total: number;
  topup_tokens: number;
  topup_price_pence: number;
  topup_price_id: string | null;
  grace_days: number;
  reminder_days: number;
};

export async function getTokenSettings(): Promise<TokenSettings> {
  await ensureBillingSchema();
  const rows = await prisma.$queryRaw<SettingsRow[]>`SELECT * FROM token_settings WHERE id = 1`;
  const r = rows[0];
  return {
    basicMonthly: r?.basic_monthly ?? 3,
    goldMonthly: r?.gold_monthly ?? 10,
    rolloverEnabled: r?.rollover_enabled ?? true,
    rolloverMax: r?.rollover_max ?? 5,
    rolloverCycles: Math.max(1, r?.rollover_cycles ?? 1),
    goldMaxTotal: r?.gold_max_total ?? 15,
    topupTokens: r?.topup_tokens ?? 5,
    topupPricePence: r?.topup_price_pence ?? 699,
    topupPriceId: r?.topup_price_id ?? null,
    graceDays: r?.grace_days ?? 3,
    reminderDays: r?.reminder_days ?? 3,
  };
}

export function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function startOfNextMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** Run `fn` in one transaction holding the member's row lock (and with their balance migrated). */
export async function withMemberTokens<T>(userId: bigint, fn: (tx: Db) => Promise<T>): Promise<T> {
  await ensureBillingSchema();
  const settings = await getTokenSettings();
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      await migrateLegacyBalance(tx, userId, settings);
      return fn(tx);
    },
    { timeout: 15000 }
  );
}

/** Sum of live lots. */
export async function liveBalance(tx: Db, userId: bigint): Promise<number> {
  const rows = await tx.$queryRaw<{ n: bigint | null }[]>`
    SELECT COALESCE(SUM(remaining), 0) AS n FROM token_lots
    WHERE user_id = ${userId} AND remaining > 0 AND closed_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  `;
  return Number(rows[0]?.n ?? 0);
}

async function syncCache(tx: Db, userId: bigint): Promise<number> {
  const balance = await liveBalance(tx, userId);
  await tx.$executeRaw`UPDATE users SET requests_remaining = ${balance}, updated_at = NOW() WHERE id = ${userId}`;
  return balance;
}

async function ledger(
  tx: Db,
  e: {
    userId: bigint;
    amount: number;
    source: string;
    reason: string;
    previous: number;
    next: number;
    lotId?: bigint | null;
    requestId?: bigint | null;
    paymentId?: bigint | null;
    adminId?: bigint | null;
    key?: string | null;
    note?: string | null;
  }
) {
  await tx.$executeRaw`
    INSERT INTO credit_ledger
      (user_id, amount, balance_type, reason, related_request_id, related_payment_id, admin_id,
       previous_balance, new_balance, idempotency_key, created_at, lot_id, note)
    VALUES
      (${e.userId}, ${e.amount}, ${e.source}, ${e.reason}, ${e.requestId ?? null}, ${e.paymentId ?? null},
       ${e.adminId ?? null}, ${e.previous}, ${e.next}, ${e.key ?? null}, NOW(), ${e.lotId ?? null}, ${e.note ?? null})
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
}

type LotRow = {
  id: bigint;
  user_id: bigint;
  source: TokenSource;
  amount: number;
  remaining: number;
  granted_at: Date;
  expires_at: Date | null;
  closed_at: Date | null;
  close_reason: string | null;
  closed_remaining: number | null;
  rolled_over: boolean;
};

export type GrantInput = {
  userId: bigint;
  source: TokenSource;
  amount: number;
  expiresAt: Date | null;
  idempotencyKey: string;
  reason: string;
  cycleKey?: string | null;
  paymentId?: bigint | null;
  stripeRef?: string | null;
  adminId?: bigint | null;
  note?: string | null;
};

/** Insert one lot (inside a member transaction). Returns null when the key was already used. */
export async function insertLot(tx: Db, g: GrantInput): Promise<bigint | null> {
  const before = await liveBalance(tx, g.userId);
  const rows = await tx.$queryRaw<{ id: bigint }[]>`
    INSERT INTO token_lots
      (user_id, source, amount, remaining, expires_at, cycle_key, idempotency_key, payment_id, stripe_ref, admin_id, note)
    VALUES
      (${g.userId}, ${g.source}, ${g.amount}, ${g.amount}, ${g.expiresAt}, ${g.cycleKey ?? null}, ${g.idempotencyKey},
       ${g.paymentId ?? null}, ${g.stripeRef ?? null}, ${g.adminId ?? null}, ${g.note ?? null})
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  `;
  const lotId = rows[0]?.id ?? null;
  if (lotId == null) return null;
  const after = await syncCache(tx, g.userId);
  await ledger(tx, {
    userId: g.userId,
    amount: g.amount,
    source: g.source,
    reason: g.reason,
    previous: before,
    next: after,
    lotId,
    paymentId: g.paymentId,
    adminId: g.adminId,
    key: `lot:${g.idempotencyKey}`,
    note: g.note,
  });
  return lotId;
}

/** Close a lot, zeroing what's left (expiry, end of cycle, upgrade, Gold ending). */
async function closeLot(tx: Db, lot: LotRow, reason: string, ledgerReason = "token_expired") {
  if (lot.closed_at) return;
  const before = await liveBalance(tx, lot.user_id);
  await tx.$executeRaw`
    UPDATE token_lots SET closed_at = NOW(), close_reason = ${reason}, closed_remaining = remaining, remaining = 0
    WHERE id = ${lot.id} AND closed_at IS NULL
  `;
  const after = await syncCache(tx, lot.user_id);
  if (lot.remaining > 0) {
    await ledger(tx, {
      userId: lot.user_id,
      amount: -lot.remaining,
      source: lot.source,
      reason: ledgerReason,
      previous: before,
      next: after,
      lotId: lot.id,
      key: `close:${lot.id}`,
      note: reason,
    });
  }
}

async function openLots(tx: Db, userId: bigint, sources: TokenSource[]): Promise<LotRow[]> {
  return tx.$queryRaw<LotRow[]>`
    SELECT * FROM token_lots
    WHERE user_id = ${userId} AND closed_at IS NULL AND source = ANY(${sources}::text[])
    ORDER BY granted_at ASC
  `;
}

/** Grant outside an existing transaction. */
export async function grantTokens(g: GrantInput): Promise<{ granted: boolean; lotId: bigint | null; balance: number }> {
  return withMemberTokens(g.userId, async (tx) => {
    const lotId = await insertLot(tx, g);
    return { granted: lotId != null, lotId, balance: await liveBalance(tx, g.userId) };
  });
}

/**
 * Spend one token for a Match Request, inside the caller's member transaction. Earliest-expiring
 * eligible lot first; purchased tokens only once everything else is used.
 */
export async function spendToken(tx: Db, userId: bigint, requestId: bigint): Promise<{ ok: boolean; balance: number }> {
  const before = await liveBalance(tx, userId);
  const lots = await tx.$queryRaw<LotRow[]>`
    SELECT * FROM token_lots
    WHERE user_id = ${userId} AND remaining > 0 AND closed_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY (source = 'purchased') ASC, expires_at ASC NULLS LAST, granted_at ASC, id ASC
    LIMIT 1
  `;
  const lot = lots[0];
  if (!lot) return { ok: false, balance: before };
  await tx.$executeRaw`UPDATE token_lots SET remaining = remaining - 1 WHERE id = ${lot.id}`;
  await tx.$executeRaw`INSERT INTO token_spends (user_id, lot_id, request_id) VALUES (${userId}, ${lot.id}, ${requestId})`;
  const after = await syncCache(tx, userId);
  await ledger(tx, {
    userId,
    amount: -1,
    source: lot.source,
    reason: "request_sent",
    previous: before,
    next: after,
    lotId: lot.id,
    requestId,
    key: `spend:${requestId}`,
  });
  return { ok: true, balance: after };
}

/** When the member's current cycle ends — where a late refund lands. */
async function currentCycleEnd(tx: Db, userId: bigint): Promise<Date> {
  const rows = await tx.$queryRaw<{ plan: string | null; e: Date | null }[]>`
    SELECT u.plan,
      (SELECT MAX(expires_at) FROM token_lots l
        WHERE l.user_id = u.id AND l.source = 'gold' AND l.closed_at IS NULL AND l.expires_at > NOW()) AS e
    FROM users u WHERE u.id = ${userId}
  `;
  const r = rows[0];
  if ((r?.plan || "").toLowerCase() === "gold") return r?.e ?? new Date(Date.now() + 30 * 86400000);
  return startOfNextMonth();
}

/**
 * Give back the token a Match Request spent (withdrawn, expired, blocked) — inside the caller's
 * member transaction, after it won the pending→closed transition. Returns the new balance.
 */
export async function refundTokenForRequest(tx: Db, userId: bigint, requestId: bigint, reason: string): Promise<number> {
  const before = await liveBalance(tx, userId);
  const spends = await tx.$queryRaw<{ id: bigint; lot_id: bigint }[]>`
    SELECT id, lot_id FROM token_spends
    WHERE request_id = ${requestId} AND user_id = ${userId} AND refunded_at IS NULL
    ORDER BY id DESC LIMIT 1
  `;
  const spend = spends[0];
  let lotId: bigint | null = null;
  let source: string = "refund";
  if (spend) {
    const live = await tx.$queryRaw<LotRow[]>`
      SELECT * FROM token_lots
      WHERE id = ${spend.lot_id} AND closed_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
    `;
    if (live[0]) {
      await tx.$executeRaw`UPDATE token_lots SET remaining = remaining + 1 WHERE id = ${live[0].id}`;
      lotId = live[0].id;
      source = live[0].source;
    }
  }
  if (lotId == null) {
    const rows = await tx.$queryRaw<{ id: bigint }[]>`
      INSERT INTO token_lots (user_id, source, amount, remaining, expires_at, idempotency_key, note)
      VALUES (${userId}, 'refund', 1, 1, ${await currentCycleEnd(tx, userId)}, ${`refund_${requestId}`}, ${reason})
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    `;
    lotId = rows[0]?.id ?? null;
    if (lotId == null) return before; // already refunded
  }
  if (spend) {
    await tx.$executeRaw`UPDATE token_spends SET refunded_at = NOW(), refund_lot_id = ${lotId} WHERE id = ${spend.id}`;
  }
  const after = await syncCache(tx, userId);
  await ledger(tx, {
    userId,
    amount: 1,
    source,
    reason,
    previous: before,
    next: after,
    lotId,
    requestId,
    key: `${reason}-${requestId}`,
  });
  return after;
}

/** Admin removal: takes tokens in normal spend order. Returns how many were actually removed. */
export async function removeTokens(userId: bigint, amount: number, adminId: bigint | null, note: string) {
  return withMemberTokens(userId, async (tx) => {
    let removed = 0;
    while (removed < amount) {
      const before = await liveBalance(tx, userId);
      const lots = await tx.$queryRaw<LotRow[]>`
        SELECT * FROM token_lots
        WHERE user_id = ${userId} AND remaining > 0 AND closed_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY (source = 'purchased') ASC, expires_at ASC NULLS LAST, granted_at ASC, id ASC
        LIMIT 1
      `;
      const lot = lots[0];
      if (!lot) break;
      const take = Math.min(lot.remaining, amount - removed);
      await tx.$executeRaw`UPDATE token_lots SET remaining = remaining - ${take} WHERE id = ${lot.id}`;
      const after = await syncCache(tx, userId);
      await ledger(tx, {
        userId,
        amount: -take,
        source: lot.source,
        reason: "admin_remove",
        previous: before,
        next: after,
        lotId: lot.id,
        adminId,
        note,
      });
      removed += take;
    }
    return { removed, balance: await liveBalance(tx, userId) };
  });
}

/** Basic: this calendar month's allowance (lazy — called when the member reads or spends). */
export async function ensureBasicAllowance(userId: bigint): Promise<number | null> {
  await ensureBillingSchema();
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { plan: true, email_verified: true, requests_remaining: true },
  });
  if (!user) return null;
  const settings = await getTokenSettings();
  return withMemberTokens(userId, async (tx) => {
    if ((user.plan || "").toLowerCase() !== "gold" && user.email_verified) {
      await insertLot(tx, {
        userId,
        source: "basic",
        amount: settings.basicMonthly,
        expiresAt: startOfNextMonth(),
        idempotencyKey: `basic_${userId}_${monthKey()}`,
        cycleKey: monthKey(),
        reason: "monthly_free_allowance",
      });
    }
    return syncCache(tx, userId);
  });
}

/**
 * One paid Gold cycle (first payment or renewal), keyed on the Stripe invoice so checkout
 * completion, invoice.paid and their retries all converge on exactly one grant.
 */
export async function applyGoldCycle(opts: {
  userId: bigint;
  invoiceId: string;
  periodStart: Date;
  periodEnd: Date;
  paymentId?: bigint | null;
}): Promise<{ granted: boolean; gold: number; rollover: number; balance: number }> {
  const s = await getTokenSettings();
  return withMemberTokens(opts.userId, async (tx) => {
    const done = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM token_lots WHERE idempotency_key = ${`gold_${opts.invoiceId}`}
    `;
    if (done[0]) return { granted: false, gold: 0, rollover: 0, balance: await liveBalance(tx, opts.userId) };

    // Previous Gold cycle(s): the newest unrolled Gold lot may roll over — once.
    const graceMs = (s.graceDays + 1) * 86400000;
    const prevGold = await tx.$queryRaw<LotRow[]>`
      SELECT * FROM token_lots
      WHERE user_id = ${opts.userId} AND source = 'gold' AND rolled_over = FALSE
        AND (closed_at IS NULL OR close_reason = 'expired')
        AND expires_at >= ${new Date(opts.periodStart.getTime() - graceMs)}
      ORDER BY expires_at DESC LIMIT 1
    `;
    const candidate = prevGold[0];
    const unused = candidate ? (candidate.closed_at ? candidate.closed_remaining ?? 0 : candidate.remaining) : 0;
    const rollover = s.rolloverEnabled
      ? Math.max(0, Math.min(unused, s.rolloverMax, s.goldMaxTotal - s.goldMonthly))
      : 0;
    if (candidate) await tx.$executeRaw`UPDATE token_lots SET rolled_over = TRUE WHERE id = ${candidate.id}`;
    for (const lot of await openLots(tx, opts.userId, ["gold", "rollover"])) {
      await closeLot(tx, lot, "cycle_ended");
    }

    // Upgrade from Basic: this month's Basic usage counts against the first Gold allowance.
    let goldAmount = s.goldMonthly;
    const isFirstCycle = !candidate;
    if (isFirstCycle) {
      const basic = await openLots(tx, opts.userId, ["basic"]);
      const thisMonth = basic.filter((l) => monthKey(l.granted_at) === monthKey());
      const used = thisMonth.reduce((n, l) => n + (l.amount - l.remaining), 0);
      goldAmount = Math.max(0, s.goldMonthly - used);
      for (const lot of basic) await closeLot(tx, lot, "upgraded_to_gold", "gold_upgrade_reconciled");
    }

    await insertLot(tx, {
      userId: opts.userId,
      source: "gold",
      amount: goldAmount,
      expiresAt: opts.periodEnd,
      idempotencyKey: `gold_${opts.invoiceId}`,
      cycleKey: opts.invoiceId,
      stripeRef: opts.invoiceId,
      paymentId: opts.paymentId,
      reason: "monthly_gold_allowance",
      note: isFirstCycle && goldAmount < s.goldMonthly ? `${s.goldMonthly - goldAmount} Basic token(s) already used this month` : null,
    });
    if (rollover > 0) {
      const cycleMs = Math.max(1, opts.periodEnd.getTime() - opts.periodStart.getTime());
      await insertLot(tx, {
        userId: opts.userId,
        source: "rollover",
        amount: rollover,
        expiresAt: new Date(opts.periodEnd.getTime() + (s.rolloverCycles - 1) * cycleMs),
        idempotencyKey: `rollover_${opts.invoiceId}`,
        cycleKey: opts.invoiceId,
        stripeRef: opts.invoiceId,
        reason: "gold_rollover",
      });
    }
    return { granted: true, gold: goldAmount, rollover, balance: await liveBalance(tx, opts.userId) };
  });
}

/** Failed renewal: Gold tokens stay usable through the grace period. */
export async function extendGoldLotsTo(userId: bigint, until: Date) {
  await ensureBillingSchema();
  await prisma.$executeRaw`
    UPDATE token_lots SET expires_at = ${until}
    WHERE user_id = ${userId} AND closed_at IS NULL AND source IN ('gold', 'rollover', 'refund')
      AND expires_at IS NOT NULL AND expires_at < ${until}
  `;
}

/**
 * Gold ended (cancelled at period end, or unpaid after grace): Gold/rollover tokens close,
 * purchased and admin tokens stay, and the member gets this month's Basic allowance.
 */
export async function closeGoldTokens(userId: bigint, endKey: string) {
  const s = await getTokenSettings();
  return withMemberTokens(userId, async (tx) => {
    for (const lot of await openLots(tx, userId, ["gold", "rollover", "refund"])) {
      await closeLot(tx, lot, "gold_ended", "gold_ended");
    }
    await insertLot(tx, {
      userId,
      source: "basic",
      amount: s.basicMonthly,
      expiresAt: startOfNextMonth(),
      idempotencyKey: `basic_${userId}_${monthKey()}_after_${endKey}`,
      cycleKey: monthKey(),
      reason: "monthly_free_allowance",
      note: "Basic allowance after Gold ended",
    });
    return liveBalance(tx, userId);
  });
}

/** Cron: close lots past their expiry. */
export async function expireDueLots(): Promise<number> {
  await ensureBillingSchema();
  const due = await prisma.$queryRaw<{ id: bigint; user_id: bigint }[]>`
    SELECT id, user_id FROM token_lots
    WHERE closed_at IS NULL AND expires_at IS NOT NULL AND expires_at <= NOW()
    ORDER BY expires_at ASC LIMIT 500
  `;
  let n = 0;
  for (const d of due) {
    await withMemberTokens(d.user_id, async (tx) => {
      const lot = (await tx.$queryRaw<LotRow[]>`SELECT * FROM token_lots WHERE id = ${d.id}`)[0];
      if (lot && !lot.closed_at) {
        await closeLot(tx, lot, "expired");
        n++;
      }
      await syncCache(tx, d.user_id);
    }).catch((err) => console.error("[tokens] expire failed", d.id, err));
  }
  return n;
}

export type TokenBuckets = Record<TokenSource, { remaining: number; nextExpiry: Date | null }> & { total: number };

/** Live balance per source, with each bucket's soonest expiry. */
export async function balancesByBucket(userId: bigint): Promise<TokenBuckets> {
  await ensureBillingSchema();
  const rows = await prisma.$queryRaw<{ source: TokenSource; n: bigint; e: Date | null }[]>`
    SELECT source, SUM(remaining) AS n, MIN(expires_at) AS e FROM token_lots
    WHERE user_id = ${userId} AND remaining > 0 AND closed_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    GROUP BY source
  `;
  const empty = { remaining: 0, nextExpiry: null };
  const out = {
    basic: { ...empty },
    gold: { ...empty },
    rollover: { ...empty },
    purchased: { ...empty },
    admin: { ...empty },
    refund: { ...empty },
    total: 0,
  } as TokenBuckets;
  for (const r of rows) {
    out[r.source] = { remaining: Number(r.n), nextExpiry: r.e };
    out.total += Number(r.n);
  }
  return out;
}

/**
 * First touch after the engine shipped: turn the old flat balance into lots. Tokens covered by
 * the member's completed top-up purchases become "purchased" (never expire); the rest becomes
 * this cycle's plan allowance.
 */
async function migrateLegacyBalance(tx: Db, userId: bigint, s: TokenSettings) {
  const rows = await tx.$queryRaw<
    { plan: string | null; requests_remaining: number | null; token_lots_migrated_at: Date | null; subscription_cancel_at: Date | null }[]
  >`SELECT plan, requests_remaining, token_lots_migrated_at, subscription_cancel_at FROM users WHERE id = ${userId}`;
  const u = rows[0];
  if (!u || u.token_lots_migrated_at) return;
  const balance = Math.max(0, u.requests_remaining ?? 0);
  const gold = (u.plan || "").toLowerCase() === "gold";
  const bought = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM payments WHERE user_id = ${userId} AND type = 'topup' AND status = 'completed'
  `;
  const purchased = Math.min(balance, Number(bought[0]?.n ?? 0) * s.topupTokens);
  const rest = balance - purchased;
  const usedOldAllowance = await tx.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM credit_ledger WHERE idempotency_key = ${`monthly_allowance_${userId}_${monthKey()}`}
  `;

  const lot = async (source: TokenSource, amount: number, expiresAt: Date | null, key: string) => {
    await tx.$executeRaw`
      INSERT INTO token_lots (user_id, source, amount, remaining, expires_at, idempotency_key, note)
      VALUES (${userId}, ${source}, ${amount}, ${amount}, ${expiresAt}, ${key}, 'Balance carried over from the old token system')
      ON CONFLICT (idempotency_key) DO NOTHING
    `;
  };
  if (purchased > 0) await lot("purchased", purchased, null, `migration_purchased_${userId}`);
  if (gold) {
    if (rest > 0) await lot("gold", rest, u.subscription_cancel_at ?? new Date(Date.now() + 31 * 86400000), `migration_gold_${userId}`);
  } else if (rest > 0 || usedOldAllowance[0]) {
    // Holds this month's Basic slot, so the allowance isn't granted a second time.
    await lot("basic", rest, startOfNextMonth(), `basic_${userId}_${monthKey()}`);
  }
  await tx.$executeRaw`UPDATE users SET token_lots_migrated_at = NOW() WHERE id = ${userId}`;
  if (balance > 0) {
    await ledger(tx, {
      userId,
      amount: 0,
      source: "migration",
      reason: "balance_migrated",
      previous: balance,
      next: balance,
      key: `migration_${userId}`,
      note: `${purchased} purchased + ${rest} ${gold ? "Gold" : "Basic"}`,
    });
  }
}
