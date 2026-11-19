import { NextResponse } from "next/server";
import { RESEND_COOLDOWN_S, whatsappVerifyEnabled } from "@/lib/whatsapp-verify";

export const dynamic = "force-dynamic";

/** Whether WhatsApp verification is switched on (Twilio env vars present) — no secrets exposed. */
export async function GET() {
  return NextResponse.json({ enabled: whatsappVerifyEnabled(), resendCooldown: RESEND_COOLDOWN_S });
}
