import { prisma } from "@/lib/prisma";

let ensured = false;

/** Idempotent DDL for multi-photo profiles (up to 3, one selectable main). */
export async function ensurePhotosSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS profile_photos (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        url VARCHAR(500) NOT NULL,
        is_main BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_profile_photos_user
        ON profile_photos (user_id, sort_order)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE profile_photos ADD COLUMN IF NOT EXISTS blur_url VARCHAR(500)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_blur_url VARCHAR(500)
    `);
    ensured = true;
  } catch (err) {
    console.error("ensurePhotosSchema", err);
  }
}
