import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { siteOrigin } from "@/lib/site-url";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";

/**
 * Email is the backup layer (spec §16). Delivery logic:
 *   - user active in PN            → in-app only, no email
 *   - away + push subscribed       → push covers it, no email
 *   - away + no working push       → send the email
 * Plus a single unread-message reminder 12–24h later regardless of push.
 * Never email for profile views / saves.
 */

const AWAY_MINUTES = 15;

type EmailKind = "new_request" | "request_accepted" | "new_message" | "message_reminder";

const KIND_PREF_COLUMN: Record<Exclude<EmailKind, "message_reminder">, string> = {
  new_request: "email_new_request",
  request_accepted: "email_match",
  new_message: "email_new_message",
};

async function recipientEmail(userId: bigint): Promise<string | null> {
  const [u, p] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId }, select: { email: true, last_seen_at: true } }).catch(() => null),
    prisma.profiles.findUnique({ where: { user_id: userId }, select: { email: true } }).catch(() => null),
  ]);
  return (u?.email || p?.email || "").trim() || null;
}

async function isAway(userId: bigint): Promise<boolean> {
  const u = await prisma.users
    .findUnique({ where: { id: userId }, select: { last_seen_at: true } })
    .catch(() => null);
  if (!u?.last_seen_at) return true;
  return Date.now() - u.last_seen_at.getTime() > AWAY_MINUTES * 60 * 1000;
}

async function hasWorkingPush(userId: bigint): Promise<boolean> {
  const [prefRows, deviceCount] = await Promise.all([
    prisma.$queryRaw<{ push_enabled: boolean }[]>`
      SELECT push_enabled FROM notification_preferences WHERE user_id = ${userId} LIMIT 1
    `.catch(() => []),
    prisma.push_subscriptions.count({ where: { user_id: userId } }).catch(() => 0),
  ]);
  const pushEnabled = prefRows[0]?.push_enabled !== false;
  return pushEnabled && deviceCount > 0;
}

async function emailPrefOn(userId: bigint, kind: Exclude<EmailKind, "message_reminder">): Promise<boolean> {
  const col = KIND_PREF_COLUMN[kind];
  const rows = await prisma.$queryRawUnsafe<Record<string, boolean>[]>(
    `SELECT ${col} AS v FROM notification_preferences WHERE user_id = $1 LIMIT 1`,
    userId
  ).catch(() => []);
  return rows[0]?.v !== false;
}

function shell(heading: string, lines: string[], ctaLabel: string, ctaUrl: string) {
  const origin = siteOrigin().replace(/\/$/, "");
  const url = ctaUrl.startsWith("http") ? ctaUrl : `${origin}${ctaUrl}`;
  const text = `${heading}\n\n${lines.join("\n")}\n\n${ctaLabel}: ${url}\n\n— Pashtun Nikah`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0f0d0e;font-size:18px;margin:0 0 12px">${heading}</h2>
      ${lines.map((l) => `<p style="color:#3f3b3c;font-size:14px;line-height:1.6;margin:0 0 8px">${l}</p>`).join("")}
      <a href="${url}" style="display:inline-block;margin-top:14px;background:#aa1945;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:999px">${ctaLabel}</a>
      <p style="color:#9b9698;font-size:12px;margin-top:20px">You can change what you're emailed about in Settings → Notifications.</p>
    </div>`;
  return { text, html };
}

/**
 * Fire-and-forget from an emitter. Decides internally whether an email is warranted.
 * `groupKey` (for messages) makes it send at most one email per unread conversation.
 */
export async function maybeSendActivityEmail(opts: {
  userId: bigint;
  kind: Exclude<EmailKind, "message_reminder">;
  heading: string;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
  groupKey?: string;
}): Promise<void> {
  try {
    await ensureNotificationsSchema();

    if (!(await emailPrefOn(opts.userId, opts.kind))) return;
    if (!(await isAway(opts.userId))) return; // active in PN — in-app is enough
    if (await hasWorkingPush(opts.userId)) return; // push already covers it

    if (opts.groupKey) {
      const row = await prisma.notifications.findFirst({
        where: { recipient_user_id: opts.userId, group_key: opts.groupKey },
        select: { id: true, email_sent_at: true },
      });
      if (row?.email_sent_at) return; // already emailed this conversation
      if (row) {
        await prisma.notifications.update({
          where: { id: row.id },
          data: { email_sent_at: new Date() },
        });
      }
    }

    const email = await recipientEmail(opts.userId);
    if (!email) return;

    const { text, html } = shell(opts.heading, opts.lines, opts.ctaLabel, opts.ctaUrl);
    await sendMail({ to: email, subject: opts.heading, text, html });
  } catch (err) {
    console.error("[notification-email] send failed", err);
  }
}

/**
 * Cron: one reminder per still-unread conversation, 12–24h after the message notification,
 * only if no email has gone out for it yet (spec §16).
 */
export async function processUnreadMessageReminders(): Promise<{ sent: number }> {
  await ensureNotificationsSchema();
  const now = Date.now();
  const from = new Date(now - 24 * 60 * 60 * 1000);
  const to = new Date(now - 12 * 60 * 60 * 1000);

  const rows = await prisma.notifications.findMany({
    where: {
      type: "message",
      read_at: null,
      email_sent_at: null,
      created_at: { gte: from, lte: to },
      group_key: { not: null },
    },
    take: 200,
  });

  let sent = 0;
  for (const n of rows) {
    const email = await recipientEmail(n.recipient_user_id);
    if (!email) continue;
    if (!(await emailPrefOn(n.recipient_user_id, "new_message"))) continue;

    const { text, html } = shell(
      "You have an unread message",
      [n.title, "Open Pashtun Nikah to reply."],
      "Open messages",
      n.url ?? "/chats"
    );
    const res = await sendMail({ to: email, subject: "You have an unread message on Pashtun Nikah", text, html });
    if (res.ok) {
      await prisma.notifications.update({
        where: { id: n.id },
        data: { email_sent_at: new Date() },
      });
      sent++;
    }
  }
  return { sent };
}
