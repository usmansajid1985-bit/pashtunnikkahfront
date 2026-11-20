import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * SEC-7: rate limiting shared across every serverless instance. Vercel runs many isolated
 * instances, so an in-memory counter per instance barely limits anything — the counter lives in
 * Postgres instead (one atomic upsert per check). If the database can't be reached the check
 * falls back to a per-instance counter rather than failing the request.
 */

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const row = memory.get(key);
  if (!row || now > row.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key VARCHAR(255) PRIMARY KEY,
      count INT NOT NULL,
      reset_at TIMESTAMPTZ NOT NULL
    )`);
  await prisma.$executeRawUnsafe(`ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY`);
  ensured = true;
}

/** True when the call is allowed; false once `limit` calls were made in the current window. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    await ensureTable();
    const resetAt = new Date(Date.now() + windowMs);
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, count, reset_at) VALUES (${key.slice(0, 255)}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.reset_at < NOW() THEN 1 ELSE rate_limits.count + 1 END,
        reset_at = CASE WHEN rate_limits.reset_at < NOW() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
      RETURNING count`;
    // Occasionally clear out expired windows so the table stays small.
    if (Math.random() < 0.01) void prisma.$executeRaw`DELETE FROM rate_limits WHERE reset_at < NOW()`.catch(() => undefined);
    return Number(rows[0]?.count ?? 1) <= limit;
  } catch (err) {
    console.error("[rate-limit] shared store unavailable, using per-instance limit", err);
    return memoryLimit(key, limit, windowMs);
  }
}

/** Standard 429 with Retry-After. */
export function tooManyRequests(retryAfterSeconds: number, error = "Too many attempts. Please wait a little and try again.") {
  return NextResponse.json({ error }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.round(retryAfterSeconds))) } });
}

/** Client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
