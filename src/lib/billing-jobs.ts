import { prisma } from "@/lib/prisma";
import { ensureBillingSchema } from "@/lib/billing-schema";
import { expireDueLots, getTokenSettings } from "@/lib/tokens";
import { fmtDay, notifyMemberBilling, raiseAdminAlert } from "@/lib/billing-events";
import { downgradeFromGold, getStripe } from "@/lib/stripe";

/**
 * Daily billing housekeeping (from /api/internal/jobs):
 *   1. close expired token lots
 *   2. remind members whose tokens expire within `reminder_days`, with the actual amount
 *   3. end Gold for members still unpaid after the grace period
 *   4. reconcile PN against Stripe and raise admin alerts for anything that doesn't add up
 */
export async function runBillingJobs() {
  await ensureBillingSchema();
  const expired = await expireDueLots().catch((err) => {
    console.error("[billing-jobs] expire failed", err);
    return 0;
  });
  const reminders = await sendExpiryReminders().catch((err) => {
    console.error("[billing-jobs] reminders failed", err);
    return 0;
  });
  const graceEnded = await endLapsedGrace().catch((err) => {
    console.error("[billing-jobs] grace sweep failed", err);
    return 0;
  });
  const reconciled = await reconcileWithStripe().catch((err) => {
    console.error("[billing-jobs] reconcile failed", err);
    return { checked: 0, alerts: 0 };
  });
  const audits = await auditCredits().catch((err) => {
    console.error("[billing-jobs] audit failed", err);
    return 0;
  });
  return { expired, reminders, graceEnded, reconciled, audits };
}

/** One reminder per member per expiry date, naming exactly how many tokens are about to go. */
async function sendExpiryReminders(): Promise<number> {
  const s = await getTokenSettings();
  if (s.reminderDays <= 0) return 0;
  const until = new Date(Date.now() + s.reminderDays * 86400000);
  const due = await prisma.$queryRaw<{ user_id: bigint; n: bigint; e: Date; ids: bigint[] }[]>`
    SELECT user_id, SUM(remaining) AS n, MIN(expires_at) AS e, ARRAY_AGG(id) AS ids
    FROM token_lots
    WHERE closed_at IS NULL AND remaining > 0 AND reminded_at IS NULL
      AND expires_at IS NOT NULL AND expires_at > NOW() AND expires_at <= ${until}
      AND source <> 'basic'
    GROUP BY user_id
    LIMIT 200
  `;
  let sent = 0;
  for (const d of due) {
    const n = Number(d.n);
    await prisma.$executeRaw`UPDATE token_lots SET reminded_at = NOW() WHERE id = ANY(${d.ids}::bigint[])`;
    await notifyMemberBilling(d.user_id, {
      type: "token_expiry",
      title: `${n} Match Token${n === 1 ? "" : "s"} expire${n === 1 ? "s" : ""} on ${fmtDay(d.e)}`,
      body: "Use them before they expire — purchased tokens never expire.",
      lines: [
        "Assalamu Alaikum,",
        `You have ${n} unused Match Token${n === 1 ? "" : "s"} that will expire on ${fmtDay(d.e)}.`,
        "Send a Match Request before then so they don't go to waste. Tokens you bought never expire.",
      ],
      ctaLabel: "Browse members",
      url: "/browse",
    });
    sent++;
  }
  return sent;
}

/** Past-due members whose grace has run out: confirm with Stripe, then move them to Basic. */
async function endLapsedGrace(): Promise<number> {
  const rows = await prisma.$queryRaw<{ id: bigint; stripe_subscription_id: string | null }[]>`
    SELECT id, stripe_subscription_id FROM users
    WHERE LOWER(plan) = 'gold' AND payment_grace_until IS NOT NULL AND payment_grace_until < NOW()
    LIMIT 50
  `;
  let n = 0;
  for (const u of rows) {
    let status = "unpaid";
    if (u.stripe_subscription_id) {
      try {
        status = (await getStripe().subscriptions.retrieve(u.stripe_subscription_id)).status;
      } catch {
        status = "unknown";
      }
    }
    if (status === "active" || status === "trialing") {
      // Paid after all — the webhook will (or did) grant; just clear the grace flag.
      await prisma.$executeRaw`UPDATE users SET payment_grace_until = NULL, subscription_status = ${status} WHERE id = ${u.id}`;
      continue;
    }
    await downgradeFromGold(u.id, status === "unknown" ? "unpaid" : status, `grace_${u.stripe_subscription_id ?? u.id}`);
    n++;
  }
  return n;
}

