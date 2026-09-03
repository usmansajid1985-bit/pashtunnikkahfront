import { prisma } from "@/lib/prisma";
import { ensureP2Schema } from "@/lib/ensure-p2-schema";

let ensured = false;

export async function ensureP3Schema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS email_new_request BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_new_message BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS email_match BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS quiet_hours_start INT,
        ADD COLUMN IF NOT EXISTS quiet_hours_end INT
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS message_removals (
        id BIGSERIAL PRIMARY KEY,
        message_id BIGINT NOT NULL UNIQUE,
        removed_by_admin_id BIGINT NOT NULL,
        reason VARCHAR(255),
        removed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS login_events (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        ip VARCHAR(64),
        user_agent VARCHAR(512),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events (user_id, created_at DESC)
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureP3Schema", err);
  }
}
