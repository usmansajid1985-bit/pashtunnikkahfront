import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureCompatibilityCacheSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS compatibility_cache (
        viewer_id BIGINT NOT NULL,
        candidate_user_id BIGINT NOT NULL,
        heuristic_score INT NOT NULL,
        ai_score INT,
        final_score INT NOT NULL,
        ai_computed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (viewer_id, candidate_user_id)
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_compatibility_cache_viewer
        ON compatibility_cache (viewer_id, updated_at DESC)
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE compatibility_cache
        ADD COLUMN IF NOT EXISTS ai_explanation JSONB
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureCompatibilityCacheSchema", err);
  }
}
