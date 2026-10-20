/**
 * Announcements — client-safe types shared by the Notifications list, the full announcement page
 * and (mirrored in admin/src/lib/announcements.ts) the admin editor. Content is data, never HTML:
 * the page is built from typed blocks and a tiny inline formatter, so nothing an admin types can
 * inject markup.
 */

export const ANNOUNCEMENT_CATEGORIES = {
  product_update: { label: "Product Update", tint: "bg-rose-50 text-rose-600" },
  community: { label: "Community", tint: "bg-violet-50 text-violet-600" },
  safety: { label: "Safety", tint: "bg-blue-50 text-blue-600" },
  important: { label: "Important", tint: "bg-amber-50 text-amber-700" },
} as const;

export type AnnouncementCategory = keyof typeof ANNOUNCEMENT_CATEGORIES;

/** Older rows used finer categories — fold them into the four shown to members. */
export function normaliseCategory(raw: string | null | undefined): AnnouncementCategory {
  const c = (raw || "").toLowerCase();
  if (c in ANNOUNCEMENT_CATEGORIES) return c as AnnouncementCategory;
  if (c === "feature" || c === "major") return "product_update";
  if (c === "safety") return "safety";
  if (c === "maintenance" || c === "policy") return "important";
  return "community";
}

export type FeatureItem = { emoji: string; title: string; description?: string; url?: string };

export type AnnouncementBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; url: string; caption?: string }
  | { type: "features"; title?: string; items: FeatureItem[] }
  | { type: "callout"; emoji?: string; title?: string; text: string }
  | { type: "divider" };

const BLOCK_TYPES = new Set(["heading", "paragraph", "list", "image", "features", "callout", "divider"]);

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");

/** Validate stored JSON into blocks; anything unknown or malformed is dropped, never rendered raw. */
export function parseBlocks(raw: unknown): AnnouncementBlock[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: AnnouncementBlock[] = [];
  for (const b of list) {
    if (!b || typeof b !== "object" || !BLOCK_TYPES.has((b as { type?: string }).type || "")) continue;
    const x = b as Record<string, unknown>;
    switch (x.type) {
      case "heading":
      case "paragraph":
        if (str(x.text).trim()) out.push({ type: x.type, text: str(x.text) });
        break;
      case "list": {
        const items = (Array.isArray(x.items) ? x.items : []).map((i) => str(i, 600)).filter((i) => i.trim());
        if (items.length) out.push({ type: "list", items });
        break;
      }
      case "image":
        if (safeUrl(str(x.url, 800))) out.push({ type: "image", url: str(x.url, 800), caption: str(x.caption, 300) || undefined });
        break;
      case "features": {
        const items = (Array.isArray(x.items) ? x.items : [])
          .map((i) => i as Record<string, unknown>)
          .map((i) => ({
            emoji: str(i?.emoji, 16),
            title: str(i?.title, 160),
            description: str(i?.description, 400) || undefined,
            url: safeUrl(str(i?.url, 800)) ? str(i?.url, 800) : undefined,
          }))
          .filter((i) => i.title.trim());
        if (items.length) out.push({ type: "features", title: str(x.title, 160) || undefined, items });
        break;
      }
      case "callout":
        if (str(x.text).trim()) out.push({ type: "callout", emoji: str(x.emoji, 16) || undefined, title: str(x.title, 160) || undefined, text: str(x.text) });
        break;
      case "divider":
        out.push({ type: "divider" });
        break;
    }
  }
  return out;
}

/** Links and images may only be http(s) or a site-relative path. */
export function safeUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\//i.test(u) || (u.startsWith("/") && !u.startsWith("//"));
}

/** Inline formatting inside text blocks: **bold**, *italic* and [label](url). */
export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "link"; text: string; url: string };

export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] != null) out.push({ kind: "bold", text: m[1] });
    else if (m[2] != null) out.push({ kind: "italic", text: m[2] });
    else if (m[3] != null && safeUrl(m[4])) out.push({ kind: "link", text: m[3], url: m[4] });
    else out.push({ kind: "text", text: m[0] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export type AnnouncementCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  emoji: string;
  thumbnailUrl: string | null;
  category: AnnouncementCategory;
  pinned: boolean;
  read: boolean;
  publishedAt: string;
  /** Pinned first; the rest by age, like the mockup. */
  section: "pinned" | "this_week" | "last_month" | "earlier";
};

export type AnnouncementPage = AnnouncementCard & {
  pageTitle: string;
  subtitle: string;
  coverUrl: string | null;
  blocks: AnnouncementBlock[];
  closing: string;
  signOff: string;
  isPreview: boolean;
};

export function announcementDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
