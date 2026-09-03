import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureEmailVerificationSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
        ON email_verification_tokens (user_id, created_at DESC)
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureEmailVerificationSchema", err);
  }
}
