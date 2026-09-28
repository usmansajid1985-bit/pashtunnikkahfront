import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Row = {
  id: bigint;
  event: string;
  detail: string | null;
  request_id: bigint | null;
  created_at: Date;
  wali_name: string | null;
};

/** W09: the sister's wali activity log (kept after access is revoked). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.event, a.detail, a.request_id, a.created_at, l.name AS wali_name
    FROM wali_activity a
    LEFT JOIN wali_links l ON l.id = a.link_id
    WHERE a.user_id = ${BigInt(session.userId)}
    ORDER BY a.created_at DESC
    LIMIT 100
  `.catch(() => [] as Row[]);
  return NextResponse.json({
    activity: rows.map((r) => ({
      id: r.id.toString(),
      event: r.event,
      detail: r.detail,
      requestId: r.request_id?.toString() ?? null,
      waliName: r.wali_name,
      at: r.created_at.toISOString(),
    })),
  });
}
