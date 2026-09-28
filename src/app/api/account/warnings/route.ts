import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Row = { id: bigint; message: string; created_at: Date; acknowledged_at: Date | null };

/** A03: the member's own warnings from the PN team (newest first). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, message, created_at, acknowledged_at FROM member_warnings
    WHERE user_id = ${BigInt(session.userId)}
    ORDER BY created_at DESC
    LIMIT 20
  `.catch(() => [] as Row[]);
  return NextResponse.json({
    warnings: rows.map((r) => ({
      id: r.id.toString(),
      message: r.message,
      createdAt: r.created_at.toISOString(),
      acknowledged: r.acknowledged_at != null,
    })),
  });
}

/** Member confirms they've read a warning. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await prisma.$executeRaw`
    UPDATE member_warnings SET acknowledged_at = NOW()
    WHERE id = ${BigInt(id)} AND user_id = ${BigInt(session.userId)} AND acknowledged_at IS NULL
  `;
  return NextResponse.json({ ok: true });
}
