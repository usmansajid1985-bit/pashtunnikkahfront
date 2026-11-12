import { prisma } from "@/lib/prisma";
import { ensureNotificationsSchema } from "@/lib/ensure-notifications-schema";
import { fullProfilePhotoVisibility } from "@/lib/photo-access";
import { withoutSameGenderViews } from "@/lib/gender";
import { NOTIFICATION_TTL_DAYS } from "@/lib/notifications";

/**
 * V2.1 grouped Activity feed (spec: "Notifications redesign — developer handoff", Nov 2026).
 *
 * The page used to render one card per raw event (~60 cards for the test account). This module
 * groups raw `notifications` rows into ~12 **rows** on the server, and — crucially — resolves the
 * *current* state of the thing each notification is about (request status, photo-share session,
 * family-pause date) rather than trusting the text saved when the event was created. That live
 * status is what drives the "Needs your attention" section and the in-place Action buttons.
 *
 * Grouping rules (handoff "Grouping rules"):
 *   message        → not a row; its unread count rides on that peer's match row
 *   profile_view   → one row per time bucket ("5 people viewed your profile")
 *   match_accepted → one row per time bucket (one or "X and Y accepted your requests")
 *   tokens         → one row per calendar day
 *   match_request  → one row per request id, carrying its live status
 *   photos_shared  → one row per sender (latest share only)
 *   family pause   → one row per sender; flips to "pause ended" after the date
 *   wali involved  → never grouped; always its own milestone card
 */

export type RowVariant = "standard" | "action" | "milestone";

/** Which filter chip a row belongs to. */
export type RowCategory = "request" | "match" | "family" | "view" | "token" | "photo";

/** Small badge glyph on the avatar. */
export type RowBadge = "request" | "match" | "view" | "photo" | "wali" | "token" | null;

export type RowSection = "today" | "yesterday" | "week" | "older";

export type RequestStatus = "pending" | "accepted" | "declined" | "expired";

/** The live action a row exposes. Absent on plain rows. */
export type RowAction =
  | {
      kind: "request";
      requestId: string;
      status: RequestStatus;
      expiresAt: string | null;
    }
  | {
      kind: "photo";
      state: "available" | "viewing" | "viewed";
      expiresAt: string | null;
      chatUrl: string;
    }
  | {
      kind: "pause";
      ended: boolean;
      closed: boolean;
      askAgainAt: string | null;
      chatUrl: string;
    };

/** A coloured status pill rendered on the right of some rows. */
export type RowPill = { text: string; tone: "amber" | "green" | "grey" };

export type RowActor = {
  code: string;
  thumbnailUrl: string | null;
  avatarSeed: number;
};

export type GroupedRow = {
  key: string;
  /** Every raw notification id folded into this row — all marked read when the row is opened. */
  ids: string[];
  variant: RowVariant;
  category: RowCategory;
  badge: RowBadge;
  title: string;
  body: string;
  url: string | null;
  actors: RowActor[];
  /** Total distinct people behind a group ("and 2 others"). */
  actorTotal: number;
  latest: string;
  unread: boolean;
  section: RowSection;
  needsAction: boolean;
  action?: RowAction;
  pill?: RowPill;
  /** Gold upsell on masked profile-view rows. */
  upgradeCta: boolean;
};

