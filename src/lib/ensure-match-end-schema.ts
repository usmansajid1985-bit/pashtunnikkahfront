import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureMatchEndSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS ended_by BIGINT,
        ADD COLUMN IF NOT EXISTS end_reason VARCHAR(32),
        ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ
    `);
    // Q06: older matches predate accepted_at — use their first message (else last update) as the
    // best available "Matched on" time. Only touches rows that are still missing it.
    await prisma.$executeRawUnsafe(`
      UPDATE match_requests mr
      SET accepted_at = COALESCE(
        (SELECT MIN(m.created_at) FROM messages m WHERE m.request_id = mr.id),
        mr.updated_at
      )
      WHERE mr.accepted_at IS NULL AND mr.status IN ('accepted', 'ended')
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureMatchEndSchema", err);
  }
}
