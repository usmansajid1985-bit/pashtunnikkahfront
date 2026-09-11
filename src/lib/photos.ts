import { createHash, randomBytes } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { blurImageBuffer } from "@/lib/photo-blur";

/**
 * Photos live in Supabase Storage (bucket "photos"). The app runs on a
 * read-only serverless filesystem in production, so writing uploads to local
 * disk is not an option — every host instance would also see a different disk.
 */
const BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || "photos";
const MAX_BYTES = 8 * 1024 * 1024;

let cachedClient: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function storageClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Photo uploads need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

/**
 * Create the bucket on first use; ignore "already exists". Private — photos are only ever
 * served through `signedPhotoUrl` (a short-lived signed URL) or a pre-blurred derivative, never
 * the plain public object URL, so an unauthorised viewer can't fetch the original by URL alone.
 */
async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await client.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      });
      if (error && !/exist/i.test(error.message)) {
        // Reset so a transient failure can be retried on the next upload.
        bucketReady = null;
        throw error;
      }
    })();
  }
  return bucketReady;
}

/** Public URL for a stored object path (absolute Supabase URL). */
export function publicPhotoUrl(objectPath: string) {
  const clean = objectPath.replace(/^\/+/, "");
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${clean}`;
}

/**
 * Extract the storage object path from whatever we stored in `profiles.photo_url` — historically
 * a full public URL, going forward possibly just the relative path.
 */
export function photoObjectPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const s = String(stored);
  const m = s.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/);
  if (m) return decodeURIComponent(m[1]);
  if (!/^https?:\/\//i.test(s)) return s.replace(/^\/+/, "");
  return null;
}

/**
 * Short-lived signed URL for a stored photo. Falls back to the public URL when the object path
 * can't be resolved or signing fails, so a misconfiguration never blanks every photo.
 */
export async function signedPhotoUrl(
  stored: string | null | undefined,
  expiresInSec = 60 * 60
): Promise<string | null> {
  const objectPath = photoObjectPath(stored);
  if (!objectPath) return stored ?? null;
  try {
    const client = storageClient();
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, expiresInSec);
    if (error || !data?.signedUrl) return publicPhotoUrl(objectPath);
    return data.signedUrl;
  } catch {
    return publicPhotoUrl(objectPath);
  }
}

/**
 * Blur `buf` and upload it as a standalone object. Never throws — a failure here must not break
 * the (already-succeeded) original upload; callers get `null` and can retry later.
 */
async function uploadBlurredVariant(
  client: SupabaseClient,
  userId: bigint | string,
  buf: Buffer
): Promise<string | null> {
  try {
    const blurred = await blurImageBuffer(buf);
    const token = randomBytes(8).toString("hex");
    const objectPath = `blurred/${userId}-blur-${Date.now()}-${token}.jpg`;
    const { error } = await client.storage
      .from(BUCKET)
      .upload(objectPath, blurred, { contentType: "image/jpeg", upsert: false });
    if (error) return null;
    return publicPhotoUrl(objectPath);
  } catch {
    return null;
  }
}

/**
 * Backfill path for photos that predate the blur pipeline: fetch the original bytes and blur +
 * upload a derivative. Used lazily (on first Browse read) rather than a bulk migration. The
 * bucket is private, so this must download via the authenticated storage client — a plain
 * `fetch()` on the stored URL would 400 ("Bucket not found" is Supabase's response for an
 * unauthenticated request against a private bucket).
 */
export async function saveBlurredVariantFromUrl(
  userId: bigint | string,
  originalUrl: string
): Promise<string | null> {
  try {
    const client = storageClient();
    await ensureBucket(client);
    const objectPath = photoObjectPath(originalUrl);
    if (!objectPath) return null;
    const { data, error } = await client.storage.from(BUCKET).download(objectPath);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return uploadBlurredVariant(client, userId, buf);
  } catch {
    return null;
  }
}

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Persist a data-URL image to Supabase Storage. Writes a sidecar `.meta.json`
 * carrying a lightweight moderation watermark string (invisible ops tag).
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
  if (buf.length > MAX_BYTES) throw new Error("Image must be under 8MB");

  const client = storageClient();
  await ensureBucket(client);

  const ext = extFromMime(mime);
  const token = randomBytes(8).toString("hex");
  const filename = `${userId}-${kind}-${Date.now()}-${token}.${ext}`;
  const objectPath = `${kind}/${filename}`;

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(objectPath, buf, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

  const watermark = createHash("sha256")
    .update(`${userId}:${kind}:${filename}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);

  await client.storage
    .from(BUCKET)
    .upload(
      `${objectPath}.meta.json`,
      Buffer.from(
        JSON.stringify({
          userId: String(userId),
          kind,
          mime,
          watermark,
          bytes: buf.length,
          createdAt: new Date().toISOString(),
        })
      ),
      { contentType: "application/json", upsert: true }
    )
    .catch(() => undefined);

  // Only "public" photos are ever shown to other members pre-match — verification photos are
  // admin-only and never need a blurred rendition.
  const blurUrl = kind === "public" ? await uploadBlurredVariant(client, userId, buf) : null;

  return {
    relative: objectPath,
    url: publicPhotoUrl(objectPath),
    blurUrl,
    watermark,
    bytes: buf.length,
  };
}
