import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, createContactCardMessage, peerUserId } from "@/lib/chat";
import { broadcastChat } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const match = await assertAcceptedParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const receiverId = await peerUserId(match, userId);

  try {
    const message = await createContactCardMessage({ requestId, senderId: userId, receiverId });
    broadcastChat("message:new", [`thread:${raw}`], message);
    broadcastChat("inbox:update", [`user:${receiverId.toString()}`], {
      requestId: raw,
      lastMessage: message.body,
      lastAt: message.createdAt,
      fromUserId: session.userId,
    });
    return NextResponse.json({ message });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send contact card" },
      { status: 400 }
    );
  }
}
