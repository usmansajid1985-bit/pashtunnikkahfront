import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const rows = await prisma.notifications.findMany({
    where: { recipient_user_id: userId },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return NextResponse.json({
    items: rows.map((n) => ({
      id: n.id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      readAt: n.read_at?.toISOString() ?? null,
      createdAt: n.created_at.toISOString(),
    })),
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { markAllRead?: boolean; id?: string };
  const userId = BigInt(session.userId);
  const now = new Date();

  if (body.markAllRead) {
    await prisma.notifications.updateMany({
      where: { recipient_user_id: userId, read_at: null },
      data: { read_at: now },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await prisma.notifications.updateMany({
      where: { id: BigInt(body.id), recipient_user_id: userId },
      data: { read_at: now },
    });
  }

  return NextResponse.json({ ok: true });
}
