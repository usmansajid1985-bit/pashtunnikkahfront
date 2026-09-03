import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensurePasswordResetSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_password_resets_user
        ON password_resets (user_id, created_at DESC)
    `);
    ensured = true;
  } catch (err) {
    console.error("ensurePasswordResetSchema", err);
  }
}
