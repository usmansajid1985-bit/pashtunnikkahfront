import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { siteOrigin } from "@/lib/site-url";

/** W05: what a wali link may do. (Join Conversation was dropped — W06 not needed.) */
export type WaliMode = "oversight" | "oversight_notify";
export const WALI_MODES: { value: WaliMode; label: string; help: string }[] = [
  { value: "oversight", label: "Oversight only", help: "Can read your conversations. No notifications." },
  {
    value: "oversight_notify",
    label: "Oversight + notifications",
    help: "Can read your conversations and gets an email when there's new activity (needs their email).",
  },
];
export function normalizeWaliMode(v: unknown): WaliMode {
  return v === "oversight_notify" ? "oversight_notify" : "oversight";
}

export type WaliEvent =
  | "invited"
  | "accepted"
  | "viewed_conversation"
  | "mode_changed"
  | "photo_access_granted"
  | "photo_access_withdrawn"
  | "notified"
  | "revoked";

/**
 * W09: permanent audit trail of wali activity, shown to the sister under Wali Settings. Kept
 * after a link is revoked. Never throws — logging must not break the action it records.
 */
export async function logWaliActivity(opts: {
  userId: bigint;
  linkId?: bigint | null;
  event: WaliEvent;
  detail?: string | null;
  requestId?: bigint | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO wali_activity (user_id, link_id, event, detail, request_id)
    VALUES (${opts.userId}, ${opts.linkId ?? null}, ${opts.event}, ${opts.detail ?? null}, ${opts.requestId ?? null})
  `.catch((err) => console.error("[wali-activity] log failed", err));
}

/** A wali opening a conversation is logged at most once per half hour per conversation. */
export async function logWaliConversationView(userId: bigint, linkId: bigint, requestId: bigint, detail: string) {
  const recent = await prisma.$queryRaw<{ n: number }[]>`
    SELECT 1 AS n FROM wali_activity
    WHERE link_id = ${linkId} AND request_id = ${requestId} AND event = 'viewed_conversation'
      AND created_at > NOW() - INTERVAL '30 minutes'
    LIMIT 1
  `.catch(() => []);
  if (recent.length) return;
  await logWaliActivity({ userId, linkId, event: "viewed_conversation", requestId, detail });
}

function emailShell(heading: string, lines: string[], ctaLabel: string, ctaUrl: string) {
  const text = [heading, "", ...lines, "", `${ctaLabel}: ${ctaUrl}`, "", "— Pashtun Nikah"].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f1a1c">
    <h2 style="color:#aa1945;font-size:20px">${heading}</h2>
    ${lines.map((l) => `<p style="line-height:1.5">${l}</p>`).join("")}
    <p><a href="${ctaUrl}" style="display:inline-block;background:#aa1945;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${ctaLabel}</a></p>
    <p style="color:#888;font-size:12px">Pashtun Nikah — family-first matrimony.</p></div>`;
  return { text, html };
}

/** N09: invitation sent through the channel the sister chose (email), with the private link. */
export async function sendWaliInviteEmail(opts: { to: string; waliName: string; sisterCode: string; link: string }) {
  const { text, html } = emailShell(
    `${opts.sisterCode} has invited you as her wali`,
    [
      `Assalamu alaikum ${opts.waliName},`,
      `${opts.sisterCode} has given you read-only oversight of her conversations on Pashtun Nikah.`,
      "This link is private to you — please don't share it.",
    ],
    "Open wali portal",
    opts.link
  );
  return sendMail({ to: opts.to, subject: `${opts.sisterCode} invited you as her wali — Pashtun Nikah`, text, html });
}

const NOTIFY_EVERY_MINUTES = 60;

/**
 * N09: tell every wali in "Oversight + notifications" mode about new activity in one of the
 * sister's conversations. Only active (non-revoked) links with an email; at most one email per
 * conversation per hour per wali. Never includes message text.
 */
export async function notifyWalisOfActivity(opts: {
  requestId: bigint;
  participantIds: bigint[];
  kind: "message" | "match_accepted" | "photo_shared";
}) {
  const links = await prisma.wali_links.findMany({
    where: { user_id: { in: opts.participantIds }, revoked_at: null, mode: "oversight_notify", email: { not: null } },
    select: { id: true, user_id: true, name: true, email: true, token: true },
  });
  if (links.length === 0) return;

  const codes = await prisma.profiles.findMany({
    where: { user_id: { in: opts.participantIds } },
    select: { user_id: true, profile_code: true },
  });
  const codeOf = (id: bigint) => codes.find((c) => c.user_id === id)?.profile_code ?? "a member";
  const origin = siteOrigin().replace(/\/$/, "");

  await Promise.all(
    links.map(async (l) => {
      const claimed = await prisma.$executeRaw`
        INSERT INTO wali_notify_log (link_id, request_id, last_sent_at) VALUES (${l.id}, ${opts.requestId}, NOW())
        ON CONFLICT (link_id, request_id) DO UPDATE SET last_sent_at = NOW()
        WHERE wali_notify_log.last_sent_at < NOW() - (${NOTIFY_EVERY_MINUTES} * INTERVAL '1 minute')
      `.catch(() => 0);
      if (!claimed) return; // already told about this conversation recently

      const sister = codeOf(l.user_id);
      const other = codeOf(opts.participantIds.find((id) => id !== l.user_id) ?? l.user_id);
      const what =
        opts.kind === "match_accepted"
          ? `${sister} has a new match with ${other}.`
          : opts.kind === "photo_shared"
            ? `Photos were shared in ${sister}'s conversation with ${other}.`
            : `There are new messages in ${sister}'s conversation with ${other}.`;
      const { text, html } = emailShell(
        "New activity to review",
        [`Assalamu alaikum ${l.name},`, what, "Message content is only shown inside your private wali portal."],
        "Open wali portal",
        `${origin}/wali/${l.token}`
      );
      const sent = await sendMail({ to: l.email!, subject: `New activity for ${sister} — Pashtun Nikah`, text, html }).catch(
        () => ({ ok: false })
      );
      if (sent.ok) {
        await logWaliActivity({ userId: l.user_id, linkId: l.id, event: "notified", requestId: opts.requestId, detail: what });
      }
    })
  );
}
