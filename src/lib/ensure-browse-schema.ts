import { prisma } from "@/lib/prisma";

let ensured = false;

/** Idempotent DDL for fair-exposure + wali handover columns (safe to call often). */
export async function ensureBrowseAndWaliSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS browse_impressions (
        viewer_id BIGINT NOT NULL,
        shown_user_id BIGINT NOT NULL,
        times_shown INT NOT NULL DEFAULT 1,
        last_shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        opened_at TIMESTAMPTZ,
        skipped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (viewer_id, shown_user_id)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_browse_impressions_viewer_shown
        ON browse_impressions (viewer_id, last_shown_at DESC)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS country_code VARCHAR(8),
        ADD COLUMN IF NOT EXISTS height_cm INT,
        ADD COLUMN IF NOT EXISTS location_precision VARCHAR(16)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS wali_handover_status VARCHAR(32),
        ADD COLUMN IF NOT EXISTS wali_details_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS wali_details_shared_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS wali_contact_attempted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS wali_contact_confirmed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS wali_handover_note TEXT
    `);
    ensured = true;
  } catch {
    /* table may already exist with different shape — ranking degrades gracefully */
  }
}
