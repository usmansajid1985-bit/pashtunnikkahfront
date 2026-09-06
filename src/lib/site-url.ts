import { headers } from "next/headers";

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  let s = value.trim().replace(/\/+$/, "");
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  if (/\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$|\/)/i.test(s)) return null;
  return s;
}

/**
 * Absolute site origin for building links outside a request (emails, background jobs).
 * Falls back through the env vars Vercel injects automatically so production links
 * never come out as http://localhost:3001 just because APP_URL wasn't set.
 */
export function siteOrigin(): string {
  return (
    clean(process.env.NEXT_PUBLIC_APP_URL) ||
    clean(process.env.WEB_ORIGIN) ||
    clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    clean(process.env.VERCEL_URL) ||
    "http://localhost:3001"
  );
}

/**
 * Origin taken from the incoming request headers — the most reliable source inside
 * route handlers and server components, and correct on preview/custom domains.
 */
export async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/i.test(host)) {
      const proto = h.get("x-forwarded-proto") || "https";
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable (not in a request scope) — fall through
  }
  return siteOrigin();
}
