import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";

export const dynamic = "force-dynamic";

const REMIND_AFTER_DAYS = 14;

/**
 * Spec §16: don't ask for push permission on signup. Prompt once the user has actually sent a
 * match request, and — if they picked "Not now" — not again for a fortnight.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsSchema();
  const userId = BigInt(session.userId);

  const [sentRequests, prefRows, deviceCount] = await Promise.all([
    prisma.match_requests.count({ where: { sender_id: userId } }),
    prisma.$queryRaw<{ push_enabled: boolean; push_prompt_dismissed_at: Date | null }[]>`
      SELECT push_enabled, push_prompt_dismissed_at
      FROM notification_preferences WHERE user_id = ${userId} LIMIT 1
    `.catch(() => []),
    prisma.push_subscriptions.count({ where: { user_id: userId } }),
  ]);

  const pref = prefRows[0];
  const dismissedRecently =
    pref?.push_prompt_dismissed_at != null &&
    Date.now() - pref.push_prompt_dismissed_at.getTime() < REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000;

  const shouldPrompt =
    sentRequests > 0 &&
    deviceCount === 0 &&
    pref?.push_enabled !== false &&
    !dismissedRecently;

  return NextResponse.json({ shouldPrompt, hasDevice: deviceCount > 0 });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsSchema();
  const userId = BigInt(session.userId);

  await prisma.notification_preferences.upsert({
    where: { user_id: userId },
    update: { push_prompt_dismissed_at: new Date(), updated_at: new Date() },
    create: { user_id: userId, push_prompt_dismissed_at: new Date() },
  });
  return NextResponse.json({ ok: true });
}
