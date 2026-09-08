import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertAcceptedParticipant,
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
import { processWaliReminders } from "@/lib/wali-reminders";
import { broadcastChat } from "@/lib/chat-broadcast";
import { threadTopic } from "@/lib/realtime-topics";

export const dynamic = "force-dynamic";

// Newest-first paging: the initial load returns the last PAGE_SIZE messages; the client
// asks for older ones with ?before=<oldest message id it holds> as the user scrolls up.
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 60;

async function loadMessagePage(requestId: bigint, before: bigint | null, limit: number) {
  const desc = await prisma.messages.findMany({
    where: {
      request_id: requestId,
      ...(before ? { id: { lt: before } } : {}),
    },
    orderBy: { id: "desc" },
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

  const messages = rows.map((m) =>
    serializeMessage(
      m,
      m.reply_to_id ? quoteMap.get(m.reply_to_id.toString()) ?? null : null,
      undefined,
      reactionsMap.get(m.id.toString()) ?? []
    )
  );
  return { messages, hasMore };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const req = await assertMatchParticipant(requestId, userId);
  if (!req) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

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

  // "before" requests are just older-message pages — skip the heavy peer/profile payload.
  if (before !== null) {
    const meta = await threadMetaFor(req, userId);
    if (!meta.privateChat) return NextResponse.json({ messages: [], hasMore: false });
    const page = await loadMessagePage(requestId, before, limit);
    return NextResponse.json(page);
  }

  void processWaliReminders(5).catch(() => undefined);

  const peerId = await peerUserId(req, userId);
  const [peer, peerProfile] = await Promise.all([loadPeer(peerId), loadPeerProfileView(peerId)]);
  if (!peer) return NextResponse.json({ error: "Peer not found" }, { status: 404 });

  const meta = await threadMetaFor(req, userId, { withWaliContact: true });

  const { messages, hasMore } = meta.privateChat
    ? await loadMessagePage(requestId, null, limit)
    : { messages: [] as ReturnType<typeof serializeMessage>[], hasMore: false };

  return NextResponse.json({
    hasMore,
    requestId: requestId.toString(),
    userId: session.userId,
    realtimeTopic: threadTopic(requestId.toString()),
    peer,
    peerProfile,
    messages,
    matchStatus: req.status,
    matchEnded,
    endedAt: req.ended_at?.toISOString() ?? null,
    endReason: req.end_reason ?? null,
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
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

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
    });
    const dto = { ...message, clientId };
    broadcastChat("message:new", [`thread:${raw}`], dto);
    broadcastChat("inbox:update", [`user:${receiverId.toString()}`], {
      requestId: raw,
      lastMessage: dto.body,
      lastAt: dto.createdAt,
      fromUserId: session.userId,
    });
    return NextResponse.json({ message: dto });
  } catch (e) {
    if (e instanceof ChatBlockedError) {
      return NextResponse.json(
        { error: e.message, warning: true },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send" },
      { status: 400 }
    );
  }
}