export type GroupedActivity = {
  rows: GroupedRow[];
  /** Rows (by key) that belong in "Needs your attention", soonest deadline first. */
  attentionKeys: string[];
  /** Unread row count — the number the bell/tab should show. */
  unreadRows: number;
  /** ISO cursor for the next (older) page, or null when there is nothing older. */
  nextCursor: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketOf(d: Date, now: Date): RowSection {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfToday - DAY_MS) return "yesterday";
  return now.getTime() - t < 7 * DAY_MS ? "week" : "older";
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Which chip a raw type maps to. */
function chipCategory(type: string): RowCategory {
  switch (type) {
    case "match":
    case "request":
    case "request_reminder":
    case "request_expired":
      return "request";
    case "request_accepted":
      return "match";
    case "wali":
      return "family";
    case "photo":
      return "photo";
    case "profile_view":
      return "view";
    case "request_refund":
      return "token";
    default:
      if (type.startsWith("billing")) return "token";
      return "match";
  }
}

function badgeFor(type: string): RowBadge {
  switch (type) {
    case "match":
    case "request":
    case "request_reminder":
    case "request_expired":
      return "request";
    case "request_accepted":
      return "match";
    case "wali":
      return "wali";
    case "photo":
      return "photo";
    case "profile_view":
      return "view";
    case "request_refund":
      return "token";
    default:
      return type.startsWith("billing") ? "token" : null;
  }
}

type RawRow = {
  id: bigint;
  type: string;
  title: string;
  body: string;
  url: string | null;
  actor_user_id: bigint | null;
  related_request_id: bigint | null;
  group_count: number | null;
  read_at: Date | null;
  created_at: Date;
};

type ActorInfo = { code: string; photoUrl: string | null; avatarSeed: number; canSeePhoto: boolean };

export async function getGroupedActivity(
  userId: bigint,
  opts: { isGold: boolean; before?: Date | null; days?: number } = { isGold: false }
): Promise<GroupedActivity> {
  await ensureNotificationsSchema();
  const now = new Date();
  const days = opts.days ?? 30;
  const ttlFloor = new Date(now.getTime() - NOTIFICATION_TTL_DAYS * DAY_MS);
  const windowEnd = opts.before ?? now;
  const windowStart = new Date(Math.max(windowEnd.getTime() - days * DAY_MS, ttlFloor.getTime()));

  const rawAll = (await withoutSameGenderViews(
    await prisma.notifications.findMany({
      where: {
        recipient_user_id: userId,
        created_at: opts.before ? { gte: windowStart, lt: windowEnd } : { gte: windowStart },
      },
      orderBy: { created_at: "desc" },
    }),
    userId
  )) as RawRow[];

  // Is there anything older than this page? (drives "Show older notifications").
  const olderCount =
    windowStart.getTime() > ttlFloor.getTime()
      ? await prisma.notifications.count({
          where: { recipient_user_id: userId, created_at: { gte: ttlFloor, lt: windowStart } },
        })
      : 0;
  const nextCursor = olderCount > 0 ? windowStart.toISOString() : null;

  // ---- resolve actors (profile code + privacy-gated thumbnail) --------------------------------
  const actorIds = [...new Set(rawAll.map((r) => r.actor_user_id).filter(Boolean) as bigint[])];
  const actorProfiles =
    actorIds.length > 0
      ? await prisma.profiles.findMany({
          where: { user_id: { in: actorIds } },
          select: { user_id: true, profile_code: true, photo_url: true, id: true },
        })
      : [];
  const actorInfo = new Map<string, ActorInfo>();
  await Promise.all(
    actorProfiles.map(async (a) => {
      const v = await fullProfilePhotoVisibility(userId, a.user_id).catch(() => "hidden" as const);
      actorInfo.set(a.user_id.toString(), {
        code: a.profile_code || "A member",
        photoUrl: a.photo_url,
        avatarSeed: Number(a.id % BigInt(70)),
        canSeePhoto: v === "visible",
      });
    })
  );

  const actorOf = (id: bigint | null): (ActorInfo & { userId: string }) | null => {
    if (!id) return null;
    const info = actorInfo.get(id.toString());
    return info ? { ...info, userId: id.toString() } : null;
  };
  const rowActor = (info: ActorInfo | null, seedFallback: bigint): RowActor => ({
    code: info?.code ?? "A member",
    thumbnailUrl: info && info.canSeePhoto ? info.photoUrl : null,
    avatarSeed: info?.avatarSeed ?? Number(seedFallback % BigInt(70)),
  });

  // ---- live status joins ----------------------------------------------------------------------
  const requestIds = [
    ...new Set(
      rawAll
        .filter((r) => ["match", "request", "request_accepted", "request_expired", "request_reminder"].includes(r.type))
        .map((r) => r.related_request_id)
        .filter(Boolean) as bigint[]
    ),
  ];
  const requests =
    requestIds.length > 0
      ? await prisma.match_requests.findMany({
          where: { id: { in: requestIds } },
          select: { id: true, status: true, expires_at: true, accepted_at: true },
        })
      : [];
  const requestMap = new Map(requests.map((r) => [r.id.toString(), r]));

  // Latest photo share per sender → recipient (handoff: one row per sender, latest only).
  const photoSenderIds = [
    ...new Set(rawAll.filter((r) => r.type === "photo").map((r) => r.actor_user_id).filter(Boolean) as bigint[]),
  ];
  const photoShares =
    photoSenderIds.length > 0
      ? await prisma.private_photo_shares.findMany({
          where: { recipient_id: userId, sender_id: { in: photoSenderIds } },
          orderBy: { shared_at: "desc" },
          select: {
            sender_id: true,
            match_request_id: true,
            status: true,
            viewing_started_at: true,
            expires_at: true,
            shared_at: true,
          },
        })
      : [];
  const latestShareBySender = new Map<string, (typeof photoShares)[number]>();
  for (const s of photoShares) {
    const k = s.sender_id.toString();
    if (!latestShareBySender.has(k)) latestShareBySender.set(k, s);
  }

  // Per-peer unread message counts (handoff: messages are not rows; the count rides the match row).
  const unreadMsgRows = await prisma.messages
    .groupBy({
      by: ["sender_id"],
      where: { receiver_id: userId, is_read: false },
      _count: { _all: true },
    })
    .catch(() => [] as { sender_id: bigint; _count: { _all: number } }[]);
  const unreadBySender = new Map<string, number>(
    unreadMsgRows.map((m) => [m.sender_id.toString(), m._count._all])
  );

  // ---- group ----------------------------------------------------------------------------------
  // Older pages are all in the "older" bucket, so suffix the per-bucket keys (views/accepted) with
  // the page window to stop page 2's "older" rows merging into page 1's.
  const pageTag = opts.before ? `#${windowStart.toISOString().slice(0, 10)}` : "";
  const rows = new Map<string, GroupedRow>();
  const order: string[] = [];

  function ensureRow(key: string, seed: GroupedRow): GroupedRow {
    const existing = rows.get(key);
    if (existing) return existing;
    rows.set(key, seed);
    order.push(key);
    return seed;
  }

  for (const n of rawAll) {
    const section = bucketOf(n.created_at, now);
    const createdIso = n.created_at.toISOString();
    const type = n.type;

    // Messages never render as rows.
    if (type === "message") continue;

    // --- grouped: profile views, per time bucket ---
    if (type === "profile_view") {
      const key = `views:${section}${pageTag}`;
      const masked = !opts.isGold;
      const info = masked ? null : actorOf(n.actor_user_id);
      const row = ensureRow(key, {
        key,
        ids: [],
        variant: "standard",
        category: "view",
        badge: "view",
        title: "",
        body: "",
        url: masked ? "/settings/membership?upgrade=1" : "/profile/views",
        actors: [],
        actorTotal: 0,
        latest: createdIso,
        unread: false,
        section,
        needsAction: false,
        upgradeCta: masked,
      });
      row.ids.push(n.id.toString());
      row.unread ||= n.read_at == null;
      if (n.created_at.toISOString() > row.latest) row.latest = createdIso;
      if (!masked && info) {
        if (!row.actors.some((a) => a.code === info.code)) row.actors.push(rowActor(info, n.id));
      }
      row.actorTotal += 1;
      continue;
    }

    // --- grouped: accepted matches, per time bucket ---
    if (type === "request_accepted") {
      const key = `accepted:${section}${pageTag}`;
      const info = actorOf(n.actor_user_id);
      const row = ensureRow(key, {
        key,
        ids: [],
        variant: "standard",
        category: "match",
        badge: "match",
        title: "",
        body: "",
        url: n.url,
        actors: [],
        actorTotal: 0,
        latest: createdIso,
        unread: false,
        section,
        needsAction: false,
        upgradeCta: false,
      });
      row.ids.push(n.id.toString());
      row.unread ||= n.read_at == null;
      if (createdIso > row.latest) {
        row.latest = createdIso;
        row.url = n.url; // link to the most recent match's chat
      }
      if (info && !row.actors.some((a) => a.code === info.code)) row.actors.push(rowActor(info, n.id));
      row.actorTotal = row.actors.length;
      continue;
    }

    // --- grouped: tokens, per calendar day ---
    if (type === "request_refund" || type.startsWith("billing")) {
      const key = `tokens:${dayKey(n.created_at)}`;
      const row = ensureRow(key, {
        key,
        ids: [],
        variant: "standard",
        category: "token",
        badge: "token",
        title: n.title,
        body: n.body,
        url: n.url ?? "/settings/tokens",
        actors: [],
        actorTotal: 0,
        latest: createdIso,
        unread: false,
        section,
        needsAction: false,
        upgradeCta: false,
      });
      row.ids.push(n.id.toString());
      row.unread ||= n.read_at == null;
      if (createdIso > row.latest) {
        row.latest = createdIso;
        row.title = n.title;
        row.body = n.body;
      }
      continue;
    }

    // --- per request id: incoming / reminder / expired match requests (live status) ---
    if (["match", "request", "request_reminder", "request_expired"].includes(type) && n.related_request_id) {
      const key = `request:${n.related_request_id.toString()}`;
      const info = actorOf(n.actor_user_id);
      const live = requestMap.get(n.related_request_id.toString());
      const status = (live?.status as RequestStatus | undefined) ?? "pending";
      const existing = rows.get(key);
      const row = ensureRow(key, {
        key,
        ids: [],
        variant: status === "pending" ? "action" : "standard",
        category: "request",
        badge: "request",
        title: "",
        body: "",
        url: status === "pending" ? "/requests?tab=incoming" : n.url,
        actors: info ? [rowActor(info, n.id)] : [],
        actorTotal: info ? 1 : 0,
        latest: createdIso,
        unread: false,
        section,
        needsAction: status === "pending",
        action: {
          kind: "request",
          requestId: n.related_request_id.toString(),
          status,
          expiresAt: live?.expires_at ? live.expires_at.toISOString() : null,
        },
        upgradeCta: false,
      });
      row.ids.push(n.id.toString());
      row.unread ||= n.read_at == null;
      if (createdIso > row.latest) row.latest = createdIso;
      if (!existing && info && row.actors.length === 0) row.actors.push(rowActor(info, n.id));
      continue;
    }

    // --- per sender: photo shares (live session state) ---
    if (type === "photo" && n.actor_user_id) {
      const key = `photos:${n.actor_user_id.toString()}`;
      const info = actorOf(n.actor_user_id);
      const share = latestShareBySender.get(n.actor_user_id.toString());
      let state: "available" | "viewing" | "viewed" = "available";
      if (share) {
        if (share.viewing_started_at) {
          const active = share.expires_at && share.expires_at.getTime() > now.getTime();
          state = active ? "viewing" : "viewed";
        } else if (share.status === "expired" || share.status === "closed") {
          state = "viewed";
        }
      }
      const chatUrl = `/chats/${(share?.match_request_id ?? n.related_request_id ?? 0n).toString()}`;
      const existing = rows.get(key);
      const row = ensureRow(key, {
        key,
        ids: [],
        variant: state === "available" ? "action" : "standard",
        category: "photo",
        badge: "photo",
        title: "",
        body: "",
        url: chatUrl,
        actors: info ? [rowActor(info, n.id)] : [],
        actorTotal: info ? 1 : 0,
        latest: createdIso,
        unread: false,
        section,
        needsAction: state === "available",
        action: { kind: "photo", state, expiresAt: share?.expires_at?.toISOString() ?? null, chatUrl },
        pill:
          state === "viewing"
            ? { text: "60-second private view", tone: "amber" }
            : state === "viewed"
              ? { text: "Viewing closed", tone: "grey" }
              : undefined,
        upgradeCta: false,
      });
      row.ids.push(n.id.toString());
      row.unread ||= n.read_at == null;
      if (createdIso > row.latest) row.latest = createdIso;
      if (existing) void existing; // state resolved once from the latest share
      continue;
    }

    // --- wali: milestone OR family pause (distinguished by the saved title) ---
    if (type === "wali") {
      const isPause = /not ready to involve family/i.test(n.title);
      if (isPause && n.related_request_id) {
        const key = `pause:${n.related_request_id.toString()}`;
        const info = actorOf(n.actor_user_id);
        const chatUrl = n.url ?? `/chats/${n.related_request_id.toString()}`;
        ensureRow(key, {
          key,
          ids: [n.id.toString()],
          variant: "standard", // upgraded to "action" after the pause-date resolve below
          category: "family",
          badge: "wali",
          title: n.title,
          body: n.body,
          url: chatUrl,
          actors: info ? [rowActor(info, n.id)] : [],
          actorTotal: info ? 1 : 0,
          latest: createdIso,
          unread: n.read_at == null,
          section,
          needsAction: false,
          action: { kind: "pause", ended: false, closed: false, askAgainAt: null, chatUrl },
          upgradeCta: false,
        });
        const row = rows.get(key)!;
        if (!row.ids.includes(n.id.toString())) row.ids.push(n.id.toString());
        row.unread ||= n.read_at == null;
        if (createdIso > row.latest) row.latest = createdIso;
        continue;
      }
      // Genuine milestone — never grouped.
      const key = `wali:${n.id.toString()}`;
      const info = actorOf(n.actor_user_id);
      ensureRow(key, {
        key,
        ids: [n.id.toString()],
        variant: "milestone",
        category: "family",
        badge: "wali",
        title: n.title,
        body: n.body,
        url: n.url,
        actors: info ? [rowActor(info, n.id)] : [],
        actorTotal: info ? 1 : 0,
        latest: createdIso,
        unread: n.read_at == null,
        section,
        needsAction: false,
        upgradeCta: false,
      });
      continue;
    }

    // --- everything else: one row each ---
    const key = `n:${n.id.toString()}`;
    const info = actorOf(n.actor_user_id);
    ensureRow(key, {
      key,
      ids: [n.id.toString()],
      variant: "standard",
      category: chipCategory(type),
      badge: badgeFor(type),
      title: n.title,
      body: n.body,
      url: n.url,
      actors: info ? [rowActor(info, n.id)] : [],
      actorTotal: info ? 1 : 0,
      latest: createdIso,
      unread: n.read_at == null,
      section,
      needsAction: false,
      upgradeCta: false,
    });
  }

  // ---- resolve family-pause live state (needs getFamilyView per request) ----------------------
  const { getFamilyView } = await import("@/lib/family-flow");
  await Promise.all(
    [...rows.values()]
      .filter((r) => r.action?.kind === "pause")
      .map(async (r) => {
        const action = r.action as Extract<RowAction, { kind: "pause" }>;
        const requestId = r.key.slice("pause:".length);
        const view = await getFamilyView(BigInt(requestId), userId).catch(() => null);
        const canAt = view?.request.canRequestAt ?? null;
        const ended = !view?.request.closed && (!canAt || new Date(canAt).getTime() <= now.getTime());
        action.askAgainAt = canAt;
        action.closed = Boolean(view?.request.closed);
        action.ended = ended && !view?.request.closed;
        if (action.ended) {
          r.variant = "action";
          r.needsAction = true;
        }
      })
  );

  // ---- finalise copy that depends on the grouped totals ---------------------------------------
  for (const row of rows.values()) {
    // profile views
    if (row.category === "view" && row.badge === "view" && row.key.startsWith("views:")) {
      if (row.upgradeCta) {
        row.title = `${row.actorTotal} ${row.actorTotal === 1 ? "person" : "people"} viewed your profile`;
        row.body = "Upgrade to Gold to see who viewed you.";
      } else {
        row.title = `${row.actorTotal} ${row.actorTotal === 1 ? "person" : "people"} viewed your profile`;
        const names = row.actors.slice(0, 3).map((a) => a.code);
        const others = row.actorTotal - names.length;
        row.body = others > 0 ? `${names.join(", ")} and ${others} other${others === 1 ? "" : "s"}` : names.join(", ");
      }
    }

    // accepted matches
    if (row.key.startsWith("accepted:")) {
      const names = row.actors.map((a) => a.code);
      if (names.length <= 1) {
        row.title = `${names[0] ?? "Someone"} accepted your match request`;
      } else if (names.length === 2) {
        row.title = `${names[0]} and ${names[1]} accepted your requests`;
      } else {
        row.title = `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 === 1 ? "" : "s"} accepted your requests`;
      }
      // Fold in unread message counts for these peers (messages are not their own rows).
      const unread = row.actors.reduce((sum, a) => {
        const sender = actorProfiles.find((p) => p.profile_code === a.code);
        return sum + (sender ? unreadBySender.get(sender.user_id.toString()) ?? 0 : 0);
      }, 0);
      row.body = unread > 0 ? `You're matched · ${unread} new message${unread === 1 ? "" : "s"}` : "You're matched";
    }

    // incoming request rows — set copy from live status
    if (row.action?.kind === "request") {
      const name = row.actors[0]?.code ?? "A member";
      const status = row.action.status;
      row.title =
        status === "pending"
          ? `${name} sent you a match request`
          : status === "accepted"
            ? `${name} accepted your match request`
            : status === "declined"
              ? `Your request to ${name} was declined`
              : `Your request to ${name} expired`;
      row.body = "";
      if (status === "accepted") row.pill = { text: "You accepted", tone: "green" };
      else if (status === "expired") row.pill = { text: "Expired", tone: "grey" };
      else if (status === "declined") row.pill = { text: "Declined", tone: "grey" };
    }

    // photo rows
    if (row.action?.kind === "photo") {
      const name = row.actors[0]?.code ?? "A member";
      row.title = `${name} shared photos with you`;
      row.body =
        row.action.state === "available"
          ? "Tap to start your 60-second private viewing."
          : row.action.state === "viewing"
            ? "Your private viewing is open now."
            : "Your viewing session has closed.";
    }

    // family pause rows
    if (row.action?.kind === "pause") {
      const name = row.actors[0]?.code ?? "Your match";
      if (row.action.closed) {
        row.title = `${name} would like more time`;
        row.body = "She'll share her wali's details when she's ready.";
      } else if (row.action.ended) {
        row.title = "You can ask again now";
        row.body = `${name} asked for time to get to know you — you can send a new request.`;
      } else {
        row.title = "Not ready to involve family yet";
        const date = row.action.askAgainAt ? formatPauseDate(row.action.askAgainAt) : null;
        row.body = date ? `${name} would like more time. You can ask again from ${date}.` : `${name} would like more time.`;
      }
    }
  }

  const list = [...rows.values()].sort((a, b) => (a.latest < b.latest ? 1 : -1));
  const attention = list
    .filter((r) => r.needsAction)
    .sort((a, b) => deadlineOf(a) - deadlineOf(b));

  return {
    rows: list,
    attentionKeys: attention.map((r) => r.key),
    unreadRows: list.filter((r) => r.unread).length,
    nextCursor,
  };
}

/** Soonest deadline first for the attention section. Rows without a deadline sort last. */
function deadlineOf(r: GroupedRow): number {
  if (r.action?.kind === "request" && r.action.expiresAt) return new Date(r.action.expiresAt).getTime();
  if (r.action?.kind === "photo" && r.action.expiresAt) return new Date(r.action.expiresAt).getTime();
  return Number.MAX_SAFE_INTEGER;
}

function formatPauseDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

/**
 * Cheap count of unread *rows* (not events) for the bell / Activity tab badge — the handoff wants
 * these to match the grouped list. Mirrors the grouping keys without the actor/photo/family joins,
 * so it stays light enough to run on every summary poll.
 */
export async function getUnreadRowCount(userId: bigint): Promise<number> {
  await ensureNotificationsSchema();
  const since = new Date(Date.now() - NOTIFICATION_TTL_DAYS * DAY_MS);
  const now = new Date();
  const unread = (await withoutSameGenderViews(
    await prisma.notifications.findMany({
      where: { recipient_user_id: userId, read_at: null, created_at: { gte: since } },
      orderBy: { created_at: "desc" },
    }),
    userId
  )) as RawRow[];

  const keys = new Set<string>();
  for (const n of unread) {
    if (n.type === "message") continue;
    const section = bucketOf(n.created_at, now);
    if (n.type === "profile_view") keys.add(`views:${section}`);
    else if (n.type === "request_accepted") keys.add(`accepted:${section}`);
    else if (n.type === "request_refund" || n.type.startsWith("billing")) keys.add(`tokens:${dayKey(n.created_at)}`);
    else if (["match", "request", "request_reminder", "request_expired"].includes(n.type) && n.related_request_id)
      keys.add(`request:${n.related_request_id.toString()}`);
    else if (n.type === "photo" && n.actor_user_id) keys.add(`photos:${n.actor_user_id.toString()}`);
    else if (n.type === "wali" && /not ready to involve family/i.test(n.title) && n.related_request_id)
      keys.add(`pause:${n.related_request_id.toString()}`);
    else keys.add(`n:${n.id.toString()}`);
  }
  return keys.size;
}
