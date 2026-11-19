import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadPeerProfileView } from "@/lib/chat";
import { isBlockedBetween } from "@/lib/blocking";
import { signedPhotoUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

/**
 * The other member's profile for the Profile tab of an open match request (Chats → Requests),
 * before it's accepted. Participants only, never across a block. Photo is the pre-blurred
 * derivative only — the original is never sent before a match + share — and no contact details.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: raw } = await params;
  let requestId: bigint;
  try {
    requestId = BigInt(raw);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const me = BigInt(session.userId);
  const req = await prisma.match_requests.findUnique({
    where: { id: requestId },
    select: { sender_id: true, receiver_id: true },
  });
  if (!req || (req.sender_id !== me && req.receiver_id !== me)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const peerId = req.sender_id === me ? req.receiver_id : req.sender_id;
  if (await isBlockedBetween(me, peerId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const view = await loadPeerProfileView(peerId);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = {
    ...view,
    // Requests are anonymous until matched: show the member ID, never the name.
    fullName: view.profileCode,
    photoUrl: view.photoBlurUrl ? await signedPhotoUrl(view.photoBlurUrl) : null,
    photoBlurUrl: null,
  };
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
}
