import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { looksLikeBot, requestIp, sendWhatsAppCode } from "@/lib/whatsapp-verify";

export const dynamic = "force-dynamic";

/** POST { phoneIso, phone } → sends a 6-digit code to that number over WhatsApp (never SMS). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phoneIso?: string; phone?: string; website?: string };
  if (looksLikeBot(req, body)) return NextResponse.json({ error: "Request blocked." }, { status: 400 });
  const ip = requestIp(req);
  // Fast per-instance burst guard on top of the database limits.
  if (!(await rateLimit(`wa-send:${ip ?? "?"}`, 6, 60_000))) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment.", code: "burst" }, { status: 429 });
  }
  const phone = toE164(String(body.phoneIso ?? ""), String(body.phone ?? ""));
  if (!phone) {
    return NextResponse.json({ error: "That number doesn't look right. Please check it and try again.", code: "invalid_number" }, { status: 400 });
  }
  const r = await sendWhatsAppCode(phone, ip);
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code, retryAfter: r.retryAfter }, { status: r.status });
  return NextResponse.json({ ok: true, phone, retryAfter: r.retryAfter });
}
