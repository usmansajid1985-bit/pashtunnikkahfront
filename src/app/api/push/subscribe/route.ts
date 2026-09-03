import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function nextSubscriptionId() {
  const max = await prisma.push_subscriptions.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.push_subscriptions.count({
    where: { user_id: BigInt(session.userId) },
  });
  return NextResponse.json({ deviceCount: count });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const fcmToken = typeof body?.fcmToken === "string" ? body.fcmToken.trim() : "";
  const endpoint =
    fcmToken ? `fcm:${fcmToken}` : typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = fcmToken ? "fcm" : typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = fcmToken ? fcmToken : typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  const platform = typeof body?.platform === "string" ? body.platform.slice(0, 32) : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const userId = BigInt(session.userId);
  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;
  const now = new Date();

  const existing = await prisma.push_subscriptions.findUnique({ where: { endpoint } });
  if (existing) {
    await prisma.push_subscriptions.update({
      where: { endpoint },
      data: {
        user_id: userId,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: userAgent,
        platform,
        updated_at: now,
      },
    });
  } else {
    await prisma.push_subscriptions.create({
      data: {
        id: await nextSubscriptionId(),
        user_id: userId,
        endpoint,
        p256dh_key: p256dh,
        auth_key: auth,
        user_agent: userAgent,
        platform,
        created_at: now,
        updated_at: now,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const fcmToken = typeof body?.fcmToken === "string" ? body.fcmToken.trim() : "";
  const endpoint =
    fcmToken ? `fcm:${fcmToken}` : typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  const userId = BigInt(session.userId);
  await prisma.push_subscriptions.deleteMany({ where: { endpoint, user_id: userId } });

  return NextResponse.json({ ok: true });
}
