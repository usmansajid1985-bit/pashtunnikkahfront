import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, toggleReaction } from "@/lib/chat";
import { broadcastChat } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

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
  const messageId = body.messageId ? BigInt(String(body.messageId)) : null;
  const emoji = String(body.emoji ?? "");
  if (!messageId || !emoji) {
    return NextResponse.json({ error: "messageId and emoji are required" }, { status: 400 });
  }

  try {
    const reactions = await toggleReaction({ messageId, requestId, userId, emoji });
    broadcastChat("reaction:update", [`thread:${raw}`], {
      requestId: raw,
      messageId: messageId.toString(),
      reactions,
    });
    return NextResponse.json({ messageId: messageId.toString(), reactions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not react" },
      { status: 400 }
    );
  }
}
