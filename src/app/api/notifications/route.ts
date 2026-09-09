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

export const dynamic = "force-dynamic";

async function isGold(userId: bigint) {
  const u = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  return (u?.plan ?? "").toLowerCase() === "gold";
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const tab = new URL(req.url).searchParams.get("tab") ?? "activity";

  if (tab === "updates") {
    return NextResponse.json({ updates: await getUpdatesFeed(userId) });
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
  };
  const userId = BigInt(session.userId);

  if (body.markAllRead) await markAllActivityRead(userId);
  if (body.markUpdatesRead) await markUpdatesRead(userId);
  if (body.id) await markActivityRead(userId, BigInt(body.id));

  return NextResponse.json({ ok: true });
}
