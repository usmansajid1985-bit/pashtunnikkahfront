import { NextResponse } from "next/server";
import {
  createSessionToken,
  findUserForLogin,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureP3Schema } from "@/lib/ensure-p3-schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Enter your Profile ID or email, and password." },
        { status: 400 }
      );
    }

    const user = await findUserForLogin(identifier);
    if (!user) {
      return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
    }

    if (user.account_status === "suspended") {
      return NextResponse.json(
        { error: "This account is suspended. Contact support." },
        { status: 403 }
      );
    }

    if (user.deletion_requested_at) {
      return NextResponse.json(
        { error: "This account is scheduled for deletion." },
        { status: 403 }
      );
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid login details." }, { status: 401 });
    }

    const needsPasswordSetup = !(user.password_hash ?? "").trim();

    await prisma.users.update({
      where: { id: user.id },
      data: { last_seen_at: new Date() },
    });

    void ensureP3Schema().then(async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      const ua = req.headers.get("user-agent")?.slice(0, 512) || null;
      await prisma.$executeRaw`
        INSERT INTO login_events (user_id, ip, user_agent, created_at)
        VALUES (${user.id}, ${ip}, ${ua}, NOW())
      `.catch(() => undefined);
    });

    const profileCode = user.profiles?.profile_code ?? null;
    const token = await createSessionToken({
      userId: user.id.toString(),
      email: user.email,
      displayName: user.display_name || user.email,
      profileCode,
      plan: user.plan,
    });

    const res = NextResponse.json({
      ok: true,
      needsPasswordSetup,
      user: {
        id: user.id.toString(),
        email: user.email,
        displayName: user.display_name,
        profileCode,
        plan: user.plan,
      },
      redirectTo: needsPasswordSetup ? "/set-password" : "/browse",
    });

    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
