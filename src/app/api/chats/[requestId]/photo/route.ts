import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, peerUserId, setPhotoShared, threadMetaFor } from "@/lib/chat";
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
  const shared = Boolean(body.shared);

  try {
    await setPhotoShared(requestId, userId, shared);
    const meta = await threadMetaFor(
      { ...match, photo_shared: shared, communication_mode: match.communication_mode },
      userId
    );
    const peerId = await peerUserId(match, userId);
    const event = { requestId: raw, photoShared: shared, fromUserId: session.userId };
    broadcastChat("photo:update", [`thread:${raw}`, `user:${peerId.toString()}`], event);
    return NextResponse.json({
      ok: true,
      photoShared: shared,
      photoVisible: meta.photoVisible,
      message: shared
        ? "Your match can now view your profile photo."
        : "Your photo is hidden again.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update photo" },
      { status: 400 }
    );
  }
}
