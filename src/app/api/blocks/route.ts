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

  const now = new Date();
  await prisma.blocks.create({
    data: {
      id: await nextBlockId(),
      blocker_id: me,
      blocked_id: peerUserId,
      created_at: now,
    },
  });

  // Mutual disappearance: tear down the live relationship both ways. Pending introductions are
  // cancelled; saved entries removed. Accepted matches are left in place but chat access is
  // gated at the chat layer (see chat route / loadThread block check).
  await Promise.all([
    prisma.match_requests.updateMany({
      where: {
        status: "pending",
        OR: [
          { sender_id: me, receiver_id: peerUserId },
          { sender_id: peerUserId, receiver_id: me },
        ],
      },
      data: { status: "cancelled", updated_at: now },
    }),
    prisma.favourites.deleteMany({
      where: {
        OR: [
          { user_id: me, profile_user_id: peerUserId },
          { user_id: peerUserId, profile_user_id: me },
        ],
      },
    }),
  ]);

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
