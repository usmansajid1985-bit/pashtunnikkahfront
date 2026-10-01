import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";
import { broadcastChat } from "@/lib/chat-broadcast";
import { sendPushNotification } from "@/lib/push/server";
import { createNotification, profileCodeOf } from "@/lib/notifications";
import { maybeSendActivityEmail, sendTokenRefundEmail } from "@/lib/notification-email";

/**
 * 7-day Match Request flow (spec "7-Day Match Request Expiry System"):
 *   Day 1  request sent, countdown starts at creation
 *   Day 3  one gentle reminder to the recipient
 *   Day 6  final reminder — about 24 hours left
 *   Day 7  automatic expiry + the sender's Match Token comes back
 */

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_AFTER_MS = 48 * HOUR_MS; // start of day 3
const REMINDER_WINDOW_MS = 48 * HOUR_MS; // a request already past day 4 skips the gentle reminder
const FINAL_REMINDER_BEFORE_MS = 24 * HOUR_MS;
const REFUND_EMAIL_AFTER_MS = 24 * HOUR_MS;

type RequestRef = { id: bigint; sender_id: bigint; receiver_id: bigint };

/**
 * Tell both members a request has expired. Call only AFTER the token refund has committed
 * (closePendingWithRefund returned true), so the notice never arrives before the balance.
 */
export async function notifyRequestExpired(req: RequestRef) {
  const [receiverCode, senderCode] = await Promise.all([
    profileCodeOf(req.receiver_id),
    profileCodeOf(req.sender_id),
  ]);

  // Both accounts drop the pending card / Accept–Decline buttons without a refresh.
  broadcastChat("request:update", [`user:${req.sender_id.toString()}`, `user:${req.receiver_id.toString()}`], {
    requestId: req.id.toString(),
    status: "expired",
    senderUserId: req.sender_id.toString(),
    receiverCode,
  });

  // Sender: bell row first (inside sendPushNotification), then push.
  const push = await sendPushNotification(req.sender_id, {
    title: "Your Match Token is back! 🎉",
    body: `Your request to ${receiverCode} expired without a response. We've returned your token, ready for your next match!`,
    inApp: {
      title: "1 Match Token refunded 🎉",
      body: `Your request to ${receiverCode} expired after 7 days without a response. Your token has been returned to your balance.`,
    },
    url: "/requests?tab=sent",
    tag: `request-refund-${req.id}`,
    type: "request_refund",
    relatedRequestId: req.id,
  }).catch((err) => {
    console.error("[requests] refund notification failed", err);
    return { delivered: 0 };
  });

  // Push unavailable → email straight away. Otherwise the 24h unacknowledged sweep covers it.
  if (push.delivered === 0) await sendRefundEmailOnce(req.sender_id, req.id, receiverCode);

  // Recipient: in-app only — no push for something they can no longer act on.
  await createNotification({
    recipientUserId: req.receiver_id,
    type: "request_expired",
    title: "Request expired",
    body: `Your pending request from ${senderCode} has expired. You can no longer accept or decline it.`,
    url: "/requests?tab=incoming",
    tag: `request-expired-${req.id}`,
    relatedRequestId: req.id,
  }).catch((err) => console.error("[requests] expiry notice failed", err));
}

/** Claim the refund notification's email slot, then send — so it goes out at most once. */
async function sendRefundEmailOnce(senderId: bigint, requestId: bigint, receiverCode: string) {
  const claimed = await prisma.notifications.updateMany({
    where: {
      recipient_user_id: senderId,
      type: "request_refund",
      related_request_id: requestId,
      email_sent_at: null,
    },
    data: { email_sent_at: new Date() },
  });
  if (claimed.count === 0) return false;
  const sent = await sendTokenRefundEmail(senderId, receiverCode);
  if (!sent) {
    // Release the claim so the next sweep can retry.
    await prisma.notifications.updateMany({
      where: { recipient_user_id: senderId, type: "request_refund", related_request_id: requestId },
      data: { email_sent_at: null },
    });
  }
  return sent;
}

