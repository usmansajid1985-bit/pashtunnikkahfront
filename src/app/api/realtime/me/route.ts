import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userTopic } from "@/lib/realtime-topics";

export const dynamic = "force-dynamic";

/** Bootstraps the app-wide live-updates layer: the signed user topic + banner preference. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [rows, profile] = await Promise.all([
    prisma.$queryRaw<{ in_app_banners: boolean }[]>`
      SELECT in_app_banners FROM notification_preferences WHERE user_id = ${BigInt(session.userId)} LIMIT 1
    `.catch(() => []),
    prisma.profiles
      .findUnique({ where: { user_id: BigInt(session.userId) }, select: { status: true } })
      .catch(() => null),
  ]);
  return NextResponse.json({
    userId: session.userId,
    userTopic: userTopic(session.userId),
    inAppBanners: rows[0]?.in_app_banners ?? true,
    // N08 fallback: lets an open tab notice an admin approval when the member comes back to it.
    profileStatus: profile?.status ?? null,
  });
}
