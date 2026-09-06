import { createHash, randomBytes } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/** Create the bucket on first use; ignore "already exists". */
async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await client.storage.createBucket(BUCKET, {
        public: true,
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

  return {
    relative: objectPath,
    url: publicPhotoUrl(objectPath),
    watermark,
    bytes: buf.length,
  };
}
