import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { siteOrigin } from "@/lib/site-url";
import { featureEnabled } from "@/lib/feature-flags";
import { ensureBillingSchema } from "@/lib/billing-schema";

export type BillingEventKind =
  | "gold_started"
  | "renewal"
  | "payment_failed"
  | "topup_purchased"
  | "cancellation_scheduled"
  | "cancellation_reverted"
  | "gold_ended"
  | "refund"
  | "dispute_opened"
  | "dispute_closed";

/** One row in the member's billing timeline. Returns false when `dedupeKey` was already recorded. */
export async function recordBillingEvent(e: {
  userId: bigint | null;
  kind: BillingEventKind;
  amountPence?: number | null;
  currency?: string | null;
  stripeRef?: string | null;
  reason?: string | null;
  data?: Record<string, unknown> | null;
  dedupeKey?: string | null;
}): Promise<boolean> {
  await ensureBillingSchema();
  const n = await prisma.$executeRaw`
    INSERT INTO billing_events (user_id, kind, amount_pence, currency, stripe_ref, reason, data, dedupe_key)
    VALUES (${e.userId}, ${e.kind}, ${e.amountPence ?? null}, ${e.currency ?? null}, ${e.stripeRef ?? null},
            ${e.reason ?? null}, ${e.data ? JSON.stringify(e.data, bigintSafe) : null}::jsonb, ${e.dedupeKey ?? null})
    ON CONFLICT (dedupe_key) DO NOTHING
  `;
  return n > 0;
}

export type AdminAlertKind =
  | "paid_without_credit"
  | "duplicate_subscription"
  | "duplicate_grant"
  | "stripe_mismatch"
  | "webhook_error"
  | "refund_error"
  | "dispute"
  | "config_error";

/**
 * Something a human must look at, shown in Admin → Billing. Also emailed to BILLING_ALERT_EMAIL
 * (comma-separated) when that is set. Same `dedupeKey` → one alert, however often it's detected.
 */
export async function raiseAdminAlert(a: {
  kind: AdminAlertKind;
  message: string;
  userId?: bigint | null;
  severity?: "info" | "warning" | "critical";
  data?: Record<string, unknown> | null;
  dedupeKey?: string | null;
}): Promise<void> {
  try {
    await ensureBillingSchema();
    const n = await prisma.$executeRaw`
      INSERT INTO admin_alerts (kind, severity, user_id, message, data, dedupe_key)
      VALUES (${a.kind}, ${a.severity ?? "warning"}, ${a.userId ?? null}, ${a.message},
              ${a.data ? JSON.stringify(a.data, bigintSafe) : null}::jsonb, ${a.dedupeKey ?? null})
      ON CONFLICT (dedupe_key) DO NOTHING
    `;
    console.warn(`[billing-alert] ${a.kind}: ${a.message}`);
    const to = (process.env.BILLING_ALERT_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (n > 0 && to.length) {
      const subject = `[PN billing] ${a.kind.replace(/_/g, " ")}`;
      const text = `${a.message}${a.userId ? `\n\nMember #${a.userId}` : ""}\n\nOpen Admin → Billing to review.`;
      for (const addr of to) await sendMail({ to: addr, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>` });
    }
  } catch (err) {
    console.error("[billing-alert] could not record", a.kind, err);
  }
}

/**
 * Member-facing billing notice: in-app bell + email. Billing mail is account mail, so it isn't
 * behind the activity-email opt-in — FEATURE_BILLING_EMAILS=0 switches the email off.
 */
export async function notifyMemberBilling(
  userId: bigint,
  n: { type: string; title: string; body: string; lines: string[]; ctaLabel?: string; url?: string }
) {
  const url = n.url ?? "/settings/membership";
  try {
    const { createNotification } = await import("@/lib/notifications");
    await createNotification({ recipientUserId: userId, type: `billing_${n.type}`, title: n.title, body: n.body, url });
  } catch (err) {
    console.error("[billing-notify] bell failed", err);
  }
  if (!featureEnabled("BILLING_EMAILS")) return;
  try {
    const u = await prisma.users.findUnique({ where: { id: userId }, select: { email: true } });
    if (!u?.email) return;
    const origin = siteOrigin().replace(/\/$/, "");
    const link = url.startsWith("http") ? url : `${origin}${url}`;
    const cta = n.ctaLabel ?? "View membership";
    const text = `${n.title}\n\n${n.lines.join("\n")}\n\n${cta}: ${link}\n\n— Pashtun Nikah`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0f0d0e;font-size:18px;margin:0 0 12px">${escapeHtml(n.title)}</h2>
        ${n.lines.map((l) => `<p style="color:#3f3b3c;font-size:14px;line-height:1.6;margin:0 0 8px">${escapeHtml(l)}</p>`).join("")}
        <a href="${link}" style="display:inline-block;margin-top:14px;background:#aa1945;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:999px">${escapeHtml(cta)}</a>
      </div>`;
    await sendMail({ to: u.email, subject: n.title, text, html });
  } catch (err) {
    console.error("[billing-notify] email failed", err);
  }
}

export function money(pence: number | null | undefined, currency = "gbp") {
  const sym = currency.toLowerCase() === "gbp" ? "£" : `${currency.toUpperCase()} `;
  return `${sym}${((pence ?? 0) / 100).toFixed(2)}`;
}

export function fmtDay(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/**
 * What a member did between two moments — for judging a refund request. Counts only: no
 * message text, no names of who they talked to.
 */
export async function usageBetween(userId: bigint, from: Date, to: Date) {
  await ensureBillingSchema();
  const rows = await prisma.$queryRaw<
    {
      tokens_spent: bigint;
      requests_sent: bigint;
      conversations: bigint;
      messages_sent: bigint;
      advanced_filter: bigint;
      ai_insight: bigint;
    }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM token_spends WHERE user_id = ${userId} AND created_at BETWEEN ${from} AND ${to}) AS tokens_spent,
      (SELECT COUNT(*) FROM match_requests WHERE sender_id = ${userId} AND created_at BETWEEN ${from} AND ${to}) AS requests_sent,
      (SELECT COUNT(*) FROM match_requests WHERE status IN ('accepted', 'ended')
         AND (sender_id = ${userId} OR receiver_id = ${userId}) AND updated_at BETWEEN ${from} AND ${to}) AS conversations,
      (SELECT COUNT(*) FROM messages WHERE sender_id = ${userId} AND created_at BETWEEN ${from} AND ${to}) AS messages_sent,
      (SELECT COUNT(*) FROM member_usage_events WHERE user_id = ${userId} AND kind = 'advanced_filter' AND created_at BETWEEN ${from} AND ${to}) AS advanced_filter,
      (SELECT COUNT(*) FROM member_usage_events WHERE user_id = ${userId} AND kind = 'ai_insight' AND created_at BETWEEN ${from} AND ${to}) AS ai_insight
  `;
  const r = rows[0];
  return {
    tokensSpent: Number(r?.tokens_spent ?? 0),
    requestsSent: Number(r?.requests_sent ?? 0),
    conversations: Number(r?.conversations ?? 0),
    messagesSent: Number(r?.messages_sent ?? 0),
    advancedFilter: Number(r?.advanced_filter ?? 0),
    aiInsight: Number(r?.ai_insight ?? 0),
  };
}

function bigintSafe(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
