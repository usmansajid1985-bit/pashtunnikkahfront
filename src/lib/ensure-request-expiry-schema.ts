import { prisma } from "@/lib/prisma";

let ensured = false;

/** Tracks the two recipient reminders of the 7-day request flow so each is sent at most once. */
export async function ensureRequestExpirySchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS final_reminder_sent_at TIMESTAMPTZ
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureRequestExpirySchema", err);
  }
}
