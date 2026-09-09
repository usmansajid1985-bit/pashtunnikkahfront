import { prisma } from "@/lib/prisma";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";
import { fullProfilePhotoVisibility } from "@/lib/photo-access";

/**
 * V2 notification domain layer (spec: "PN V2 — In-App Notifications & Updates System").
 *
 * The bell shows **Activity** (what happened to me) and **Updates** (what PN is telling me).
 * Activity rows live in `notifications`; Updates come from published `announcements`.
 *
 * Key rules from the spec:
 *  - §7/§18  Repeat activity from the same source is collapsed via `group_key`
 *            ("PNF142 sent you 5 messages"), not one row per event.
 *  - §15     Bell state and nav badges are independent — this module owns the bell counts
 *            only; Requests/Chats badges are counted from their own tables.
 *  - §21     Per-category mute via `notification_preferences.notify_*`.
 *  - §20     Rows older than NOTIFICATION_TTL_DAYS are treated as expired.
 */

export const NOTIFICATION_TTL_DAYS = 60;

/** Coarse category — drives the per-category preference and the push decision. */
export type NotificationCategory =
  | "request" // incoming / accepted / declined match requests
  | "message" // chat messages
  | "profile_view" // someone viewed your profile
  | "wali" // wali / family activity
  | "photo" // photo reveal requests + grants
  | "account" // profile status, verification, membership, referrals, security
  | "update"; // PN announcements (not stored in `notifications`)

const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  match: "request",
  request: "request",
  request_accepted: "request",
  message: "message",
  profile_view: "profile_view",
  wali: "wali",
  photo: "photo",
  system: "account",
  profile_status: "account",
  membership: "account",
  referral: "account",
};

export function categoryForType(type: string): NotificationCategory {
  return TYPE_TO_CATEGORY[type] ?? "account";
}

const CATEGORY_PREF_COLUMN: Record<NotificationCategory, string | null> = {
  request: "notify_requests",
  message: "notify_messages",
  profile_view: "notify_profile_views",
  wali: "notify_wali",
  photo: "notify_wali",
  account: null, // account/security notifications are not mutable
  update: "notify_updates",
};

type PrefRow = {
  push_enabled: boolean;
  notify_requests: boolean;
  notify_messages: boolean;
  notify_profile_views: boolean;
  notify_wali: boolean;
  notify_updates: boolean;
};

