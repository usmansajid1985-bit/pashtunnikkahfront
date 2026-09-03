import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";

export type MatchEndReason = "user" | "admin" | "wali_handover" | "mutual";

/**
 * No cron/job runner exists yet, so expiry is applied lazily: called from every read/write
 * path that touches match_requests, this flips any stale pending row to "expired" before the
 * caller proceeds. Safe to call repeatedly — it's just a conditional UPDATE.
 */
export async function expireStaleRequests() {
  await ensureMatchRequestsSchema();
  await prisma.match_requests.updateMany({
    where: { status: "pending", expires_at: { lt: new Date() } },
    data: { status: "expired", updated_at: new Date() },
  });
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

export async function findRelation(me: bigint, peer: bigint) {
  await ensureMatchRequestsSchema();
  return prisma.match_requests.findFirst({
    where: {
      OR: [
        { sender_id: me, receiver_id: peer },
        { sender_id: peer, receiver_id: me },
      ],
    },
    orderBy: { id: "desc" },
  });
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

  return { endedAt: now, reason: opts.reason };
}

const WITHDRAW_COOLDOWN_DAYS = 30;

/** Block re-request to same person within 30 days of withdrawing a pending intro. */
export async function withdrawCooldownBlocked(
  senderId: bigint,
  receiverId: bigint
): Promise<{ blocked: boolean; message?: string }> {
  await ensureMatchRequestsSchema();
  const last = await prisma.match_requests.findFirst({
    where: {
      sender_id: senderId,
      receiver_id: receiverId,
      status: "cancelled",
    },
    orderBy: { updated_at: "desc" },
  });
  if (!last) return { blocked: false };

  const elapsed = Date.now() - last.updated_at.getTime();
  const cooldownMs = WITHDRAW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  if (elapsed >= cooldownMs) return { blocked: false };

  const daysLeft = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
  return {
    blocked: true,
    message: `You withdrew an introduction to this member recently. You can send another request in about ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
  };
}