/**
 * Gold in PN must mean an active (or in-grace) subscription in Stripe, and vice versa. Checks a
 * rolling batch each run so every Gold member is covered every few days without slowing the cron.
 */
async function reconcileWithStripe(): Promise<{ checked: number; alerts: number }> {
  if (!process.env.STRIPE_SECRET_KEY) return { checked: 0, alerts: 0 };
  const stripe = getStripe();
  const rows = await prisma.$queryRaw<
    { id: bigint; plan: string | null; subscription_status: string | null; stripe_subscription_id: string | null; payment_grace_until: Date | null }[]
  >`
    SELECT id, plan, subscription_status, stripe_subscription_id, payment_grace_until FROM users
    WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id <> ''
    ORDER BY MD5(id::text || ${new Date().toISOString().slice(0, 10)})
    LIMIT 40
  `;
  let alerts = 0;
  for (const u of rows) {
    const pnGold = (u.plan || "").toLowerCase() === "gold";
    let status: string;
    try {
      status = (await stripe.subscriptions.retrieve(u.stripe_subscription_id!)).status;
    } catch {
      continue;
    }
    const stripeGold = ["active", "trialing", "past_due"].includes(status);
    if (pnGold !== stripeGold) {
      alerts++;
      await raiseAdminAlert({
        kind: "stripe_mismatch",
        userId: u.id,
        message: pnGold
          ? `PN shows Gold but Stripe subscription ${u.stripe_subscription_id} is "${status}".`
          : `Stripe subscription ${u.stripe_subscription_id} is "${status}" but PN shows ${u.plan || "basic"}.`,
        data: { pnPlan: u.plan, pnStatus: u.subscription_status, stripeStatus: status },
        dedupeKey: `mismatch_${u.id}_${status}_${u.plan}`,
      });
    }
  }
  return { checked: rows.length, alerts };
}

/** Payments with no tokens behind them, and members holding two live Gold allowances at once. */
async function auditCredits(): Promise<number> {
  let n = 0;
  const unpaid = await prisma.$queryRaw<{ id: bigint; user_id: bigint; type: string; stripe_session_id: string; stripe_invoice_id: string | null }[]>`
    SELECT p.id, p.user_id, p.type, p.stripe_session_id, p.stripe_invoice_id FROM payments p
    WHERE p.status = 'completed' AND p.created_at > NOW() - INTERVAL '14 days' AND p.created_at < NOW() - INTERVAL '15 minutes'
      AND p.created_at > (SELECT engine_started_at FROM token_settings WHERE id = 1)
      AND p.type IN ('topup', 'subscription')
      AND NOT EXISTS (
        SELECT 1 FROM token_lots l WHERE l.user_id = p.user_id
          AND (l.payment_id = p.id OR l.idempotency_key = 'topup_' || p.stripe_session_id
               OR (p.stripe_invoice_id IS NOT NULL AND l.idempotency_key = 'gold_' || p.stripe_invoice_id))
      )
  `;
  for (const p of unpaid) {
    n++;
    await raiseAdminAlert({
      kind: "paid_without_credit",
      severity: "critical",
      userId: p.user_id,
      message: `Completed ${p.type} payment #${p.id} has no Match Tokens credited.`,
      data: { paymentId: p.id, session: p.stripe_session_id, invoice: p.stripe_invoice_id },
      dedupeKey: `nocredit_${p.id}`,
    });
  }
  const dupes = await prisma.$queryRaw<{ user_id: bigint; n: bigint }[]>`
    SELECT user_id, COUNT(*) AS n FROM token_lots
    WHERE source = 'gold' AND closed_at IS NULL AND remaining > 0 AND (expires_at IS NULL OR expires_at > NOW())
    GROUP BY user_id HAVING COUNT(*) > 1
  `;
  for (const d of dupes) {
    n++;
    await raiseAdminAlert({
      kind: "duplicate_grant",
      userId: d.user_id,
      message: `Member holds ${d.n} live Gold allowances at once — likely a duplicate grant.`,
      dedupeKey: `dupgold_${d.user_id}_${new Date().toISOString().slice(0, 10)}`,
    });
  }
  return n;
}
