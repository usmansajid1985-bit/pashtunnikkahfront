import { randomBytes } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

/**
 * Settings → Give us feedback. Members send general feedback, bug reports or feature ideas with
 * up to 3 screenshots; the admin panel's Feedback inbox (admin/src/app/feedback) reads them.
 * Screenshots go to a PRIVATE storage bucket — only admins see them, via short-lived signed links.
 */

export const FEEDBACK_KINDS = ["general", "bug", "feature"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_MAX_SCREENSHOTS = 3;
export const FEEDBACK_MAX_BYTES = 5 * 1024 * 1024;

const BUCKET = process.env.SUPABASE_FEEDBACK_BUCKET || "feedback";

let ensured = false;
export async function ensureFeedbackSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS member_feedback (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      kind VARCHAR(16) NOT NULL,
      subject VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
      user_agent VARCHAR(400),
      status VARCHAR(16) NOT NULL DEFAULT 'new',
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS member_feedback_created_idx ON member_feedback (created_at DESC)`);
  ensured = true;
}

let client: SupabaseClient | null = null;
let bucketReady = false;
async function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Screenshot uploads aren't configured.");
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!bucketReady) {
    const { error } = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: FEEDBACK_MAX_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (error && !/exist/i.test(error.message)) throw error;
    bucketReady = true;
  }
  return client;
}

/** Store one screenshot privately; returns its object path (never a public URL). */
export async function saveFeedbackScreenshot(userId: bigint, file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Screenshots must be JPG, PNG or WEBP images.");
  }
  if (file.size > FEEDBACK_MAX_BYTES) throw new Error("Each screenshot must be 5MB or smaller.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${Date.now()}-${randomBytes(5).toString("hex")}.${ext}`;
  const { error } = await (await storage())
    .storage.from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);
  return path;
}

export async function saveFeedback(input: {
  userId: bigint;
  kind: FeedbackKind;
  subject: string;
  message: string;
  screenshots: string[];
  userAgent: string | null;
}) {
  await ensureFeedbackSchema();
  const rows = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
    `INSERT INTO member_feedback (user_id, kind, subject, message, screenshots, user_agent)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
    input.userId,
    input.kind,
    input.subject,
    input.message,
    JSON.stringify(input.screenshots),
    input.userAgent
  );
  return rows[0]?.id.toString() ?? null;
}
