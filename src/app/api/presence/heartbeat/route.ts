import { after, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ONLINE_WINDOW_SECONDS } from "@/lib/presence";
import { maybeRunRequestLifecycleJobs } from "@/lib/request-lifecycle";

export const dynamic = "force-dynamic";

/** Authenticated heartbeat — bumps last_seen_at for genuine Online status. `?away=1` (sent as a
 * beacon when the tab is backgrounded/locked) backdates last_seen just past the online window, so
 * the "Active now" dot drops within seconds of leaving while the member still reads "Active today". */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const away = new URL(req.url).searchParams.get("away") === "1";
  const now = new Date();
  // Away: just outside the online window, so the dot drops at once but they still read "Active today".
  const seen = away ? new Date(now.getTime() - (ONLINE_WINDOW_SECONDS + 5) * 1000) : now;
  await prisma.users.update({
    where: { id: BigInt(session.userId) },
    data: { last_seen_at: seen, updated_at: now },
  });

  // Request expiry, refunds and reminders stay on time between cron runs: run them after the
  // response (throttled), so the heartbeat itself is never slowed.
  after(() => maybeRunRequestLifecycleJobs());

  return NextResponse.json({ ok: true, onlineWindowSeconds: ONLINE_WINDOW_SECONDS, at: now.toISOString() });
}
