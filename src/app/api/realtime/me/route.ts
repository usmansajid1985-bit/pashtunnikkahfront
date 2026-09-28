import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userTopic } from "@/lib/realtime-topics";

export const dynamic = "force-dynamic";

/** Bootstraps the app-wide live-updates layer: the signed user topic + banner preference. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.$queryRaw<{ in_app_banners: boolean }[]>`
    SELECT in_app_banners FROM notification_preferences WHERE user_id = ${BigInt(session.userId)} LIMIT 1
  `.catch(() => []);
  return NextResponse.json({
    userId: session.userId,
    userTopic: userTopic(session.userId),
    inAppBanners: rows[0]?.in_app_banners ?? true,
  });
}
