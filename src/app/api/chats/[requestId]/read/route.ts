import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertMatchParticipant, markThreadRead } from "@/lib/chat";
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
  const match = await assertMatchParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const count = await markThreadRead(requestId, userId);
  if (count > 0) {
    broadcastChat("messages:read", [`thread:${raw}`], { requestId: raw, readerId: session.userId });
  }
  return NextResponse.json({ ok: true, count });
}
