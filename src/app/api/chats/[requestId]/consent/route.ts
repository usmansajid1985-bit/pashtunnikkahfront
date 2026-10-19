import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertMatchParticipant } from "@/lib/chat";
import { saveChatConsent } from "@/lib/chat-consent";

export const dynamic = "force-dynamic";

/** The member pressed "I understand" on the chat guidelines prompt — remembered on every device. */
export async function POST(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { requestId: raw } = await params;
  if (!/^\d+$/.test(raw)) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  const userId = BigInt(session.userId);
  const match = await assertMatchParticipant(BigInt(raw), userId);
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  await saveChatConsent(match, userId);
  return NextResponse.json({ ok: true });
}
