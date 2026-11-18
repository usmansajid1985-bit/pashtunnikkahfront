import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";
import { waliShareForMatch } from "@/lib/private-photos";
import { assertMatchParticipant, peerUserId } from "@/lib/chat";
import { isBlockedBetween } from "@/lib/blocking";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const ward = BigInt(session.profileUserId);
  // A block between the ward and this match ends wali oversight of its photos as well.
  const req = await assertMatchParticipant(requestId, ward);
  if (!req) return NextResponse.json({ share: null });
  if (await isBlockedBetween(ward, await peerUserId(req, ward))) return NextResponse.json({ share: null });

  const share = await waliShareForMatch(requestId, ward);
  return NextResponse.json({ share });
}
