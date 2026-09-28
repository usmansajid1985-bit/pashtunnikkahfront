import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleRequests } from "@/lib/matches";
import { recordCreditChange } from "@/lib/credit-ledger";
import { broadcastChat } from "@/lib/chat-broadcast";
import { sendPushNotification } from "@/lib/push/server";
import { profileCodeOf } from "@/lib/notifications";
import { maybeSendActivityEmail } from "@/lib/notification-email";
import {
  allowsPrivateChat,
  loadWaliContact,
  resolveModeForMatch,
} from "@/lib/communication";

export const dynamic = "force-dynamic";

/** Q03/Q05: both members' Requests lists, badges and open tabs update without a refresh. */
function notifyRequestChange(
  match: { id: bigint; sender_id: bigint; receiver_id: bigint },
  status: "accepted" | "declined" | "cancelled",
  fromCode?: string
) {
  broadcastChat("request:update", [`user:${match.sender_id.toString()}`, `user:${match.receiver_id.toString()}`], {
    requestId: match.id.toString(),
    status,
    fromCode,
  });
}

/** The request was already actioned elsewhere (another tab/device) — report its real state. */
async function staleResponse(id: bigint) {
  const current = await prisma.match_requests.findUnique({ where: { id }, select: { status: true } });
  const status = current?.status ?? "unavailable";
  return NextResponse.json(
    {
      error: `This request has already been ${status === "cancelled" ? "withdrawn" : status}. Refresh to see the latest.`,
      code: "stale_request",
      status,
    },
    { status: 409 }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await expireStaleRequests();

  const { id: raw } = await params;
  const id = BigInt(raw);
  const me = BigInt(session.userId);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "accept").toLowerCase();

  const match = await prisma.match_requests.findUnique({ where: { id } });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "accept") {
    if (match.receiver_id !== me) {
      return NextResponse.json({ error: "Only the recipient can accept" }, { status: 403 });
    }
    if (match.status !== "pending") {
      return NextResponse.json({ error: `Cannot accept a ${match.status} request` }, { status: 400 });
    }

    // PN-BACKEND-002: accepting is a relationship-continuing action — the same gate as sending.
    // Declining/withdrawing are left ungated; those are self-protective, not relationship-forming.
    const { isProfileApproved } = await import("@/lib/approval");
    if (!(await isProfileApproved(me))) {
      return NextResponse.json(
        { error: "Your profile must be approved before you can accept a request.", code: "profile_pending" },
        { status: 403 }
      );
    }

    const mode = await resolveModeForMatch(match.sender_id, match.receiver_id);
    // Conditional on still being pending, so a stale tab can't accept a request another tab
    // already declined/withdrew (K05/F03).
    const accepted = await prisma.match_requests.updateMany({
      where: { id, status: "pending" },
      data: {
        status: "accepted",
        accepted_at: new Date(),
        communication_mode: mode,
        photo_shared: false,
        photo_shared_at: null,
        updated_at: new Date(),
      },
    });
    if (accepted.count === 0) return staleResponse(id);

    const accepterCode = await profileCodeOf(match.receiver_id);
    notifyRequestChange(match, "accepted", accepterCode);
    void maybeSendActivityEmail({
      userId: match.sender_id,
      kind: "request_accepted",
      heading: `${accepterCode} accepted your match request`,
      lines: ["You can now start a conversation on Pashtun Nikah."],
      ctaLabel: "Open conversation",
      ctaUrl: `/chats/${id}`,
    });
    void sendPushNotification(match.sender_id, {
      title: `${accepterCode} accepted your match request`,
      body: "You can now begin your conversation.",
      url: `/chats/${id}`,
      tag: `match-${id}`,
      type: "request_accepted",
      actorUserId: match.receiver_id,
      relatedRequestId: id,
    }).catch((err) => console.error("[push] match-accepted notification failed", err));

    if (!allowsPrivateChat(mode)) {
      // Identify female for wali contact
      const profiles = await prisma.profiles.findMany({
        where: { user_id: { in: [match.sender_id, match.receiver_id] } },
        select: { user_id: true, gender: true },
      });
      const female = profiles.find((p) => (p.gender || "").toLowerCase().startsWith("f"));
      const wali = female ? await loadWaliContact(female.user_id) : null;
      return NextResponse.json({
        ok: true,
        status: "accepted",
        requestId: raw,
        communicationMode: mode,
        privateChat: false,
        wali,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "accepted",
      requestId: raw,
      communicationMode: mode,
      privateChat: true,
    });
  }

  if (action === "decline") {
    if (match.receiver_id !== me) {
      return NextResponse.json({ error: "Only the recipient can decline" }, { status: 403 });
    }
    if (match.status !== "pending") return staleResponse(id);
    const declined = await prisma.match_requests.updateMany({
      where: { id, status: "pending" },
      data: { status: "declined", updated_at: new Date() },
    });
    if (declined.count === 0) return staleResponse(id);
    notifyRequestChange(match, "declined");
    return NextResponse.json({ ok: true, status: "declined", requestId: raw });
  }

  if (action === "withdraw") {
    if (match.sender_id !== me) {
      return NextResponse.json({ error: "Only the sender can withdraw" }, { status: 403 });
    }
    if (match.status !== "pending") return staleResponse(id);
    // The pending→cancelled transition and the token refund happen together, and only the
    // request that wins the transition refunds — so a double-tap can't refund twice (F01).
    const refund = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.match_requests.updateMany({
        where: { id, status: "pending" },
        data: { status: "cancelled", updated_at: new Date() },
      });
      if (cancelled.count === 0) return null;
      const user = await tx.users.update({
        where: { id: me },
        data: { requests_remaining: { increment: 1 }, updated_at: new Date() },
        select: { requests_remaining: true },
      });
      return user.requests_remaining ?? 1;
    });
    if (refund == null) return staleResponse(id);
    notifyRequestChange(match, "cancelled");
    await recordCreditChange({
      userId: me,
      amount: 1,
      balanceType: "monthly",
      reason: "request_withdrawn_refund",
      previousBalance: refund - 1,
      newBalance: refund,
      relatedRequestId: id,
      idempotencyKey: `withdraw-refund-${id}`,
    }).catch((err) => console.error("[credits] withdraw refund ledger entry failed", err));
    return NextResponse.json({ ok: true, status: "cancelled", requestId: raw, creditsRemaining: refund });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
