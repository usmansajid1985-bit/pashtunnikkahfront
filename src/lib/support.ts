import { prisma } from "@/lib/prisma";
import type { SupportChannel, SupportTopic } from "@/lib/support-shared";

/**
 * Help & Support (/support). A member picks a topic + reason, we save a ticket with an INC
 * reference, then hand off to WhatsApp or email with that reference prefilled. Opening the app
 * is not proof a message was sent, so tickets start as "open" and nothing records a send.
 */

export {
  SUPPORT_TOPICS,
  SUPPORT_CHANNELS,
  SUPPORT_DETAILS_MAX,
  type SupportTopic,
  type SupportChannel,
} from "@/lib/support-shared";

/** Per-member cap so the form can't be used to flood the inbox. */
const MAX_TICKETS_PER_HOUR = 5;

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@pashtunnikah.com";

/** WhatsApp Business number, international digits only. Unset → the page offers email only. */
export function supportWhatsAppNumber() {
  return (process.env.SUPPORT_WHATSAPP_NUMBER || "").replace(/\D/g, "") || null;
}

let ensured = false;
export async function ensureSupportSchema() {
  if (ensured) return;
  // reference is derived from the id in the same INSERT, so it is unique without a second query.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGSERIAL PRIMARY KEY,
      reference VARCHAR(16) GENERATED ALWAYS AS ('INC-' || LPAD(id::text, 6, '0')) STORED UNIQUE,
      user_id BIGINT NOT NULL,
      topic VARCHAR(16) NOT NULL,
      reason VARCHAR(80) NOT NULL,
      details TEXT,
      channel VARCHAR(16) NOT NULL,
      user_agent VARCHAR(400),
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS support_tickets_created_idx ON support_tickets (created_at DESC)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id, created_at DESC)`);
  ensured = true;
}

export class SupportRateLimitError extends Error {}

export async function createSupportTicket(input: {
  userId: bigint;
  topic: SupportTopic;
  reason: string;
  details: string | null;
  channel: SupportChannel;
  userAgent: string | null;
}) {
  await ensureSupportSchema();
  const recent = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM support_tickets WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    input.userId
  );
  if (Number(recent[0]?.n ?? 0) >= MAX_TICKETS_PER_HOUR) {
    throw new SupportRateLimitError("You've sent several requests recently. Please wait a little before creating another.");
  }
  const rows = await prisma.$queryRawUnsafe<{ reference: string }[]>(
    `INSERT INTO support_tickets (user_id, topic, reason, details, channel, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING reference`,
    input.userId,
    input.topic,
    input.reason,
    input.details,
    input.channel,
    input.userAgent
  );
  return rows[0].reference;
}
