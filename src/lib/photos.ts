import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/** Shared on-disk photo root (outside Next build output). */
export function uploadsRoot() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "..", "uploads");
}

export function photosDir() {
  return path.join(uploadsRoot(), "photos");
}

/** Public URL path served by Next from /uploads/... */
export function publicPhotoUrl(relativePath: string) {
  const clean = relativePath.replace(/^\/+/, "");
  return `/uploads/${clean}`;
}

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Persist a data-URL image. Adds a lightweight moderation watermark string
 * into a sidecar .meta.json (invisible digital tag for ops).
 */
export async function saveDataUrlPhoto(
  userId: bigint | string,
  dataUrl: string,
  kind: "public" | "verification" = "public"
) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data");
  const mime = match[1];
  const buf = Buffer.from(match[2], "base64");
  if (buf.length < 100) throw new Error("Image too small");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Image must be under 8MB");

  const dir = photosDir();
  await mkdir(dir, { recursive: true });

  const ext = extFromMime(mime);
  const token = randomBytes(8).toString("hex");
  const filename = `${userId}-${kind}-${Date.now()}-${token}.${ext}`;
  const abs = path.join(dir, filename);
  await writeFile(abs, buf);

  const watermark = createHash("sha256")
    .update(`${userId}:${kind}:${filename}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);
  await writeFile(
    `${abs}.meta.json`,
    JSON.stringify({
      userId: String(userId),
      kind,
      mime,
      watermark,
      bytes: buf.length,
      createdAt: new Date().toISOString(),
    })
  );

  const relative = `photos/${filename}`;
  return { relative, url: publicPhotoUrl(relative), watermark, bytes: buf.length };
}
