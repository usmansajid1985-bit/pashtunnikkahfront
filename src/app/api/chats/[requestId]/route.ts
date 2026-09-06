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

  const matchEnded = req.status === "ended";

  void processWaliReminders(5).catch(() => undefined);

  const peerId = await peerUserId(req, userId);
  const [peer, peerProfile] = await Promise.all([loadPeer(peerId), loadPeerProfileView(peerId)]);
  if (!peer) return NextResponse.json({ error: "Peer not found" }, { status: 404 });

  const meta = await threadMetaFor(req, userId, { withWaliContact: true });

  const rows = meta.privateChat
    ? await prisma.messages.findMany({
        where: { request_id: requestId },
        orderBy: { created_at: "asc" },
        take: 400,
      })
    : [];

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

  return NextResponse.json({
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