async function loadPrefs(userId: bigint): Promise<PrefRow | null> {
  try {
    const rows = await prisma.$queryRaw<PrefRow[]>`
      SELECT push_enabled, notify_requests, notify_messages, notify_profile_views,
             notify_wali, notify_updates
      FROM notification_preferences WHERE user_id = ${userId} LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Should this category produce an in-app notification for the user? */
function categoryEnabled(prefs: PrefRow | null, category: NotificationCategory): boolean {
  if (!prefs) return true;
  const col = CATEGORY_PREF_COLUMN[category];
  if (!col) return true;
  return (prefs as unknown as Record<string, boolean>)[col] !== false;
}

async function nextNotificationId(): Promise<bigint> {
  try {
    const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('notifications_id_seq') as nextval`;
    if (rows[0]?.nextval) return rows[0].nextval;
  } catch {
    /* sequence missing in this DB */
  }
  const max = await prisma.notifications.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export type CreateNotificationInput = {
  recipientUserId: bigint;
  type: string;
  title: string;
  body: string;
  url?: string | null;
  tag?: string | null;
  actorUserId?: bigint | null;
  relatedRequestId?: bigint | null;
  /** When set, an existing unread row with the same key is updated + counted instead of a new row. */
  groupKey?: string | null;
  /** Body template for the grouped state, receives the running count (spec §7). */
  groupedBody?: (count: number) => string;
  groupedTitle?: (count: number) => string;
  metadata?: Record<string, unknown>;
};

export type CreateNotificationResult = {
  created: boolean;
  suppressed: boolean;
  id?: string;
};

/**
 * Write (or fold into) an Activity notification. Returns `suppressed` when the user has muted
 * the category — callers can still decide to send a push for account/security items.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<CreateNotificationResult> {
  await ensureNotificationsSchema();
  const category = categoryForType(input.type);
  const prefs = await loadPrefs(input.recipientUserId);
  if (!categoryEnabled(prefs, category)) {
    return { created: false, suppressed: true };
  }

  const now = new Date();

  if (input.groupKey) {
    const existing = await prisma.notifications
      .findFirst({
        where: { recipient_user_id: input.recipientUserId, group_key: input.groupKey },
      })
      .catch(() => null);

    if (existing) {
      const count = (existing.group_count ?? 1) + 1;
      await prisma.notifications.update({
        where: { id: existing.id },
        data: {
          group_count: count,
          title: input.groupedTitle ? input.groupedTitle(count) : input.title,
          body: input.groupedBody ? input.groupedBody(count) : input.body,
          url: input.url ?? existing.url,
          actor_user_id: input.actorUserId ?? existing.actor_user_id,
          read_at: null,
          created_at: now,
          updated_at: now,
        },
      });
      return { created: false, suppressed: false, id: existing.id.toString() };
    }
  }

  const id = await nextNotificationId();
  await prisma.notifications.create({
    data: {
      id,
      recipient_user_id: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      tag: input.tag ?? null,
      actor_user_id: input.actorUserId ?? null,
      group_key: input.groupKey ?? null,
      group_count: 1,
      related_request_id: input.relatedRequestId ?? null,
      metadata: input.metadata ? (input.metadata as object) : undefined,
      created_at: now,
      updated_at: now,
    },
  });
  return { created: true, suppressed: false, id: id.toString() };
}

/** Push allowed for this category? (account/security always; others follow the pref.) */
export async function pushAllowedForCategory(
  userId: bigint,
  category: NotificationCategory
): Promise<boolean> {
  const prefs = await loadPrefs(userId);
  if (!prefs) return true;
  if (prefs.push_enabled === false) return false;
  return categoryEnabled(prefs, category);
}

// ---------------------------------------------------------------------------
// Bell counts
// ---------------------------------------------------------------------------

export type BellCounts = {
  /** Unread Activity + unread Updates — drives the bell dot. */
  bellUnread: number;
  activityUnread: number;
  updatesUnread: number;
};

export async function getBellCounts(userId: bigint): Promise<BellCounts> {
  await ensureNotificationsSchema();
  const since = new Date(Date.now() - NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [activityUnread, publishedUpdates, readUpdates] = await Promise.all([
    prisma.notifications.count({
      where: { recipient_user_id: userId, read_at: null, created_at: { gte: since } },
    }),
    prisma.announcements.count({
      where: {
        status: "published",
        OR: [{ publish_at: null }, { publish_at: { lte: new Date() } }],
      },
    }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) n FROM announcement_reads WHERE user_id = ${userId}
    `.then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
  ]);

  const updatesUnread = Math.max(0, publishedUpdates - readUpdates);
  return {
    activityUnread,
    updatesUnread,
    bellUnread: activityUnread + updatesUnread,
  };
}

export async function markAllActivityRead(userId: bigint): Promise<void> {
  await ensureNotificationsSchema();
  await prisma.notifications.updateMany({
    where: { recipient_user_id: userId, read_at: null },
    data: { read_at: new Date() },
  });
}

export async function markActivityRead(userId: bigint, id: bigint): Promise<void> {
  await prisma.notifications.updateMany({
    where: { id, recipient_user_id: userId },
    data: { read_at: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export type ActivityNotification = {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
  groupCount: number;
  read: boolean;
  createdAt: string;
  /** "today" | "yesterday" | "earlier" — for the date sections (spec §19). */
  section: "today" | "yesterday" | "earlier";
  /** Thumbnail — always rendered blurred by the client (spec §9). null → generic placeholder. */
  thumbnailUrl: string | null;
  avatarSeed: number;
  /** true when the viewer should be shown an "Upgrade to see who viewed you" CTA (spec §4). */
  upgradeCta: boolean;
};

function sectionFor(d: Date, now = new Date()): ActivityNotification["section"] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfToday - 24 * 60 * 60 * 1000) return "yesterday";
  return "earlier";
}

export async function getActivityFeed(
  userId: bigint,
  opts: { isGold: boolean; limit?: number } = { isGold: false }
): Promise<ActivityNotification[]> {
  await ensureNotificationsSchema();
  const since = new Date(Date.now() - NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.notifications.findMany({
    where: { recipient_user_id: userId, created_at: { gte: since } },
    orderBy: { created_at: "desc" },
    take: opts.limit ?? 60,
  });

  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as bigint[])];
  const actors =
    actorIds.length > 0
      ? await prisma.profiles.findMany({
          where: { user_id: { in: actorIds } },
          select: { user_id: true, profile_code: true, photo_url: true, id: true },
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.user_id.toString(), a]));

  // Resolve, per actor, whether the recipient may see their photo unblurred elsewhere. The
  // thumbnail is still always blurred in the UI, but we only ship the real URL when the viewer
  // is entitled to it — an unmatched viewer gets a placeholder (spec §9).
  const visibility = new Map<string, boolean>();
  await Promise.all(
    actorIds.map(async (aid) => {
      const v = await fullProfilePhotoVisibility(userId, aid);
      visibility.set(aid.toString(), v === "visible");
    })
  );

  const now = new Date();
  return rows.map((r) => {
    const category = categoryForType(r.type);
    const actor = r.actor_user_id ? actorMap.get(r.actor_user_id.toString()) : undefined;
    const maskIdentity = r.type === "profile_view" && !opts.isGold;

    let title = r.title;
    let body = r.body;
    if (maskIdentity) {
      title = "Someone viewed your profile";
      body = "Upgrade to Gold to see who viewed you.";
    }

    const canSeePhoto = actor ? visibility.get(actor.user_id.toString()) === true : false;
    const thumbnailUrl = !maskIdentity && actor && canSeePhoto ? actor.photo_url : null;

    return {
      id: r.id.toString(),
      type: r.type,
      category,
      title,
      body,
      url: maskIdentity ? "/settings/membership" : r.url,
      groupCount: r.group_count ?? 1,
      read: r.read_at != null,
      createdAt: r.created_at.toISOString(),
      section: sectionFor(r.created_at, now),
      thumbnailUrl,
      avatarSeed: actor ? Number(actor.id % BigInt(70)) : Number(r.id % BigInt(70)),
      upgradeCta: maskIdentity,
    };
  });
}

// ---------------------------------------------------------------------------
// Updates feed (announcements)
// ---------------------------------------------------------------------------

export type UpdateItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  pinned: boolean;
  featured: boolean;
  goldOnly: boolean;
  read: boolean;
  publishedAt: string;
  section: "pinned" | "this_week" | "earlier";
};

export async function getUpdatesFeed(userId: bigint): Promise<UpdateItem[]> {
  await ensureNotificationsSchema();
  const [rows, reads] = await Promise.all([
    prisma.announcements.findMany({
      where: {
        status: "published",
        OR: [{ publish_at: null }, { publish_at: { lte: new Date() } }],
      },
      orderBy: [{ pinned: "desc" }, { publish_at: "desc" }],
      take: 40,
    }),
    prisma.$queryRaw<{ announcement_id: bigint }[]>`
      SELECT announcement_id FROM announcement_reads WHERE user_id = ${userId}
    `.catch(() => [] as { announcement_id: bigint }[]),
  ]);
  const readSet = new Set(reads.map((r) => r.announcement_id.toString()));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return rows.map((a) => {
    const published = a.publish_at ?? a.created_at;
    return {
      id: a.id.toString(),
      title: a.title,
      body: a.body,
      category: a.category ?? "general",
      ctaLabel: a.cta_label,
      ctaUrl: a.cta_url,
      imageUrl: a.image_url ?? "",
      pinned: a.pinned ?? false,
      featured: a.featured ?? false,
      goldOnly: a.gold_only ?? false,
      read: readSet.has(a.id.toString()),
      publishedAt: published.toISOString(),
      section: a.pinned
        ? "pinned"
        : published.getTime() >= weekAgo
          ? "this_week"
          : "earlier",
    };
  });
}

export async function markUpdatesRead(userId: bigint): Promise<void> {
  await ensureNotificationsSchema();
  const published = await prisma.announcements.findMany({
    where: {
      status: "published",
      OR: [{ publish_at: null }, { publish_at: { lte: new Date() } }],
    },
    select: { id: true },
  });
  if (published.length === 0) return;
  const values = published.map((a) => `(${userId}, ${a.id})`).join(",");
  await prisma
    .$executeRawUnsafe(
      `INSERT INTO announcement_reads (user_id, announcement_id) VALUES ${values}
       ON CONFLICT (user_id, announcement_id) DO NOTHING`
    )
    .catch(() => undefined);
}
