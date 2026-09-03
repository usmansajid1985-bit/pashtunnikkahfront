import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function nextBlockId() {
  const max = await prisma.blocks.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const peerUserId = BigInt(String(body.userId || "0"));
  const me = BigInt(session.userId);
  if (!peerUserId || peerUserId === me) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const existing = await prisma.blocks.findFirst({
    where: { blocker_id: me, blocked_id: peerUserId },
  });
  if (existing) return NextResponse.json({ ok: true });

  await prisma.blocks.create({
    data: {
      id: await nextBlockId(),
      blocker_id: me,
      blocked_id: peerUserId,
      created_at: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const peerUserId = BigInt(String(body.userId || "0"));
  const me = BigInt(session.userId);

  await prisma.blocks.deleteMany({
    where: { blocker_id: me, blocked_id: peerUserId },
  });
  return NextResponse.json({ ok: true });
}
