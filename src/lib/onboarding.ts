import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";

/**
 * Account-first onboarding (Tweaks 6): members create their account (email + password) first,
 * verify their email with a 6-digit code, then fill in their profile with progress saved on the
 * server — so they can install the app, switch device or log in again and carry on.
 */

const CODE_TTL_MS = 15 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS_PER_CODE = 5;
const DRAFT_MAX_BYTES = 60_000;

let ensured = false;
export async function ensureOnboardingSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_draft JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_draft_at TIMESTAMPTZ`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS email_codes (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_email_codes_user ON email_codes (user_id, created_at DESC)`
    );
    ensured = true;
  } catch (err) {
    console.error("ensureOnboardingSchema", err);
  }
}

const hashCode = (userId: bigint, code: string) =>
  createHash("sha256").update(`${userId}:${code}`).digest("hex");

export type CodeResult = { ok: true } | { ok: false; error: string; code: string; retryAfter?: number };

/** Email a fresh 6-digit code (invalidates older ones). Cooldown + hourly cap. */
export async function sendEmailCode(userId: bigint): Promise<CodeResult> {
  await ensureOnboardingSchema();
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { email: true, email_verified: true } });
  if (!user?.email) return { ok: false, code: "no_user", error: "Account not found." };
  if (user.email_verified) return { ok: true };

  const recent = await prisma.$queryRaw<{ created_at: Date }[]>`
    SELECT created_at FROM email_codes WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC`;
  if (recent[0]) {
    const wait = Math.ceil((recent[0].created_at.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000);
    if (wait > 0) return { ok: false, code: "cooldown", error: `Please wait ${wait}s before requesting another code.`, retryAfter: wait };
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    return { ok: false, code: "too_many", error: "Too many codes requested. Please wait an hour and try again." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.$executeRaw`UPDATE email_codes SET used_at = NOW() WHERE user_id = ${userId} AND used_at IS NULL`;
  await prisma.$executeRaw`
    INSERT INTO email_codes (user_id, code_hash, expires_at)
    VALUES (${userId}, ${hashCode(userId, code)}, ${new Date(Date.now() + CODE_TTL_MS)})`;

  const sent = await sendMail({
    to: user.email,
    subject: `${code} is your Pashtun Nikah verification code`,
    text: `Your Pashtun Nikah verification code is ${code}.\n\nIt expires in 15 minutes. If you didn't create an account, you can ignore this email.`,
    html: `<div style="font-family:Poppins,Arial,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#17120f">
      <p style="font-size:16px;margin:0 0 12px">Assalamu alaikum,</p>
      <p style="font-size:15px;margin:0 0 18px">Use this code to verify your email for Pashtun Nikah:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#e12d72;margin:0 0 18px">${code}</p>
      <p style="font-size:13px;color:#6b6468;margin:0">It expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
    </div>`,
  }).catch((err) => {
    console.error("[onboarding] email code send failed", err);
    return { ok: false, via: "error" };
  });
  if (!sent.ok) return { ok: false, code: "send_failed", error: "We couldn't send the email just now. Please try again." };
  return { ok: true };
}

/** Check a submitted code; on success the email is verified. */
export async function verifyEmailCode(userId: bigint, raw: string): Promise<CodeResult> {
  await ensureOnboardingSchema();
  const code = raw.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, code: "bad_format", error: "Enter the 6-digit code from your email." };
  const rows = await prisma.$queryRaw<{ id: bigint; code_hash: string; attempts: number; expires_at: Date }[]>`
    SELECT id, code_hash, attempts, expires_at FROM email_codes
    WHERE user_id = ${userId} AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  const row = rows[0];
  if (!row || row.expires_at.getTime() < Date.now()) {
    return { ok: false, code: "expired", error: "This code has expired. Request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS_PER_CODE) {
    return { ok: false, code: "max_attempts", error: "Too many wrong attempts. Request a new code." };
  }
  if (row.code_hash !== hashCode(userId, code)) {
    await prisma.$executeRaw`UPDATE email_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return { ok: false, code: "wrong_code", error: "That code isn't right. Please check your email and try again." };
  }
  await prisma.$executeRaw`UPDATE email_codes SET used_at = NOW() WHERE id = ${row.id}`;
  await prisma.users.update({ where: { id: userId }, data: { email_verified: true, updated_at: new Date() } });
  return { ok: true };
}

/** Profile answers saved as the member goes (never the password; photos stay on the device). */
export async function saveOnboardingDraft(userId: bigint, draft: { data: Record<string, unknown>; stepIndex: number }) {
  await ensureOnboardingSchema();
  const { password: _p, confirmPassword: _c, photos: _ph, ...data } = draft.data ?? {};
  const json = JSON.stringify({ data, stepIndex: Number(draft.stepIndex) || 0 });
  if (json.length > DRAFT_MAX_BYTES) throw new Error("Draft too large");
  await prisma.$executeRaw`
    UPDATE users SET onboarding_draft = ${json}::jsonb, onboarding_draft_at = NOW() WHERE id = ${userId}`;
}

export async function loadOnboardingDraft(userId: bigint): Promise<{ data: Record<string, unknown>; stepIndex: number } | null> {
  await ensureOnboardingSchema();
  const rows = await prisma.$queryRaw<{ onboarding_draft: unknown }[]>`
    SELECT onboarding_draft FROM users WHERE id = ${userId}`;
  const d = rows[0]?.onboarding_draft as { data?: Record<string, unknown>; stepIndex?: number } | null | undefined;
  return d?.data ? { data: d.data, stepIndex: Number(d.stepIndex) || 0 } : null;
}

/** Where a member is in onboarding. */
export type OnboardingStage = "account" | "email" | "profile" | "done";

export async function onboardingStage(userId: bigint | null): Promise<{ stage: OnboardingStage; email?: string }> {
  if (!userId) return { stage: "account" };
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true, email_verified: true, profiles: { select: { id: true } } },
  });
  if (!user) return { stage: "account" };
  if (user.profiles) return { stage: "done", email: user.email };
  if (!user.email_verified) return { stage: "email", email: user.email };
  return { stage: "profile", email: user.email };
}

/** Next users.id (the table has no sequence default). Shared by register + signup. */
export async function nextUserId() {
  const max = await prisma.users.aggregate({ _max: { id: true } });
  return (max._max.id ?? 0n) + 1n;
}
