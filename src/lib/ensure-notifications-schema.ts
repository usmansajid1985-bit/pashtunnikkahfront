import { prisma } from "@/lib/prisma";

let ensured = false;

/**
 * Idempotent DDL for the V2 in-app notification system (bell → Activity | Updates).
 * Safe to call on every notification read/write path.
 */
export async function ensureNotificationsSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS actor_user_id BIGINT,
        ADD COLUMN IF NOT EXISTS group_key VARCHAR(160),
        ADD COLUMN IF NOT EXISTS group_count INT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_group
        ON notifications (recipient_user_id, group_key)
        WHERE group_key IS NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS notify_requests BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_messages BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_profile_views BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_wali BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_updates BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS push_prompt_dismissed_at TIMESTAMPTZ
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'general',
        ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS gold_only BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        user_id BIGINT NOT NULL,
        announcement_id BIGINT NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, announcement_id)
      )
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureNotificationsSchema", err);
  }
}
