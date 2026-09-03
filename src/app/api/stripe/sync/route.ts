import { NextResponse } from "next/server";
import { getSession, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Confirm checkout after redirect (works without local webhook). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    const result = await syncCheckoutSession(sessionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    if (result.userId !== session.userId) {
      return NextResponse.json({ error: "Session mismatch" }, { status: 403 });
    }

    const user = await prisma.users.findUnique({ where: { id: BigInt(session.userId) } });
    const profile = await prisma.profiles.findUnique({
      where: { user_id: BigInt(session.userId) },
      select: { profile_code: true, full_name: true },
    });

    const token = await createSessionToken({
      userId: session.userId,
      email: session.email,
      displayName: profile?.full_name || session.displayName,
      profileCode: profile?.profile_code || session.profileCode,
      plan: user?.plan || "gold",
    });

    const res = NextResponse.json({ ok: true, plan: user?.plan || "gold" });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("stripe sync", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
