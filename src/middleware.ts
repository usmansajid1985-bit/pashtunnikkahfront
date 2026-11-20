import { NextResponse, type NextRequest } from "next/server";

/**
 * SEC-8: defence-in-depth against cross-site request forgery. The session cookie is already
 * SameSite=Lax; on top of that, any state-changing API request that a browser sends from another
 * site (Origin header present and not ours) is refused. Server-to-server calls — Stripe webhooks,
 * the admin app, Vercel Cron — send no Origin header and are unaffected.
 */
export function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return NextResponse.next();
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") {
    // "null" origins come from sandboxed frames / file:// pages — never our own UI.
    if (origin === "null") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.next();
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    if (host && new URL(origin).host === host) return NextResponse.next();
  } catch {
    /* malformed Origin → refuse below */
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
