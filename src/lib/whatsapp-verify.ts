import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Phone verification via Twilio Verify — WhatsApp ONLY (no SMS / voice fallback is ever
 * requested). Credentials live only in server env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_VERIFY_SERVICE_SID, TWILIO_API_KEY, TWILIO_API_SECRET
 * A number counts as verified only when Twilio returns status "approved"; that result is turned
 * into a short-lived signed proof the signup/profile APIs require, so the step can't be skipped.
 */

const VERIFY_BASE = "https://verify.twilio.com/v2";
const PROOF_TTL_MS = 45 * 60_000;

/** Resend & abuse limits. */
export const RESEND_COOLDOWN_S = 60;
const MAX_SENDS_PER_PHONE_HOUR = 5;
const MAX_SENDS_PER_IP_HOUR = 10;
const MAX_CHECKS_PER_PHONE_HOUR = 10;
const MAX_CHECKS_PER_IP_HOUR = 30;

type Config = { serviceSid: string; apiKey: string; apiSecret: string };

function config(): Config | null {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  const apiKey = process.env.TWILIO_API_KEY?.trim();
  const apiSecret = process.env.TWILIO_API_SECRET?.trim();
  if (!serviceSid || !apiKey || !apiSecret) return null;
  return { serviceSid, apiKey, apiSecret };
}

/** True once the Twilio env vars are set (verification is then mandatory). */
export function whatsappVerifyEnabled(): boolean {
  return config() !== null;
}

let ensured = false;
export async function ensureWhatsAppVerifySchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS phone_verify_events (
        id BIGSERIAL PRIMARY KEY,
        phone_e164 VARCHAR(32) NOT NULL,
        ip VARCHAR(64),
        kind VARCHAR(8) NOT NULL,
        ok BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_phone_verify_events_phone ON phone_verify_events (phone_e164, kind, created_at DESC)`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_phone_verify_events_ip ON phone_verify_events (ip, kind, created_at DESC)`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`);
    ensured = true;
  } catch (err) {
    console.error("ensureWhatsAppVerifySchema", err);
  }
}

async function logEvent(phone: string, ip: string | null, kind: "send" | "check", ok: boolean) {
  await prisma
    .$executeRaw`INSERT INTO phone_verify_events (phone_e164, ip, kind, ok) VALUES (${phone}, ${ip}, ${kind}, ${ok})`
    .catch(() => undefined);
}

async function countSince(where: "phone" | "ip", value: string, kind: "send" | "check", sinceMs: number) {
  const since = new Date(Date.now() - sinceMs);
  const rows =
    where === "phone"
      ? await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*) AS n FROM phone_verify_events
          WHERE phone_e164 = ${value} AND kind = ${kind} AND created_at > ${since}`
      : await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*) AS n FROM phone_verify_events
          WHERE ip = ${value} AND kind = ${kind} AND created_at > ${since}`;
  return Number(rows[0]?.n ?? 0);
}

async function lastSendAt(phone: string): Promise<Date | null> {
  const rows = await prisma.$queryRaw<{ created_at: Date }[]>`
    SELECT created_at FROM phone_verify_events
    WHERE phone_e164 = ${phone} AND kind = 'send' AND ok = TRUE
    ORDER BY created_at DESC LIMIT 1`;
  return rows[0]?.created_at ?? null;
}

async function twilio(path: string, form: Record<string, string>, cfg: Config) {
  const res = await fetch(`${VERIFY_BASE}/Services/${cfg.serviceSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
  return { httpStatus: res.status, data };
}

export type VerifyResult =
  | { ok: true; retryAfter?: number }
  | { ok: false; error: string; code: string; retryAfter?: number; status: number };

const NOT_SET_UP: VerifyResult = {
  ok: false,
  code: "not_configured",
  error: "WhatsApp verification isn't available right now. Please try again later.",
  status: 503,
};

