import { prisma } from "@/lib/prisma";

let ensured = false;

/** Per-member "Before you message" acknowledgement on a match (one column per side). */
async function ensureChatConsentSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS sender_chat_consent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS receiver_chat_consent_at TIMESTAMPTZ
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureChatConsentSchema", err);
  }
}

type Pair = { id: bigint; sender_id: bigint; receiver_id: bigint };

/**
 * Whether this member has already acknowledged the chat guidelines for this match — saved on the
 * server so a new device / incognito tab doesn't ask again. Anyone who has already sent a message
 * in the thread counts as having agreed (chats from before this was stored).
 */
export async function hasChatConsent(match: Pair, userId: bigint): Promise<boolean> {
  await ensureChatConsentSchema();
  const column = match.sender_id === userId ? "sender_chat_consent_at" : "receiver_chat_consent_at";
  const rows = await prisma
    .$queryRawUnsafe<{ ok: boolean }[]>(
      `SELECT (mr.${column} IS NOT NULL
               OR EXISTS (SELECT 1 FROM messages m WHERE m.request_id = mr.id AND m.sender_id = $2)) AS ok
         FROM match_requests mr WHERE mr.id = $1`,
      match.id,
      userId
    )
    .catch(() => [{ ok: false }]);
  return Boolean(rows[0]?.ok);
}

export async function saveChatConsent(match: Pair, userId: bigint) {
  await ensureChatConsentSchema();
  const column = match.sender_id === userId ? "sender_chat_consent_at" : "receiver_chat_consent_at";
  await prisma.$executeRawUnsafe(
    `UPDATE match_requests SET ${column} = COALESCE(${column}, NOW()) WHERE id = $1`,
    match.id
  );
}
