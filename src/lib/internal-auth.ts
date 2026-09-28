import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * Admin → web calls are signed with INTERNAL_API_SECRET (same value on both Vercel projects):
 * HMAC-SHA256 of `${userId}.${status}.${ts}`, sent as `x-pn-signature`. Returns the parsed body
 * when valid, otherwise null.
 */
export async function readSignedInternal(
  req: Request
): Promise<{ userId: string; status: string } | null> {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const status = String(body.status ?? "");
  const ts = String(body.ts ?? "");
  if (!/^\d+$/.test(userId) || !status || Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return null;
  const secret = process.env.INTERNAL_API_SECRET;
  const signature = req.headers.get("x-pn-signature") ?? "";
  if (!secret || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${userId}.${status}.${ts}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId, status };
}
