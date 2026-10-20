import { prisma } from "@/lib/prisma";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";
import {
  normaliseCategory,
  parseBlocks,
  type AnnouncementCard,
  type AnnouncementPage,
} from "@/lib/announcements-shared";

export type { AnnouncementCard, AnnouncementPage } from "@/lib/announcements-shared";

let ensured = false;

/**
 * N52: card + full-page fields for announcements. The admin panel (admin/src/lib/announcements.ts)
 * runs the same idempotent DDL, so either app can deploy first.
 */
export async function ensureAnnouncementsSchema() {
  if (ensured) return;
  await ensureNotificationsSchema();
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE announcements
        ADD COLUMN IF NOT EXISTS slug VARCHAR(160),
        ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS icon_emoji VARCHAR(16) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS page_title VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS subtitle VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS closing TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS sign_off VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS preview_token VARCHAR(64),
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS announcements_slug_key ON announcements (slug) WHERE slug IS NOT NULL`
    );
    // Rows made before slugs existed get one from their title + id, so every announcement has a URL.
    await prisma.$executeRawUnsafe(`
      UPDATE announcements
         SET slug = trim(both '-' from regexp_replace(lower(coalesce(nullif(title, ''), 'announcement')), '[^a-z0-9]+', '-', 'g')) || '-' || id
       WHERE slug IS NULL
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureAnnouncementsSchema", err);
  }
}

type Row = {
  id: bigint;
  slug: string;
  title: string;
  body: string;
  summary: string;
  icon_emoji: string;
  image_url: string;
  category: string;
  pinned: boolean;
  publish_at: Date | null;
  created_at: Date;
  sort_order: number;
  page_title: string;
  subtitle: string;
  cover_url: string;
  content: unknown;
  closing: string;
  sign_off: string;
  status: string;
  preview_token: string | null;
};

const COLS = `id, slug, title, body, summary, icon_emoji, image_url, category, pinned, publish_at, created_at,
  sort_order, page_title, subtitle, cover_url, content, closing, sign_off, status, preview_token`;

/** Live = published and its publish time has come (a future time = scheduled). */
const LIVE = `status = 'published' AND archived_at IS NULL AND (publish_at IS NULL OR publish_at <= NOW())`;

const DAY = 24 * 60 * 60 * 1000;

function toCard(r: Row, readSet: Set<string>): AnnouncementCard {
  const published = r.publish_at ?? r.created_at;
  const age = Date.now() - published.getTime();
  return {
    id: r.id.toString(),
    slug: r.slug,
    title: r.title,
    summary: r.summary || r.body.split("\n")[0]?.slice(0, 200) || "",
    emoji: r.icon_emoji || "📢",
    thumbnailUrl: r.image_url || null,
    category: normaliseCategory(r.category),
    pinned: r.pinned,
    read: readSet.has(r.id.toString()),
    publishedAt: published.toISOString(),
    section: r.pinned ? "pinned" : age < 7 * DAY ? "this_week" : age < 31 * DAY ? "last_month" : "earlier",
  };
}

async function readIds(userId: bigint): Promise<Set<string>> {
  const rows = await prisma
    .$queryRawUnsafe<{ announcement_id: bigint }[]>(
      `SELECT announcement_id FROM announcement_reads WHERE user_id = $1`,
      userId
    )
    .catch(() => []);
  return new Set(rows.map((r) => r.announcement_id.toString()));
}

/** Notifications → Announcements: pinned first, then display order, then newest. */
export async function getAnnouncementCards(userId: bigint, limit = 60): Promise<AnnouncementCard[]> {
  await ensureAnnouncementsSchema();
  const [rows, reads] = await Promise.all([
    prisma
      .$queryRawUnsafe<Row[]>(
        `SELECT ${COLS} FROM announcements WHERE ${LIVE}
          ORDER BY pinned DESC, sort_order ASC, COALESCE(publish_at, created_at) DESC LIMIT $1`,
        limit
      )
      .catch(() => [] as Row[]),
    readIds(userId),
  ]);
  return rows.map((r) => toCard(r, reads));
}

/** Unread live announcements — the pink badge on the tab and part of the bell count. */
export async function unreadAnnouncementCount(userId: bigint): Promise<number> {
  await ensureAnnouncementsSchema();
  const rows = await prisma
    .$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) n FROM announcements a
        WHERE ${LIVE.replace(/(status|archived_at|publish_at)/g, "a.$1")}
          AND NOT EXISTS (SELECT 1 FROM announcement_reads r WHERE r.user_id = $1 AND r.announcement_id = a.id)`,
      userId
    )
    .catch(() => [{ n: BigInt(0) }]);
  return Number(rows[0]?.n ?? 0);
}

/**
 * One announcement by its URL. Members only ever get live ones; the admin's preview link carries
 * the row's secret preview token so drafts and scheduled posts can be checked before publishing.
 */
export async function getAnnouncementPage(
  slug: string,
  userId: bigint | null,
  previewToken?: string | null
): Promise<AnnouncementPage | null> {
  await ensureAnnouncementsSchema();
  const rows = await prisma
    .$queryRawUnsafe<Row[]>(`SELECT ${COLS}, archived_at FROM announcements WHERE slug = $1 LIMIT 1`, slug)
    .catch(() => [] as Row[]);
  const r = rows[0] as (Row & { archived_at: Date | null }) | undefined;
  if (!r) return null;
  const live =
    r.status === "published" && !r.archived_at && (!r.publish_at || r.publish_at.getTime() <= Date.now());
  const isPreview = !live && Boolean(previewToken && r.preview_token && previewToken === r.preview_token);
  if (!live && !isPreview) return null;
  const reads = userId ? await readIds(userId) : new Set<string>();
  return {
    ...toCard(r, reads),
    pageTitle: r.page_title || r.title,
    subtitle: r.subtitle,
    coverUrl: r.cover_url || null,
    // Announcements written before the page editor existed have only a plain body.
    blocks: (() => {
      const blocks = parseBlocks(r.content);
      if (blocks.length || !r.body.trim()) return blocks;
      return r.body
        .split(/\n{2,}/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ type: "paragraph" as const, text }));
    })(),
    closing: r.closing,
    signOff: r.sign_off,
    isPreview,
  };
}

/** "More announcements" under a page: a few other live ones, pinned and newest first. */
export async function getOtherAnnouncements(userId: bigint, excludeId: string, limit = 3) {
  const cards = await getAnnouncementCards(userId, limit + 1);
  return cards.filter((c) => c.id !== excludeId).slice(0, limit);
}

export async function markAnnouncementRead(userId: bigint, announcementId: string) {
  await ensureAnnouncementsSchema();
  await prisma
    .$executeRawUnsafe(
      `INSERT INTO announcement_reads (user_id, announcement_id) VALUES ($1, $2)
       ON CONFLICT (user_id, announcement_id) DO NOTHING`,
      userId,
      BigInt(announcementId)
    )
    .catch(() => undefined);
}
