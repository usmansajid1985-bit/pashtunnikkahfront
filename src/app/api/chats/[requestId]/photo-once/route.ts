import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { peerUserId, sendPhotoOnce, threadMetaFor } from "@/lib/chat";
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
    const updated = await sendPhotoOnce(requestId, userId);
    const meta = await threadMetaFor(updated, userId);
    const peerId = await peerUserId(updated, userId);
    const event = { requestId: raw, status: "pending" as const, fromUserId: session.userId };
    broadcastChat("photo-once:update", [`thread:${raw}`, `user:${peerId.toString()}`], event);
    return NextResponse.json({ ok: true, ...meta });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send one-time photo" },
      { status: 400 }
    );
  }
}
