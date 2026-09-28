import { NextResponse } from "next/server";
import { broadcastChat } from "@/lib/chat-broadcast";
import { sendPushNotification } from "@/lib/push/server";
import { readSignedInternal } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/** A03: an admin warned this member — push + bell, and any open PN tab shows the warning now. */
export async function POST(req: Request) {
  const signed = await readSignedInternal(req);
  if (!signed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, status: warningId } = signed;
  await sendPushNotification(BigInt(userId), {
    // No warning text in the push — it can show on a locked screen. It's read inside PN.
    title: "A message from the Pashtun Nikah team",
    body: "Please open Pashtun Nikah to read it.",
    url: "/settings#warnings",
    tag: `member-warning-${warningId}`,
    type: "system",
  }).catch((err) => console.error("[push] warning notification failed", err));
  broadcastChat("account:warning", [`user:${userId}`], { warningId });
  return NextResponse.json({ ok: true });
}
