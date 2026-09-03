import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanSettings } from "@/lib/plan-settings";

export const dynamic = "force-dynamic";

async function nextFavouriteId() {
  const max = await prisma.favourites.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const peerUserId = BigInt(String(body.userId || "0"));
  const me = BigInt(session.userId);
  if (!peerUserId || peerUserId === me) {
    return NextResponse.json({ error: "Invalid profile" }, { status: 400 });
  }

  const existing = await prisma.favourites.findFirst({
    where: { user_id: me, profile_user_id: peerUserId },
  });
  if (existing) return NextResponse.json({ ok: true, id: existing.id.toString() });

  // Fresh DB read of plan — never trust the JWT session claim for a gate like this,
  // it can be stale until the user's next login/session refresh.
  const meUser = await prisma.users.findUnique({ where: { id: me }, select: { plan: true } });
  const settings = await getPlanSettings(meUser?.plan);
  if (settings.savedProfileLimit != null) {
    const count = await prisma.favourites.count({ where: { user_id: me } });
    if (count >= settings.savedProfileLimit) {
      return NextResponse.json(
        {
          error: `Free members can save up to ${settings.savedProfileLimit} profiles. Upgrade to Gold to save unlimited profiles.`,
        },
        { status: 403 }
      );
    }
  }

  const created = await prisma.favourites.create({
    data: {
      id: await nextFavouriteId(),
      user_id: me,
      profile_user_id: peerUserId,
      created_at: new Date(),
    },
  });
  return NextResponse.json({ ok: true, id: created.id.toString() });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const peerUserId = BigInt(String(body.userId || "0"));
  const me = BigInt(session.userId);

  await prisma.favourites.deleteMany({
    where: { user_id: me, profile_user_id: peerUserId },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const peerUserId = BigInt(String(body.userId || "0"));
  const me = BigInt(session.userId);
  const note = String(body.note ?? "").trim().slice(0, 500) || null;

  const result = await prisma.favourites.updateMany({
    where: { user_id: me, profile_user_id: peerUserId },
    data: { note },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Saved profile not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, note });
}
