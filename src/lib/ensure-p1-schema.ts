import { prisma } from "@/lib/prisma";

let ensured = false;

export async function ensureP1Schema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS intro_message VARCHAR(250),
        ADD COLUMN IF NOT EXISTS wali_last_reminder_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS wali_reminder_count INT NOT NULL DEFAULT 0
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS payment_grace_until TIMESTAMPTZ
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureP1Schema", err);
  }
}
