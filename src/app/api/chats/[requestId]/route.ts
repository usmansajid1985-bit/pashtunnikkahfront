import { NextResponse, after } from "next/server";
import { hasChatConsent } from "@/lib/chat-consent";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertAcceptedParticipant,
  conversationRows,
  chatAccessError,
  assertMatchParticipant,
  createMessage,
  getReactionsForMessages,
  loadPeer,
  loadPeerProfileView,
  peerUserId,
  serializeMessage,
  threadMetaFor,
} from "@/lib/chat";
import { ChatBlockedError } from "@/lib/moderation";
import { broadcastChat, broadcastToWalis } from "@/lib/chat-broadcast";
import { threadTopic } from "@/lib/realtime-topics";
import { signedPhotoUrl, saveBlurredVariantFromUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

// Newest-first paging: the initial load returns the last PAGE_SIZE messages; the client
// asks for older ones with ?before=<oldest message id it holds> as the user scrolls up.
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 60;

async function loadMessagePage(requestIds: bigint[], before: bigint | null, limit: number) {
  // Chronological by (created_at, id) — not id alone — so a message stored later with an earlier
  // time (the restored introduction) sits in its true place. `before` is still a message id: page
  // from that message's (time, id) position.
  let cursor: { created_at: Date; id: bigint } | null = null;
  if (before) {
    cursor = await prisma.messages.findFirst({
      where: { id: before, request_id: { in: requestIds } },
      select: { created_at: true, id: true },
    });
  }
  const desc = await prisma.messages.findMany({
    where: {
      request_id: { in: requestIds },
      ...(cursor
        ? {
            OR: [
              { created_at: { lt: cursor.created_at } },
              { created_at: cursor.created_at, id: { lt: cursor.id } },
            ],
          }
        : before
          ? { id: { lt: before } }
          : {}),
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = desc.length > limit;
  const rows = desc.slice(0, limit).reverse();

  const replyIds = [...new Set(rows.map((m) => m.reply_to_id).filter(Boolean))] as bigint[];
  const quoted =
    replyIds.length > 0
      ? await prisma.messages.findMany({
          where: { id: { in: replyIds } },
          select: { id: true, body: true, sender_id: true },
        })
      : [];
  const quoteMap = new Map(quoted.map((q) => [q.id.toString(), q]));
  const reactionsMap = await getReactionsForMessages(rows.map((m) => m.id));
  // C02: a message counts as delivered once its recipient has been active in the app since.
  const receiverIds = [...new Set(rows.map((m) => m.receiver_id))];
  const seenRows = receiverIds.length
    ? await prisma.users.findMany({ where: { id: { in: receiverIds } }, select: { id: true, last_seen_at: true } })
    : [];
  const lastSeen = new Map(seenRows.map((u) => [u.id.toString(), u.last_seen_at?.getTime() ?? 0]));

  const messages = rows.map((m) => ({
    ...serializeMessage(
      m,
      m.reply_to_id ? quoteMap.get(m.reply_to_id.toString()) ?? null : null,
      undefined,
      reactionsMap.get(m.id.toString()) ?? []
    ),
    delivered: m.is_read || (lastSeen.get(m.receiver_id.toString()) ?? 0) > m.created_at.getTime(),
  }));
  return { messages, hasMore };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const openedId = BigInt(raw);
  const userId = BigInt(session.userId);
  const opened = await assertMatchParticipant(openedId, userId);
  if (!opened) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  // Tweaks p1–5: any of a pair's match rows opens their ONE continuous conversation. Status, meta
  // and sending use the current row; history spans every accepted/ended row between them.
  const conv = await conversationRows(openedId);
  const req = conv?.current ?? opened;
  const requestId = req.id;
  const conversationIds = conv?.ids ?? [openedId];

  const { searchParams } = new URL(_req.url);
  let before: bigint | null = null;
  try {
    const rawBefore = searchParams.get("before");
    if (rawBefore) before = BigInt(rawBefore);
  } catch {
    before = null;
  }
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("limit")) || PAGE_SIZE)
  );

  const matchEnded = req.status === "ended";

  // Backfill: chats accepted before the intro fix lost their introduction — restore it once, with
  // its original time, the first time the conversation is opened (idempotent, cheap no-op after).
  {
    const { insertIntroMessage } = await import("@/lib/chat");
    for (const id of conversationIds) await insertIntroMessage(id).catch(() => {});
  }

  // "before" requests are just older-message pages — skip the heavy peer/profile payload.
  if (before !== null) {
    const meta = await threadMetaFor(req, userId);
    if (!meta.privateChat) return NextResponse.json({ messages: [], hasMore: false });
    const page = await loadMessagePage(conversationIds, before, limit);
    if (matchEnded) {
      page.messages = page.messages.map((m) =>
        m.type === "contact_card" && m.card && m.senderId !== session.userId
          ? { ...m, card: { ...m.card, contact: null, email: null } }
          : m
      );
    }
    return NextResponse.json(page);
  }

  const peerId = await peerUserId(req, userId);
  const [peer, peerProfile] = await Promise.all([loadPeer(peerId), loadPeerProfileView(peerId)]);
  const pendingRematch = matchEnded
    ? await prisma.match_requests.findFirst({
        where: {
          status: "pending",
          OR: [
            { sender_id: userId, receiver_id: peerId },
            { sender_id: peerId, receiver_id: userId },
          ],
        },
        select: { sender_id: true },
      })
    : null;
  const rematchPendingInfo = pendingRematch ? { byMe: pendingRematch.sender_id === userId } : null;
  if (!peer) return NextResponse.json({ error: "Peer not found" }, { status: 404 });

  const [meta, chatConsent] = await Promise.all([
    threadMetaFor(req, userId, { withWaliContact: true }),
    hasChatConsent(req, userId),
  ]);

  const { messages, hasMore } = meta.privateChat
    ? await loadMessagePage(conversationIds, null, limit)
    : { messages: [] as ReturnType<typeof serializeMessage>[], hasMore: false };

  // Never send the peer's original photo URL to a viewer who isn't cleared to see it — the
  // client only ever applies a CSS filter, which doesn't stop the real bytes being read from
  // this response. Matched-but-not-shared gets the pre-blurred derivative instead.
  if (!meta.photoVisible && peerProfile?.photoUrl && !peerProfile.photoBlurUrl) {
    const blurTargetId = peerId;
    const originalUrl = peerProfile.photoUrl;
    after(async () => {
      const blurUrl = await saveBlurredVariantFromUrl(blurTargetId, originalUrl);
      if (blurUrl) {
        await prisma.profiles
          .update({ where: { user_id: blurTargetId }, data: { photo_blur_url: blurUrl } })
          .catch(() => undefined);
      }
    });
  }
  const peerProfileSafe = peerProfile
    ? {
        ...peerProfile,
        photoUrl: meta.photoVisible
          ? peerProfile.photoUrl
            ? await signedPhotoUrl(peerProfile.photoUrl)
            : null
          : peerProfile.photoBlurUrl
            ? await signedPhotoUrl(peerProfile.photoBlurUrl)
            : null,
      }
    : null;

  // Once a match has ended, the other member no longer gets the wali's phone / email from the
  // card left in the history — only the fact that it was shared.
  const visibleMessages = matchEnded
    ? messages.map((m) =>
        m.type === "contact_card" && m.card && m.senderId !== session.userId
          ? { ...m, card: { ...m.card, contact: null, email: null } }
          : m
      )
    : messages;

  return NextResponse.json({
    hasMore,
    requestId: requestId.toString(),
    userId: session.userId,
    realtimeTopic: threadTopic(requestId.toString()),
    peer,
    peerProfile: peerProfileSafe,
    messages: visibleMessages,
    matchStatus: req.status,
    matchEnded,
    endedAt: req.ended_at?.toISOString() ?? null,
    endReason: req.end_reason ?? null,
    // N43: only the member who ended the match is offered "Request Rematch".
    endedByMe: matchEnded && req.ended_by != null && req.ended_by === userId,
    // A rematch request between the pair waiting for an answer → "Pending · Waiting for …".
    rematchPending: matchEnded ? rematchPendingInfo : null,
    chatConsent,
    ...meta,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const match = await assertAcceptedParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: await chatAccessError(userId) }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.body ?? "");
  const replyToId = body.replyToId ? BigInt(String(body.replyToId)) : null;
  const clientId = body.clientId ? String(body.clientId) : undefined;
  const receiverId = await peerUserId(match, userId);

  try {
    const message = await createMessage({
      requestId,
      senderId: userId,
      receiverId,
      body: text,
      replyToId,
      clientId,
    });
    const { duplicate, ...rest } = message;
    const dto = { ...rest, clientId };
    // A retried send of a message the server already has: just confirm it, don't re-notify.
    if (duplicate) return NextResponse.json({ message: dto });
    broadcastChat("message:new", [`thread:${raw}`], dto);
    void broadcastToWalis("message:new", requestId, dto).catch(() => {});
    broadcastChat("inbox:update", [`user:${receiverId.toString()}`], {
      requestId: raw,
      lastMessage: dto.body,
      lastAt: dto.createdAt,
      fromUserId: session.userId,
      fromCode: session.profileCode,
    });
    return NextResponse.json({ message: dto });
  } catch (e) {
    if (e instanceof ChatBlockedError) {
      return NextResponse.json(
        { error: e.message, warning: true, category: e.category },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send" },
      { status: 400 }
    );
  }
}
