import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";

export type MatchEndReason = "user" | "admin" | "wali_handover" | "mutual";

/**
 * Move ONE pending request to expired/cancelled and give the sender their Match Token back —
 * in one transaction, and only if this call wins the pending→closed transition, so a token can
 * never be refunded twice. Returns true when this call closed (and refunded) it.
 */
export async function closePendingWithRefund(
  requestId: bigint,
  to: "expired" | "cancelled",
  reason: "request_expired_refund" | "request_blocked_refund"
): Promise<boolean> {
  const row = await prisma.match_requests.findUnique({ where: { id: requestId }, select: { sender_id: true } });
  if (!row) return false;
  const { refundTokenForRequest, withMemberTokens } = await import("@/lib/tokens");
  const closed = await withMemberTokens(row.sender_id, async (tx) => {
    const res = await tx.match_requests.updateMany({
      where: { id: requestId, status: "pending" },
      data: { status: to, updated_at: new Date() },
    });
    if (res.count === 0) return false;
    await refundTokenForRequest(tx, row.sender_id, requestId, reason);
    return true;
  });
  if (!closed) return false;
  return true;
}

/**
 * Expire overdue pending requests — each one returns the sender's Match Token, then both
 * members are told (refund first, notification second). Runs from the cron job and lazily from
 * every path that reads or acts on requests; safe to call repeatedly.
 */
export async function expireStaleRequests(): Promise<number> {
  await ensureMatchRequestsSchema();
  const stale = await prisma.match_requests.findMany({
    where: { status: "pending", expires_at: { lt: new Date() } },
    select: { id: true, sender_id: true, receiver_id: true },
    take: 200,
  });
  let expired = 0;
  for (const r of stale) {
    const closed = await closePendingWithRefund(r.id, "expired", "request_expired_refund").catch((err) => {
      console.error("[matches] expire refund failed", err);
      return false;
    });
    if (!closed) continue;
    expired++;
    const { notifyRequestExpired } = await import("@/lib/request-lifecycle");
    await notifyRequestExpired(r).catch((err) => console.error("[matches] expiry notification failed", err));
  }
  return expired;
}

export async function nextMatchRequestId() {
  try {
    const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('match_requests_id_seq') as nextval`;
    if (rows[0]?.nextval) return rows[0].nextval;
  } catch {
    /* fall through */
  }
  const max = await prisma.match_requests.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

/**
 * The request that describes this pair right now. A pair can have several rows (an old
 * expired/declined request next to the accepted one), so a live row wins over a newer closed
 * one: accepted first, then pending, else the latest row.
 */
export async function findRelation(me: bigint, peer: bigint) {
  await ensureMatchRequestsSchema();
  const rows = await prisma.match_requests.findMany({
    where: {
      OR: [
        { sender_id: me, receiver_id: peer },
        { sender_id: peer, receiver_id: me },
      ],
    },
    orderBy: { id: "desc" },
  });
  const withStatus = (s: string) => rows.find((r) => r.status.toLowerCase() === s);
  return withStatus("accepted") ?? withStatus("pending") ?? rows[0] ?? null;
}

export type MatchRelationStatus =
  | { state: "none" }
  | { state: "pending_sent"; requestId: string }
  | { state: "pending_received"; requestId: string }
  | { state: "accepted"; requestId: string }
  | { state: "declined"; requestId: string }
  | { state: "expired"; requestId: string }
  | { state: "cancelled"; requestId: string }
  | { state: "ended"; requestId: string };

export function relationStatus(
  req: { id: bigint; sender_id: bigint; receiver_id: bigint; status: string } | null,
  me: bigint
): MatchRelationStatus {
  if (!req) return { state: "none" };
  const id = req.id.toString();
  const status = req.status.toLowerCase();
  if (status === "accepted") return { state: "accepted", requestId: id };
  if (status === "pending") {
    return req.sender_id === me
      ? { state: "pending_sent", requestId: id }
      : { state: "pending_received", requestId: id };
  }
  if (status === "declined") return { state: "declined", requestId: id };
  if (status === "expired") return { state: "expired", requestId: id };
  if (status === "cancelled") return { state: "cancelled", requestId: id };
  if (status === "ended") return { state: "ended", requestId: id };
  return { state: "none" };
}

export async function endMatchRequest(opts: {
  requestId: bigint;
  endedBy: bigint;
  reason: MatchEndReason;
}) {
  await ensureMatchRequestsSchema();

  const match = await prisma.match_requests.findUnique({ where: { id: opts.requestId } });
  if (!match) throw new Error("Match not found");
  if (match.status !== "accepted") {
    throw new Error("Only active matches can be ended");
  }

  const now = new Date();
  await prisma.match_requests.update({
    where: { id: opts.requestId },
    data: {
      status: "ended",
      ended_at: now,
      ended_by: opts.endedBy,
      end_reason: opts.reason,
      updated_at: now,
    },
  });

  // Pending family request, automatic reminders and wali-contact prompts all stop with the match.
  const { cancelFamilyFlow } = await import("@/lib/family-flow");
  await cancelFamilyFlow(opts.requestId);

  return { endedAt: now, reason: opts.reason };
}