/** Send a six-digit code over WhatsApp. Enforces cooldown + per-phone/IP limits first. */
export async function sendWhatsAppCode(phone: string, ip: string | null): Promise<VerifyResult> {
  const cfg = config();
  if (!cfg) return NOT_SET_UP;
  await ensureWhatsAppVerifySchema();

  const last = await lastSendAt(phone);
  if (last) {
    const wait = Math.ceil((last.getTime() + RESEND_COOLDOWN_S * 1000 - Date.now()) / 1000);
    if (wait > 0) {
      return { ok: false, code: "cooldown", error: `Please wait ${wait}s before requesting another code.`, retryAfter: wait, status: 429 };
    }
  }
  const [byPhone, byIp] = await Promise.all([
    countSince("phone", phone, "send", 3600_000),
    ip ? countSince("ip", ip, "send", 3600_000) : Promise.resolve(0),
  ]);
  if (byPhone >= MAX_SENDS_PER_PHONE_HOUR || byIp >= MAX_SENDS_PER_IP_HOUR) {
    return {
      ok: false,
      code: "too_many_sends",
      error: "Too many codes have been requested. Please wait an hour and try again.",
      status: 429,
    };
  }

  // Channel is hard-coded: WhatsApp only, never SMS or voice.
  const { httpStatus, data } = await twilio("Verifications", { To: phone, Channel: "whatsapp" }, cfg);
  const ok = httpStatus >= 200 && httpStatus < 300 && (data.status === "pending" || data.status === "approved");
  await logEvent(phone, ip, "send", ok);
  if (ok) return { ok: true, retryAfter: RESEND_COOLDOWN_S };

  console.error("[whatsapp-verify] send failed", httpStatus, data.code, data.message);
  switch (data.code) {
    case 60200:
    case 21211:
    case 21614:
      return { ok: false, code: "invalid_number", error: "That number doesn't look right. Please check it and try again.", status: 400 };
    case 60203:
      return { ok: false, code: "max_sends", error: "Too many codes were sent to this number. Please wait 10 minutes and try again.", status: 429 };
    case 60410:
    case 60605:
      return { ok: false, code: "blocked", error: "We can't send a code to this number. Please use a different WhatsApp number.", status: 400 };
    case 63003:
    case 63024:
    case 60212:
    case 63016:
      return {
        ok: false,
        code: "delivery_failed",
        error: "We couldn't deliver the WhatsApp message. Make sure this number is on WhatsApp, then try again.",
        status: 502,
      };
    default:
      return {
        ok: false,
        code: "send_failed",
        error: "We couldn't send the WhatsApp code just now. Please try again in a moment.",
        status: 502,
      };
  }
}

/** Check a submitted code. Only Twilio's status "approved" counts. */
export async function checkWhatsAppCode(phone: string, code: string, ip: string | null): Promise<VerifyResult> {
  const cfg = config();
  if (!cfg) return NOT_SET_UP;
  await ensureWhatsAppVerifySchema();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, code: "bad_format", error: "Enter the 6-digit code from WhatsApp.", status: 400 };
  }
  const [byPhone, byIp] = await Promise.all([
    countSince("phone", phone, "check", 3600_000),
    ip ? countSince("ip", ip, "check", 3600_000) : Promise.resolve(0),
  ]);
  if (byPhone >= MAX_CHECKS_PER_PHONE_HOUR || byIp >= MAX_CHECKS_PER_IP_HOUR) {
    return { ok: false, code: "too_many_checks", error: "Too many attempts. Please wait an hour, then request a new code.", status: 429 };
  }

  const { httpStatus, data } = await twilio("VerificationCheck", { To: phone, Code: code }, cfg);
  const approved = httpStatus >= 200 && httpStatus < 300 && data.status === "approved";
  await logEvent(phone, ip, "check", approved);
  if (approved) return { ok: true };

  if (httpStatus >= 200 && httpStatus < 300) {
    return { ok: false, code: "wrong_code", error: "That code isn't right. Please check WhatsApp and try again.", status: 400 };
  }
  if (httpStatus === 404 || data.code === 20404) {
    return { ok: false, code: "expired", error: "This code has expired. Request a new one.", status: 410 };
  }
  if (data.code === 60202) {
    return { ok: false, code: "max_checks", error: "Too many wrong attempts. Request a new code.", status: 429 };
  }
  console.error("[whatsapp-verify] check failed", httpStatus, data.code, data.message);
  return { ok: false, code: "check_failed", error: "We couldn't check the code just now. Please try again.", status: 502 };
}

/* ---- signed proof: "this exact number was approved by Twilio, recently" ---- */

function sign(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issuePhoneProof(phone: string): string {
  const exp = Date.now() + PROOF_TTL_MS;
  return `${exp}.${sign(`wa:${phone}:${exp}`)}`;
}

export function verifyPhoneProof(phone: string, proof: unknown): boolean {
  if (typeof proof !== "string") return false;
  const [expRaw, sig] = proof.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(`wa:${phone}:${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Client IP for rate limiting (Vercel sets x-forwarded-for). */
export function requestIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

/** Basic bot/CSRF protection: same-origin browser requests only, and an empty honeypot field. */
export function looksLikeBot(req: Request, body: { website?: unknown }): boolean {
  if (body.website) return true;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return true;
    } catch {
      return true;
    }
  }
  return false;
}
