import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, peerUserId } from "@/lib/chat";
import { createShare, privatePhotoSummary } from "@/lib/private-photos";
import { broadcastChat } from "@/lib/chat-broadcast";

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

  const summary = await privatePhotoSummary(requestId, userId);
  if (!summary) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  return NextResponse.json(summary);
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

  const body = await req.json().catch(() => ({}));
  const photoIds = Array.isArray(body.photoIds) ? body.photoIds.map((id: string) => BigInt(id)) : [];

  try {
    const share = await createShare({ requestId, senderId: userId, photoIds });
    const match = await assertAcceptedParticipant(requestId, userId);
    if (match) {
      const peerId = await peerUserId(match, userId);
      broadcastChat(
        "private-photo:update",
        [`thread:${raw}`, `user:${peerId.toString()}`],
        { requestId: raw, fromUserId: session.userId }
      );
    }
    return NextResponse.json({ ok: true, shareId: share.id.toString() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not share photos" },
      { status: 400 }
    );
  }
}
