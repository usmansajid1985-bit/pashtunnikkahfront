import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";

export const dynamic = "force-dynamic";

/** Per-category toggles (spec §21). `pushEnabled` is the master switch. */
const CATEGORY_KEYS = [
  "notify_requests",
  "notify_messages",
  "notify_profile_views",
  "notify_wali",
  "notify_updates",
] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsSchema();

  const rows = await prisma.$queryRaw<Record<string, boolean>[]>`
    SELECT push_enabled, notify_requests, notify_messages, notify_profile_views,
           notify_wali, notify_updates
    FROM notification_preferences WHERE user_id = ${BigInt(session.userId)} LIMIT 1
  `.catch(() => []);
  const p = rows[0];
  return NextResponse.json({
    pushEnabled: p?.push_enabled ?? true,
    notify_requests: p?.notify_requests ?? true,
    notify_messages: p?.notify_messages ?? true,
    notify_profile_views: p?.notify_profile_views ?? true,
    notify_wali: p?.notify_wali ?? true,
    notify_updates: p?.notify_updates ?? true,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureNotificationsSchema();

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const userId = BigInt(session.userId);

  const update: Record<string, unknown> = { updated_at: new Date() };
  const create: Record<string, unknown> = { user_id: userId };
  if ("pushEnabled" in body) {
    update.push_enabled = Boolean(body.pushEnabled);
    create.push_enabled = Boolean(body.pushEnabled);
  }
  for (const k of CATEGORY_KEYS) {
    if (k in body) {
      update[k] = Boolean(body[k]);
      create[k] = Boolean(body[k]);
    }
  }

  await prisma.notification_preferences.upsert({
    where: { user_id: userId },
    update,
    create: create as { user_id: bigint },
  });

  return NextResponse.json({ ok: true });
}
