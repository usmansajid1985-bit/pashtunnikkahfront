import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getActivityFeed,
  getUpdatesFeed,
  markAllActivityRead,
  markActivityRead,
  markUpdatesRead,
} from "@/lib/notifications";
import { getGroupedActivity } from "@/lib/notification-groups";

export const dynamic = "force-dynamic";

async function isGold(userId: bigint) {
  const u = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  return (u?.plan ?? "").toLowerCase() === "gold";
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const params = new URL(req.url).searchParams;
  const tab = params.get("tab") ?? "activity";

  if (tab === "updates") {
    return NextResponse.json({ updates: await getUpdatesFeed(userId) });
  }

  // Grouped feed (redesign) — supports "Show older notifications" via ?before=<ISO cursor>.
  if (params.get("grouped")) {
    const beforeRaw = params.get("before");
    const before = beforeRaw ? new Date(beforeRaw) : null;
    const activity = await getGroupedActivity(userId, {
      isGold: await isGold(userId),
      before: before && !Number.isNaN(before.getTime()) ? before : null,
    });
    return NextResponse.json({ activity });
  }

  const activity = await getActivityFeed(userId, { isGold: await isGold(userId) });
  return NextResponse.json({ activity });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    markAllRead?: boolean;
    markUpdatesRead?: boolean;
    id?: string;
    /** Every raw id folded into a grouped row — opening the row marks them all read. */
    ids?: string[];
  };
  const userId = BigInt(session.userId);

  if (body.markAllRead) await markAllActivityRead(userId);
  if (body.markUpdatesRead) await markUpdatesRead(userId);
  if (body.id) await markActivityRead(userId, BigInt(body.id));
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await Promise.all(
      body.ids.map((id) => markActivityRead(userId, BigInt(id)).catch(() => undefined))
    );
  }

  return NextResponse.json({ ok: true });
}
