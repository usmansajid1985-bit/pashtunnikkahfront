import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatLastSeen } from "@/lib/presence";
import { blockedUserIds } from "@/lib/blocking";

export const dynamic = "force-dynamic";

/**
 * Live activity labels for the members currently on screen (Browse cards, chat header…), so
 * "Active now" appears/disappears without a page refresh. Returns only the coarse label members
 * already see ("Active now", "Active today"…) — never timestamps. Blocked members are omitted.
 * GET /api/presence/status?ids=1,2,3   (max 60)
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = new URL(req.url).searchParams.get("ids") || "";
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s)))].slice(0, 60);
  if (ids.length === 0) return NextResponse.json({ statuses: {} });

  const blocked = await blockedUserIds(BigInt(session.userId));
  const blockedSet = new Set([...blocked].map((b) => b.toString()));
  const wanted = ids.filter((id) => !blockedSet.has(id)).map((id) => BigInt(id));

  const rows = await prisma.users.findMany({
    where: { id: { in: wanted } },
    select: { id: true, last_seen_at: true },
  });
  const now = new Date();
  const statuses: Record<string, string> = {};
  for (const r of rows) statuses[r.id.toString()] = formatLastSeen(r.last_seen_at, now);

  return NextResponse.json({ statuses }, { headers: { "Cache-Control": "no-store" } });
}
