import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleRequests, findRelation, nextMatchRequestId, withdrawCooldownBlocked } from "@/lib/matches";
import { getPlanSettings } from "@/lib/plan-settings";
import { recordCreditChange } from "@/lib/credit-ledger";
import { maybeRenewMonthlyCredits } from "@/lib/credit-renewal";
import { features } from "@/lib/feature-flags";
import { rateLimit } from "@/lib/rate-limit";
import { consumeRematchToken, findPriorEndedMatch, maybeRenewRematchTokens } from "@/lib/rematch-tokens";
import { sendPushNotification } from "@/lib/push/server";
import {
  allowsPrivateChat,
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
  const introMessage = introMessageRaw ? introMessageRaw.slice(0, 250) : null;
  const isRematchRequest = body.rematch === true;

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

  async function acceptMatch(matchId: bigint, senderId: bigint, receiverId: bigint) {
    const mode = await resolveModeForMatch(senderId, receiverId);
    await prisma.match_requests.update({
      where: { id: matchId },
      data: {
        status: "accepted",
        communication_mode: mode,
        photo_shared: false,
        photo_shared_at: null,
        updated_at: new Date(),
      },
    });
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

    void sendPushNotification(senderId, {
      title: "Pashtun Nikah",
      body: "Your Introduction has been accepted. You can now begin your conversation.",
      url: `/chats/${matchId}`,
      tag: `match-${matchId}`,
      type: "match",
      relatedRequestId: matchId,
    }).catch((err) => console.error("[push] match-accepted notification failed", err));

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
        privateChat: allowsPrivateChat(effectiveMode(mode)),
        message: "Already matched",
      });
    }
    if (status === "pending") {
      if (existing.receiver_id === me) {
        const result = await acceptMatch(existing.id, existing.sender_id, existing.receiver_id);
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
        error: "Verify your email before sending introductions. Check your inbox or resend from Settings.",
        code: "email_unverified",
      },
      { status: 403 }
    );
  }

  await maybeRenewMonthlyCredits(me);
  await maybeRenewRematchTokens(me);

  const priorEnded = await findPriorEndedMatch(me, peerUserId);
  const needsRematchToken = Boolean(priorEnded) && features.rematch();
  if (needsRematchToken) {
    if (!isRematchRequest) {
      return NextResponse.json(
        {
          error: "This Introduction requires a rematch token after a previous match ended.",
          code: "rematch_required",
          priorRequestId: priorEnded!.id.toString(),
        },
        { status: 409 }
      );
    }
    const rematch = await consumeRematchToken(me, priorEnded!.id);
    if (!rematch.ok) {
      return NextResponse.json({ error: rematch.error, code: "no_rematch_tokens" }, { status: 402 });
    }
  }

  const cooldown = await withdrawCooldownBlocked(me, peerUserId);
  if (cooldown.blocked) {
    return NextResponse.json({ error: cooldown.message }, { status: 429 });
  }

  if (introMessage) {
    const { filterMessageBody } = await import("@/lib/moderation");
    const screened = filterMessageBody(introMessage);
    if (screened.flagged || screened.reason) {
      return NextResponse.json(
        {
          error:
            "Your introduction message cannot include phone numbers, emails, or social links. Keep it brief and respectful.",
        },
        { status: 400 }
      );
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
      { error: "No match credits left. Upgrade to Gold or wait for a top-up." },
      { status: 402 }
    );
  }

  const pendingCount = await prisma.match_requests.count({
    where: { sender_id: me, status: "pending" },
  });
  if (pendingCount >= settings.pendingRequestLimit) {
    return NextResponse.json(
      {
        error: `You currently have ${pendingCount} pending Introductions. Wait for a response before sending another.`,
      },
      { status: 429 }
    );
  }

  const id = await nextMatchRequestId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.requestExpiryDays * 24 * 60 * 60 * 1000);
  const newBalance = credits - 1;

  const created = await prisma.$transaction(async (tx) => {
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
    if (priorEnded && features.rematch()) {
      await tx.$executeRaw`UPDATE match_requests SET prior_match_id = ${priorEnded.id} WHERE id = ${id}`;
    }
    await tx.users.update({
      where: { id: me },
      data: { requests_remaining: newBalance, updated_at: now },
    });
    return row;
  });

  await recordCreditChange({
    userId: me,
    amount: -1,
    balanceType: "monthly",
    reason: "request_sent",
    previousBalance: credits,
    newBalance,
    relatedRequestId: created.id,
  });

  // Privacy-safe: no sender name or intro text in the payload — it can surface on a locked phone.
  void sendPushNotification(peerUserId, {
    title: "Pashtun Nikah",
    body: "You have a new Introduction request.",
    url: "/requests",
    tag: `request-${created.id}`,
    type: "match",
    relatedRequestId: created.id,
  }).catch((err) => console.error("[push] introduction-request notification failed", err));

  return NextResponse.json({
    ok: true,
    status: "pending",
    requestId: created.id.toString(),
    message: "Request sent",
    creditsRemaining: newBalance,
  });
}

function effectiveMode(mode: string) {
  const m = mode.toLowerCase();
  if (m === "wali_only") return "wali_only" as const;
  if (m === "wali_oversight") return "wali_oversight" as const;
  return "standard" as const;
}
