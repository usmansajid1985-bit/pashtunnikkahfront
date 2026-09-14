import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, peerUserId } from "@/lib/chat";
import { startViewing, VIEW_DURATION_SEC } from "@/lib/private-photos";
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
    return NextResponse.json({
      ok: true,
      expiresAt: share.expires_at?.toISOString() ?? null,
      durationSec: VIEW_DURATION_SEC,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start viewing" },
      { status: 400 }
    );
  }
}
