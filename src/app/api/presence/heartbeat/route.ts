import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ONLINE_IDLE_MINUTES } from "@/lib/presence";

export const dynamic = "force-dynamic";

/** Authenticated heartbeat — bumps last_seen_at for genuine Online status. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  await prisma.users.update({
    where: { id: BigInt(session.userId) },
    data: { last_seen_at: now, updated_at: now },
  });

  return NextResponse.json({ ok: true, onlineIdleMinutes: ONLINE_IDLE_MINUTES, at: now.toISOString() });
}
