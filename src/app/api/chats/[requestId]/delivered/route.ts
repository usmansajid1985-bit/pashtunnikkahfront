import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertMatchParticipant } from "@/lib/chat";
import { broadcastChat } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

/** Recipient's app acknowledges it has received new messages → sender sees grey ✓✓ (C02). */
export async function POST(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { requestId: raw } = await params;
  const match = await assertMatchParticipant(BigInt(raw), BigInt(session.userId));
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  broadcastChat("messages:delivered", [`thread:${raw}`], { requestId: raw, receiverId: session.userId });
  return NextResponse.json({ ok: true });
}
