import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmailCode, verifyEmailCode } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** POST { action: "verify", code } | { action: "resend" } — the signed-in member's own email. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const userId = BigInt(session.userId);
  const body = (await req.json().catch(() => ({}))) as { action?: string; code?: string };
  if (!(await rateLimit(`email-code:${session.userId}`, 15, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }
  const r = body.action === "resend" ? await sendEmailCode(userId) : await verifyEmailCode(userId, String(body.code ?? ""));
  if (!r.ok) {
    return NextResponse.json({ error: r.error, code: r.code, retryAfter: r.retryAfter }, { status: r.code === "cooldown" ? 429 : 400 });
  }
  return NextResponse.json({ ok: true });
}
