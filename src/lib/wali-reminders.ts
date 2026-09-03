import { prisma } from "@/lib/prisma";
import { ensureP1Schema } from "@/lib/ensure-p1-schema";
import { sendPushNotification } from "@/lib/push/server";

const REMINDER_AFTER_MS = 48 * 60 * 60 * 1000;
const MAX_REMINDERS = 3;
const REMINDER_COOLDOWN_MS = 48 * 60 * 60 * 1000;

/**
 * Send wali handover nudge to the brother when sister shared details but no contact attempt.
 * Safe to call lazily (chat open) or from internal cron route.
 */
export async function processWaliReminders(limit = 20) {
  await ensureP1Schema();

  const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);
  const rows = await prisma.$queryRaw<
    {
      id: bigint;
      sender_id: bigint;
      receiver_id: bigint;
      wali_reminder_count: number;
      wali_last_reminder_at: Date | null;
    }[]
  >`
    SELECT id, sender_id, receiver_id,
           COALESCE(wali_reminder_count, 0) AS wali_reminder_count,
           wali_last_reminder_at
    FROM match_requests
    WHERE status = 'accepted'
      AND wali_handover_status = 'involving'
      AND wali_details_shared_at IS NOT NULL
      AND wali_details_shared_at < ${cutoff}
      AND wali_contact_attempted_at IS NULL
      AND COALESCE(wali_reminder_count, 0) < ${MAX_REMINDERS}
    ORDER BY wali_details_shared_at ASC
    LIMIT ${limit}
  `.catch(() => []);

  let sent = 0;
  for (const row of rows) {
    if (
      row.wali_last_reminder_at &&
      Date.now() - row.wali_last_reminder_at.getTime() < REMINDER_COOLDOWN_MS
    ) {
      continue;
    }

    const profiles = await prisma.profiles.findMany({
      where: { user_id: { in: [row.sender_id, row.receiver_id] } },
      select: { user_id: true, gender: true, profile_code: true },
    });
    const female = profiles.find((p) => (p.gender || "").toLowerCase().startsWith("f"));
    if (!female) continue;

    const brotherId = female.user_id === row.sender_id ? row.receiver_id : row.sender_id;
    const sisterCode = female.profile_code || "your match";

    void sendPushNotification(brotherId, {
      title: "Pashtun Nikah",
      body: `Wali details were shared for ${sisterCode}. Please attempt contact within 48 hours.`,
      url: `/chats/${row.id}`,
      tag: `wali-reminder-${row.id}`,
      type: "match",
      relatedRequestId: row.id,
    }).catch((err) => console.error("[push] wali reminder failed", err));

    await prisma.$executeRaw`
      UPDATE match_requests
      SET wali_reminder_count = COALESCE(wali_reminder_count, 0) + 1,
          wali_last_reminder_at = NOW(),
          updated_at = NOW()
      WHERE id = ${row.id}
    `;
    sent++;
  }

  return { processed: rows.length, sent };
}
