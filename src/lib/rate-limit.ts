const buckets = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory rate limit (per process). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const row = buckets.get(key);
  if (!row || now > row.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}
