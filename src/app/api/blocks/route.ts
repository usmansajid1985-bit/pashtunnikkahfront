import { closePendingWithRefund } from "@/lib/matches";
import { cancelFamilyFlow } from "@/lib/family-flow";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastChat } from "@/lib/chat-broadcast";

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

  const pair = {
    OR: [
      { sender_id: me, receiver_id: peerUserId },
      { sender_id: peerUserId, receiver_id: me },
    ],
  };
  const [liveChats, pendingRequests] = await Promise.all([
    prisma.match_requests.findMany({ where: { status: "accepted", ...pair }, select: { id: true } }),
    prisma.match_requests.findMany({ where: { status: "pending", ...pair }, select: { id: true } }),
  ]);

  // Mutual disappearance: tear down the live relationship both ways. Pending requests are
  // cancelled; saved entries removed. Accepted matches are left in place but chat access is
  // gated at the chat layer (see chat route / loadThread block check).
  // Pending requests are cancelled one by one so each sender gets their Match Token back.
  for (const r of pendingRequests) {
    await closePendingWithRefund(r.id, "cancelled", "request_blocked_refund").catch((err) =>
      console.error("[blocks] cancel refund failed", err)
    );
  }
  await Promise.all([
    prisma.favourites.deleteMany({
      where: {
        OR: [
          { user_id: me, profile_user_id: peerUserId },
          { user_id: peerUserId, profile_user_id: me },
        ],
      },
    }),
  ]);

  // K06 / Q12: both sides' open chats and request lists update immediately.
  const userRooms = [`user:${me.toString()}`, `user:${peerUserId.toString()}`];
  for (const chat of liveChats) {
    await cancelFamilyFlow(chat.id);
    broadcastChat("match:closed", [`thread:${chat.id.toString()}`, ...userRooms], {
      requestId: chat.id.toString(),
      byUserId: session.userId,
      reason: "blocked",
    });
  }
  for (const request of pendingRequests) {
    broadcastChat("request:update", userRooms, { requestId: request.id.toString(), status: "cancelled" });
  }

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
