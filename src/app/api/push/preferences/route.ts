import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await prisma.notification_preferences.findUnique({
    where: { user_id: BigInt(session.userId) },
  });
  return NextResponse.json({ pushEnabled: prefs?.push_enabled ?? true });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pushEnabled = Boolean(body?.pushEnabled);
  const userId = BigInt(session.userId);

  await prisma.notification_preferences.upsert({
    where: { user_id: userId },
    update: { push_enabled: pushEnabled, updated_at: new Date() },
    create: { user_id: userId, push_enabled: pushEnabled },
  });

  return NextResponse.json({ ok: true, pushEnabled });
}
