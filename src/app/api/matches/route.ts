import { NextResponse } from "next/server";
import { inBackground } from "@/lib/background";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleRequests, findRelation, nextMatchRequestId } from "@/lib/matches";
import { isBlockedBetween } from "@/lib/blocking";
import { profileCodeOf } from "@/lib/notifications";
import { maybeSendActivityEmail } from "@/lib/notification-email";
import { getPlanSettings } from "@/lib/plan-settings";
import { ensureBasicAllowance, spendToken, withMemberTokens } from "@/lib/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { findPriorEndedMatch } from "@/lib/rematch-tokens";
import { sendPushNotification } from "@/lib/push/server";
import { broadcastChat } from "@/lib/chat-broadcast";
import { introMessageProblem } from "@/lib/intro-message";
import {
  allowsPrivateChat,
  effectiveCommMode,
  loadWaliContact,
  resolveModeForMatch,
} from "@/lib/communication";

export const dynamic = "force-dynamic";


export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`matches:${session.userId}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  await expireStaleRequests();

  const body = await req.json().catch(() => ({}));
  const profileCode = String(body.profileCode ?? "").trim();
  const peerUserIdRaw = body.userId != null ? String(body.userId) : "";
  const introMessageRaw = body.introMessage != null ? String(body.introMessage).trim() : "";
  const introProblem = introMessageProblem(introMessageRaw);
  if (introProblem) {
    return NextResponse.json(
      { error: introProblem },
      { status: 400 }
    );
  }
  const introMessage = introMessageRaw || null;

  const me = BigInt(session.userId);
  let peerUserId: bigint | null = null;

  if (peerUserIdRaw) {
    peerUserId = BigInt(peerUserIdRaw);
  } else if (profileCode) {
    const profile = await prisma.profiles.findFirst({
      where: { profile_code: { equals: profileCode, mode: "insensitive" } },
      select: { user_id: true, status: true, is_hidden: true },
    });
    if (!profile || profile.status !== "approved" || profile.is_hidden) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    peerUserId = profile.user_id;
  }

  if (!peerUserId || peerUserId === me) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }

  // Mutual blocking: neither side can send (or auto-accept) a request across a block.
  if (await isBlockedBetween(me, peerUserId)) {
    return NextResponse.json({ error: "This member is not available." }, { status: 403 });
  }

  async function acceptMatch(matchId: bigint, senderId: bigint, receiverId: bigint) {
    const mode = await resolveModeForMatch(senderId, receiverId);
    const accepted = await prisma.match_requests.updateMany({
      where: { id: matchId, status: "pending" },
      data: {
        status: "accepted",
        accepted_at: new Date(),
        communication_mode: mode,
        photo_shared: false,
        photo_shared_at: null,
        updated_at: new Date(),
      },
    });
    if (accepted.count === 0) return null;
    const privateChat = allowsPrivateChat(mode);
    let wali = null;
    if (!privateChat) {
      const profiles = await prisma.profiles.findMany({
        where: { user_id: { in: [senderId, receiverId] } },
        select: { user_id: true, gender: true },
      });
      const female = profiles.find((p) => (p.gender || "").toLowerCase().startsWith("f"));
      wali = female ? await loadWaliContact(female.user_id) : null;
    }

    const accepterCode = await profileCodeOf(receiverId);
    broadcastChat("request:update", [`user:${senderId.toString()}`, `user:${receiverId.toString()}`], {
      requestId: matchId.toString(),
      status: "accepted",
      fromUserId: receiverId.toString(),
      fromCode: accepterCode,
    });
    inBackground("activity email", () => maybeSendActivityEmail({
      userId: senderId,
      kind: "request_accepted",
      heading: `${accepterCode} accepted your match request`,
      lines: ["You can now start a conversation on Pashtun Nikah."],
      ctaLabel: "Open conversation",
      ctaUrl: `/chats/${matchId}`,
    }));
    inBackground("wali activity", () => import("@/lib/wali-activity")
      .then(({ notifyWalisOfActivity }) =>
        notifyWalisOfActivity({ requestId: matchId, participantIds: [senderId, receiverId], kind: "match_accepted" })
      )
      .catch(() => {}));
    inBackground("push", () => sendPushNotification(senderId, {
      title: `${accepterCode} accepted your match request`,
      body: "You can now begin your conversation.",
      url: `/chats/${matchId}`,
      tag: `match-${matchId}`,
      type: "request_accepted",
      actorUserId: receiverId,
      relatedRequestId: matchId,
    }).catch((err) => console.error("[push] match-accepted notification failed", err)));

    return {
      ok: true as const,
      status: "accepted" as const,
      requestId: matchId.toString(),
      communicationMode: mode,
      privateChat,
      wali,
      message: privateChat
        ? "Request accepted — you can chat now"
        : "Matched — contact goes through the wali",
    };
  }

  const existing = await findRelation(me, peerUserId);
  if (existing) {
    const status = existing.status.toLowerCase();
    if (status === "accepted") {
      const mode = existing.communication_mode || "standard";
      return NextResponse.json({
        ok: true,
        status: "accepted",
        requestId: existing.id.toString(),
        communicationMode: mode,
        privateChat: allowsPrivateChat(effectiveCommMode(mode)),
        message: "Already matched",
      });
    }
    if (status === "pending") {
      if (existing.receiver_id === me) {
        const result = await acceptMatch(existing.id, existing.sender_id, existing.receiver_id);
        if (!result) {
          return NextResponse.json(
            { error: "This request has changed. Refresh to see the latest.", code: "stale_request" },
            { status: 409 }
          );
        }
        return NextResponse.json(result);
      }
      return NextResponse.json({
        ok: true,
        status: "pending",
        requestId: existing.id.toString(),
        message: "Request already sent",
      });
    }
  }

  const meUser = await prisma.users.findUnique({
    where: { id: me },
    select: { plan: true, requests_remaining: true, account_status: true, email_verified: true },
  });
  if (!meUser || meUser.account_status === "suspended") {
    return NextResponse.json({ error: "Account cannot send requests" }, { status: 403 });
  }

  if (!meUser.email_verified) {
    return NextResponse.json(
      {
        error: "Verify your email before sending requests. Check your inbox or resend from Settings.",
        code: "email_unverified",
      },
      { status: 403 }
    );
  }

  // PN-REG-004: a profile moved back to Awaiting Approval must not be able to send a new
  // request (and spend a credit) — this only checked the peer's approval status before.
  const { isProfileApproved } = await import("@/lib/approval");
  if (!(await isProfileApproved(me))) {
    return NextResponse.json(
      { error: "Your profile must be approved before you can send requests.", code: "profile_pending" },
      { status: 403 }
    );
  }

  await ensureBasicAllowance(me);

  // Q09: a rematch is just a new pending request that costs one normal Match Token — no
  // separate rematch token. A withdrawn or expired request can be sent again straight away.
  const priorEnded = await findPriorEndedMatch(me, peerUserId);
  // N53: only the member who ended the match can ask to rematch (when the PN team ended it,
  // either may). Blocked / restricted accounts are already stopped above.
  if (priorEnded?.ended_by != null && priorEnded.ended_by !== me) {
    const theirCode = (await profileCodeOf(priorEnded.ended_by)) || "This member";
    return NextResponse.json(
      {
        error: `${theirCode} ended this match, so only they can request a rematch.`,
        code: "rematch_not_allowed",
      },
      { status: 403 }
    );
  }

  if (introMessage) {
    // Same rules as chat messages: contact details, threats, sexual content and abuse are refused.
    const { inspectLeak } = await import("@/lib/chat-safety");
    const verdict = inspectLeak([introMessage]);
    if (verdict.hit) {
      const reason =
        verdict.category === "contact"
          ? "Your introduction message can't include or ask for contact details (numbers, emails, social media or other apps)."
          : "Your introduction message must be respectful. Please change it and try again.";
      return NextResponse.json({ error: reason }, { status: 400 });
    }
  }

  const refreshed = await prisma.users.findUnique({
    where: { id: me },
    select: { plan: true, requests_remaining: true },
  });

  const settings = await getPlanSettings(refreshed?.plan ?? meUser.plan);
  const credits = refreshed?.requests_remaining ?? meUser.requests_remaining ?? 0;
  if (credits <= 0) {
    return NextResponse.json(
      {
        error: "You've used all your Match Tokens. Upgrade to Gold or buy more Match Tokens to keep sending requests.",
        code: "out_of_tokens",
      },
      { status: 402 }
    );
  }

  const pendingCount = await prisma.match_requests.count({
    where: { sender_id: me, status: "pending" },
  });
  if (pendingCount >= settings.pendingRequestLimit) {
    return NextResponse.json(
      {
        error: `You currently have ${pendingCount} pending requests. Wait for a response before sending another.`,
      },
      { status: 429 }
    );
  }

  const id = await nextMatchRequestId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.requestExpiryDays * 24 * 60 * 60 * 1000);
  const OUT_OF_TOKENS = "out_of_tokens";
  let created;
  let newBalance = 0;
  try {
    // One member transaction: the request row and the token it spends commit together, and the
    // row lock stops two simultaneous sends from spending the same last token.
    created = await withMemberTokens(me, async (tx) => {
      const row = await tx.match_requests.create({
        data: {
          id,
          sender_id: me,
          receiver_id: peerUserId,
          status: "pending",
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        },
      });
      if (introMessage) {
        await tx.$executeRaw`UPDATE match_requests SET intro_message = ${introMessage} WHERE id = ${id}`;
      }
      if (priorEnded) {
        await tx.$executeRaw`UPDATE match_requests SET prior_match_id = ${priorEnded.id} WHERE id = ${id}`;
      }
      const spent = await spendToken(tx, me, id);
      if (!spent.ok) throw new Error(OUT_OF_TOKENS);
      newBalance = spent.balance;
      return row;
    });
  } catch (err) {
    if (err instanceof Error && err.message === OUT_OF_TOKENS) {
      return NextResponse.json(
        {
          error: "You've used all your Match Tokens. Upgrade to Gold or buy more Match Tokens to keep sending requests.",
          code: "out_of_tokens",
        },
        { status: 402 }
      );
    }
    throw err;
  }

  // Privacy-safe: no intro text in the payload — it can surface on a locked phone. The profile
  // code is fine (that's what the recipient sees in-app too).
  const senderCode = await profileCodeOf(me);
  inBackground("activity email", () => maybeSendActivityEmail({
    userId: peerUserId,
    kind: "new_request",
    heading: `${senderCode} sent you a match request`,
    lines: ["Open Pashtun Nikah to view their profile and respond."],
    ctaLabel: "View request",
    ctaUrl: "/requests?tab=incoming",
  }));
  broadcastChat("request:update", [`user:${peerUserId.toString()}`], {
    requestId: created.id.toString(),
    status: "pending",
    fromUserId: session.userId,
    fromCode: senderCode,
  });
  inBackground("push", () => sendPushNotification(peerUserId, {
    title: `${senderCode} sent you a match request`,
    body: "Open Requests to respond.",
    url: "/requests?tab=incoming",
    tag: `request-${created.id}`,
    type: "match",
    actorUserId: me,
    relatedRequestId: created.id,
  }).catch((err) => console.error("[push] introduction-request notification failed", err)));

  return NextResponse.json({
    ok: true,
    status: "pending",
    requestId: created.id.toString(),
    message: "Request sent",
    creditsRemaining: newBalance,
  });
}