/** Refund notices still unread 24h later get the email backup. */
export async function processRefundEmailBackups(limit = 100): Promise<{ sent: number }> {
  await ensureNotificationsSchema();
  const now = Date.now();
  const rows = await prisma.notifications.findMany({
    where: {
      type: "request_refund",
      read_at: null,
      email_sent_at: null,
      related_request_id: { not: null },
      created_at: { lte: new Date(now - REFUND_EMAIL_AFTER_MS), gte: new Date(now - 7 * 24 * HOUR_MS) },
    },
    select: { recipient_user_id: true, related_request_id: true },
    take: limit,
  });

  let sent = 0;
  for (const n of rows) {
    const req = await prisma.match_requests.findUnique({
      where: { id: n.related_request_id! },
      select: { receiver_id: true },
    });
    if (!req) continue;
    const code = await profileCodeOf(req.receiver_id);
    if (await sendRefundEmailOnce(n.recipient_user_id, n.related_request_id!, code)) sent++;
  }
  return { sent };
}

/**
 * Day 3 gentle reminder and day 6 "about 24 hours left" reminder to the recipient. Each is
 * claimed with a conditional UPDATE, so overlapping runs can't send the same reminder twice.
 */
export async function processRequestReminders(): Promise<{ gentle: number; final: number }> {
  await ensureMatchRequestsSchema();
  const now = Date.now();

  const final = await prisma.$queryRaw<RequestRef[]>`
    UPDATE match_requests SET final_reminder_sent_at = now()
    WHERE status = 'pending' AND final_reminder_sent_at IS NULL
      AND expires_at > ${new Date(now)}
      AND expires_at <= ${new Date(now + FINAL_REMINDER_BEFORE_MS)}
    RETURNING id, sender_id, receiver_id
  `.catch((err) => {
    console.error("[requests] final reminder claim failed", err);
    return [] as RequestRef[];
  });

  const gentle = await prisma.$queryRaw<RequestRef[]>`
    UPDATE match_requests SET reminder_sent_at = now()
    WHERE status = 'pending' AND reminder_sent_at IS NULL AND final_reminder_sent_at IS NULL
      AND created_at <= ${new Date(now - REMINDER_AFTER_MS)}
      AND created_at > ${new Date(now - REMINDER_AFTER_MS - REMINDER_WINDOW_MS)}
      AND expires_at > ${new Date(now + FINAL_REMINDER_BEFORE_MS)}
    RETURNING id, sender_id, receiver_id
  `.catch((err) => {
    console.error("[requests] reminder claim failed", err);
    return [] as RequestRef[];
  });

  for (const r of gentle) await sendReminder(r, false);
  for (const r of final) await sendReminder(r, true);
  return { gentle: gentle.length, final: final.length };
}

async function sendReminder(req: RequestRef, isFinal: boolean) {
  const senderCode = await profileCodeOf(req.sender_id);
  const title = isFinal
    ? `${senderCode}'s match request expires in about 24 hours`
    : `${senderCode} is waiting for your response`;
  const body = isFinal
    ? "Accept or decline before it expires."
    : "You have a pending match request. Open Requests to respond.";
  await sendPushNotification(req.receiver_id, {
    title,
    body,
    url: "/requests?tab=incoming",
    tag: `request-${req.id}`,
    type: "request_reminder",
    actorUserId: req.sender_id,
    relatedRequestId: req.id,
  }).catch((err) => console.error("[requests] reminder push failed", err));
  // Backup channel when the recipient has no working push (follows their email preference).
  await maybeSendActivityEmail({
    userId: req.receiver_id,
    kind: "new_request",
    heading: title,
    lines: [body],
    ctaLabel: "View request",
    ctaUrl: "/requests?tab=incoming",
  });
}

/** Everything the request flow needs on a timer. Idempotent — safe to run from several places. */
export async function runRequestLifecycleJobs() {
  const { expireStaleRequests } = await import("@/lib/matches");
  const expired = await expireStaleRequests();
  const reminders = await processRequestReminders();
  const refundEmails = await processRefundEmailBackups().catch(() => ({ sent: 0 }));
  return { expired, reminders, refundEmails };
}

const OPPORTUNISTIC_EVERY_MS = 5 * 60 * 1000;
let lastOpportunisticRun = 0;

/**
 * Keeps expiry and reminders on time between scheduled cron runs: any signed-in member's
 * activity triggers the jobs, at most once every few minutes per server instance.
 */
export async function maybeRunRequestLifecycleJobs() {
  // Local dev shares the live database but links to localhost — never notify members from it.
  if (process.env.NODE_ENV !== "production") return;
  const now = Date.now();
  if (now - lastOpportunisticRun < OPPORTUNISTIC_EVERY_MS) return;
  lastOpportunisticRun = now;
  await runRequestLifecycleJobs().catch((err) => console.error("[requests] lifecycle jobs failed", err));
}
