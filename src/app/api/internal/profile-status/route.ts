import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { broadcastBrowseVisibility, broadcastChat } from "@/lib/chat-broadcast";
import { sendPushNotification } from "@/lib/push/server";

export const dynamic = "force-dynamic";

const MAX_SKEW_MS = 5 * 60 * 1000;

/** Admin and web share INTERNAL_API_SECRET; the admin signs `${userId}.${status}.${ts}`. */
function validSignature(userId: string, status: string, ts: string, signature: string) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${userId}.${status}.${ts}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * N08: the admin app calls this right after it changes a member's profile status. Approval sends
 * the push + bell notification (deep link to Overview); every change is broadcast on the member's
 * live channel so an open PN tab updates without logging out and back in.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const status = String(body.status ?? "");
  const ts = String(body.ts ?? "");
  if (!/^\d+$/.test(userId) || !status || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!validSignature(userId, status, ts, req.headers.get("x-pn-signature") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (status === "approved") {
    await sendPushNotification(BigInt(userId), {
      title: "Your profile is approved",
      body: "You can now browse and send Match Requests.",
      url: "/dashboard",
      tag: `profile-approved-${userId}`,
      type: "profile_status",
    }).catch((err) => console.error("[push] approval notification failed", err));
  }
  broadcastChat("account:status", [`user:${userId}`], { status });
  // Approved profiles appear in Browse; suspended/rejected ones leave it — live for everyone.
  if (status === "approved") broadcastBrowseVisibility(userId, true);
  else if (status === "suspended" || status === "rejected") broadcastBrowseVisibility(userId, false);
  return NextResponse.json({ ok: true });
}
