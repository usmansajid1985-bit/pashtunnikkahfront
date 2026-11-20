import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashPassword, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { PASSWORD_WEAK_MESSAGE, isBreachedPassword, passwordIssue } from "@/lib/password-strength";
import { rateLimit } from "@/lib/rate-limit";
import { looksLikeBot, requestIp } from "@/lib/whatsapp-verify";
import { ensureOnboardingSchema, nextUserId, sendEmailCode } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Step 1 of onboarding: create the account (email + password) and sign the member in, then
 * email a 6-digit code. The profile is filled in afterwards, while signed in — so an
 * unfinished account can only ever be continued by its owner (never "resumed" by email).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; website?: string };
  if (looksLikeBot(req, body)) return NextResponse.json({ error: "Request blocked." }, { status: 400 });
  const ip = requestIp(req);
  if (!(await rateLimit(`register:${ip ?? "?"}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address.", field: "email" }, { status: 400 });
  }
  const weak = passwordIssue(password, email);
  if (weak) return NextResponse.json({ error: weak, field: "password" }, { status: 400 });
  if ((await isBreachedPassword(password)) === true) {
    return NextResponse.json({ error: PASSWORD_WEAK_MESSAGE, field: "password" }, { status: 400 });
  }

  const existing = await prisma.users.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, profiles: { select: { id: true } } },
  });
  if (existing) {
    // Finished or not, an existing email is never taken over from here — its owner logs in to
    // carry on (unfinished accounts resume after login).
    return NextResponse.json(
      {
        error: existing.profiles
          ? "An account with this email already exists. Log in instead."
          : "You've already started signing up with this email. Log in to continue where you left off.",
        code: "EMAIL_EXISTS",
        redirectTo: `/login?email=${encodeURIComponent(email)}&existing=1`,
      },
      { status: 409 }
    );
  }

  await ensureOnboardingSchema();
  const now = new Date();
  const user = await prisma.users.create({
    data: {
      id: await nextUserId(),
      email,
      password_hash: await hashPassword(password),
      display_name: "",
      role: "user",
      account_status: "active",
      email_verified: false,
      onboarding_complete: false,
      plan: "basic",
      requests_remaining: 0, // the monthly allowance is granted when the profile is submitted
      registered_at: now,
      created_at: now,
      updated_at: now,
    },
  });

  const sent = await sendEmailCode(user.id);
  const token = await createSessionToken({
    userId: user.id.toString(),
    email: user.email,
    displayName: "",
    profileCode: null,
    plan: "basic",
  });
  const res = NextResponse.json({
    ok: true,
    userId: user.id.toString(),
    stage: "email",
    emailSent: sent.ok,
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
