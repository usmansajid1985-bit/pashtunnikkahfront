import { NextResponse } from "next/server";
import { toE164 } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { checkWhatsAppCode, issuePhoneProof, looksLikeBot, requestIp } from "@/lib/whatsapp-verify";

export const dynamic = "force-dynamic";

/**
 * POST { phoneIso, phone, code } → checks the code with Twilio. Only on status "approved" does it
 * return a short-lived signed proof for that exact number, which account creation requires.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phoneIso?: string; phone?: string; code?: string; website?: string };
  if (looksLikeBot(req, body)) return NextResponse.json({ error: "Request blocked." }, { status: 400 });
  const ip = requestIp(req);
  if (!(await rateLimit(`wa-check:${ip ?? "?"}`, 12, 60_000))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment.", code: "burst" }, { status: 429 });
  }
  const phone = toE164(String(body.phoneIso ?? ""), String(body.phone ?? ""));
  if (!phone) {
    return NextResponse.json({ error: "That number doesn't look right.", code: "invalid_number" }, { status: 400 });
  }
  const code = String(body.code ?? "").replace(/\D/g, "");
  const r = await checkWhatsAppCode(phone, code, ip);
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ ok: true, phone, proof: issuePhoneProof(phone) });
}
