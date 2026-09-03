import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, consumePhotoOnce, peerUserId } from "@/lib/chat";
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

  try {
    const result = await consumePhotoOnce(requestId, userId);
    const match = await assertAcceptedParticipant(requestId, userId);
    if (match) {
      const peerId = await peerUserId(match, userId);
      const event = { requestId: raw, status: "viewed" as const, fromUserId: session.userId };
      broadcastChat("photo-once:update", [`thread:${raw}`, `user:${peerId.toString()}`], event);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not reveal photo" },
      { status: 400 }
    );
  }
}
