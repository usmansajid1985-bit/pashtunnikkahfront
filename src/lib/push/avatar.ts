import { createHmac, timingSafeEqual } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { fetchPhotoBytes } from "@/lib/photos";
import { HEART_MARK_PNG_BASE64 } from "@/lib/push/heart-mark";

const SIZE = 192;
const DAY_MS = 24 * 60 * 60 * 1000;

function sign(payload: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`push-avatar:${payload}`).digest("base64url").slice(0, 32);
}

/**
 * Path of the notification picture for a sender. The phone fetches it with no session, so the
 * link carries its own signature and stops working after about two days; within a day the path is
 * stable, so repeat notifications from one sender reuse the cached picture.
 */
export function pushAvatarPath(actorUserId: bigint): string | null {
  const day = Math.floor(Date.now() / DAY_MS);
  const payload = `${actorUserId}.${day}`;
  const sig = sign(payload);
  return sig ? `/api/push/avatar/${payload}.${sig}` : null;
}

export function readPushAvatarToken(token: string): bigint | null {
  const m = /^(\d{1,20})\.(\d{1,8})\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!m) return null;
  const expected = sign(`${m[1]}.${m[2]}`);
  if (!expected) return null;
  const a = Buffer.from(m[3]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const age = Math.floor(Date.now() / DAY_MS) - Number(m[2]);
  if (age < 0 || age > 1) return null;
  return BigInt(m[1]);
}

/**
 * The sender's BLURRED photo as a circle with the PN heart badge on its lower-right — one picture,
 * because a web notification only has room for one. Built only from the server-made blur
 * derivative (and softened again), never from the original. Null when the member has no approved
 * photo; the caller falls back to the plain PN icon.
 */
export async function buildPushAvatar(actorUserId: bigint): Promise<Buffer | null> {
  const profile = await prisma.profiles.findUnique({
    where: { user_id: actorUserId },
    select: { photo_blur_url: true, photo_status: true },
  });
  if (!profile?.photo_blur_url || profile.photo_status !== "approved") return null;
  const bytes = await fetchPhotoBytes(profile.photo_blur_url);
  if (!bytes) return null;

  const circle = Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}"/></svg>`);
  const photo = await sharp(bytes)
    .resize(SIZE, SIZE, { fit: "cover" })
    .blur(3)
    .composite([{ input: circle, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Badge sits inside the photo's circle, so it survives phones that crop the picture round.
  const r = 32;
  const cx = 142;
  const cy = 142;
  const disc = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ec1464"/><stop offset="1" stop-color="#f96b9c"/></linearGradient></defs><circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#ffffff"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g)"/></svg>`
  );
  const heartSize = 40;
  const heart = await sharp(Buffer.from(HEART_MARK_PNG_BASE64, "base64")).resize(heartSize, heartSize).png().toBuffer();

  return sharp(photo)
    .composite([
      { input: disc, left: 0, top: 0 },
      { input: heart, left: cx - heartSize / 2, top: cy - heartSize / 2 },
    ])
    .png()
    .toBuffer();
}
