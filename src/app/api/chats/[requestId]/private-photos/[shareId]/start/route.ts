import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, peerUserId } from "@/lib/chat";
import { getViewerPhotos, startViewing, VIEW_DURATION_SEC } from "@/lib/private-photos";
import { broadcastChat } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string; shareId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw, shareId: rawShareId } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);

  try {
    const share = await startViewing(BigInt(rawShareId), userId);
    const match = await assertAcceptedParticipant(requestId, userId);
    if (match) {
      const peerId = await peerUserId(match, userId);
      broadcastChat(
        "private-photo:update",
        [`thread:${raw}`, `user:${peerId.toString()}`],
        { requestId: raw, fromUserId: session.userId }
      );
    }
    // Hand back the viewer payload too, so the client can open the gallery without a second
    // round-trip while the clock is already running.
    const viewer = await getViewerPhotos({ shareId: share.id, recipientId: userId, requestId }).catch(() => null);
    return NextResponse.json({
      ok: true,
      expiresAt: share.expires_at?.toISOString() ?? null,
      durationSec: VIEW_DURATION_SEC,
      viewer,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start viewing" },
      { status: 400 }
    );
  }
}
