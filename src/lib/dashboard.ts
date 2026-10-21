import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { blockedUserIds } from "@/lib/blocking";
import { fetchPhotoBytes, signedPhotoUrl } from "@/lib/photos";

export type IntroductionStats = {
  active: number;
  accepted: number;
  pending: number;
  declined: number;
};

/** Active = currently live (pending + accepted); everything else is a settled outcome. */
export async function getIntroductionStats(userId: bigint): Promise<IntroductionStats> {
  const [pending, accepted, declined] = await Promise.all([
    prisma.match_requests.count({
      where: { status: "pending", OR: [{ sender_id: userId }, { receiver_id: userId }] },
    }),
    prisma.match_requests.count({
      where: { status: "accepted", OR: [{ sender_id: userId }, { receiver_id: userId }] },
    }),
    prisma.match_requests.count({
      where: { status: "declined", OR: [{ sender_id: userId }, { receiver_id: userId }] },
    }),
  ]);
  return { active: pending + accepted, accepted, pending, declined };
}

export type ActivityItem = {
  id: string;
  type: string;
  /** Drives the row icon. */
  kind: "view" | "message" | "request" | "photo" | "wali" | "other";
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  /** Profile-view rows only: a blurred picture of the viewer. Never a clear photo. */
  avatarUrl: string | null;
  /** Free members: the avatar is an unrecognisable smear, so blur it harder still in the UI. */
  avatarObscured: boolean;
};

const LEGACY_TITLES: Record<string, string> = {
  message: "New message",
  match: "Request update",
  wali: "Family handover",
  profile_activity: "Profile activity",
  system: "Account update",
};

function activityKind(type: string): ActivityItem["kind"] {
  if (type === "profile_view") return "view";
  if (type === "message") return "message";
  if (type === "photo") return "photo";
  if (type === "wali") return "wali";
  if (type === "match" || type.startsWith("request")) return "request";
  return "other";
}

/**
 * A 12px, heavily blurred thumbnail as a data URL. Used for free members' "viewed your profile"
 * rows: it gives a hint of a person but carries no recoverable detail, and — unlike a signed
 * storage URL — nothing in it points back to whose photo it was.
 */
const obscuredAvatar = unstable_cache(
  async (stored: string): Promise<string | null> => {
    try {
      const bytes = await fetchPhotoBytes(stored);
      if (!bytes) return null;
      const sharp = (await import("sharp")).default;
      const tiny = await sharp(bytes).resize(12, 12, { fit: "cover" }).blur(2).jpeg({ quality: 40 }).toBuffer();
      return `data:image/jpeg;base64,${tiny.toString("base64")}`;
    } catch {
      return null;
    }
  },
  ["overview-obscured-avatar"],
  { revalidate: 24 * 60 * 60 }
);

/**
 * Overview's Recent activity. Free members see THAT their profile was viewed, never by whom:
 * the viewer's code is stripped from the row and only an unrecognisable avatar is sent. Messages,
 * requests and everything else keep their real titles on every plan.
 */
export async function getRecentActivity(userId: bigint, isGold: boolean, limit = 5): Promise<ActivityItem[]> {
  const { withoutSameGenderViews } = await import("@/lib/gender");
  const rows = (
    await withoutSameGenderViews(
      await prisma.notifications.findMany({
        where: { recipient_user_id: userId },
        orderBy: { created_at: "desc" },
        take: limit * 3,
      }),
      userId
    )
  ).slice(0, limit);

  const viewerIds = [
    ...new Set(rows.filter((r) => r.type === "profile_view" && r.actor_user_id).map((r) => r.actor_user_id as bigint)),
  ];
  const viewers = viewerIds.length
    ? await prisma.profiles.findMany({
        where: { user_id: { in: viewerIds }, photo_status: "approved", photo_blur_url: { not: null } },
        select: { user_id: true, photo_blur_url: true },
      })
    : [];
  const avatars = new Map<string, string | null>();
  await Promise.all(
    viewers.map(async (v) => {
      const url = isGold ? await signedPhotoUrl(v.photo_blur_url) : await obscuredAvatar(v.photo_blur_url as string);
      avatars.set(v.user_id.toString(), url);
    })
  );

  return rows.map((r) => {
    const kind = activityKind(r.type);
    const masked = kind === "view" && !isGold;
    return {
      id: r.id.toString(),
      type: r.type,
      kind,
      // New notifications carry a real title ("PNF306 sent you a match request"); only fall back
      // to the generic label for the legacy "Pashtun Nikah" rows.
      title: masked
        ? "Viewed your profile"
        : !r.title || r.title === "Pashtun Nikah"
          ? LEGACY_TITLES[r.type] || "Update"
          : r.title,
      body: masked ? "" : r.body,
      url: masked ? "/settings/membership" : r.url,
      createdAt: r.created_at.toISOString(),
      avatarUrl: kind === "view" && r.actor_user_id ? (avatars.get(r.actor_user_id.toString()) ?? null) : null,
      avatarObscured: masked,
    };
  });
}

export type ChatsOverview = {
  /** Accepted matches that haven't been ended. */
  active: number;
  /** Blurred pictures of the most recent chat partners (may be fewer than `active`). */
  avatars: string[];
};

/** Overview's "Your conversations" card. */
export async function getChatsOverview(userId: bigint): Promise<ChatsOverview> {
  const where = { status: "accepted", ended_at: null, OR: [{ sender_id: userId }, { receiver_id: userId }] };
  const [active, recent] = await Promise.all([
    prisma.match_requests.count({ where }),
    prisma.match_requests.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 6,
      select: { sender_id: true, receiver_id: true },
    }),
  ]);
  const peerIds = recent.map((m) => (m.sender_id === userId ? m.receiver_id : m.sender_id));
  const peers = peerIds.length
    ? await prisma.profiles.findMany({
        where: { user_id: { in: peerIds }, photo_status: "approved", photo_blur_url: { not: null } },
        select: { user_id: true, photo_blur_url: true },
      })
    : [];
  const byId = new Map(peers.map((p) => [p.user_id.toString(), p.photo_blur_url]));
  const signed = await Promise.all(
    peerIds
      .map((id) => byId.get(id.toString()))
      .filter((u): u is string => Boolean(u))
      .slice(0, 2)
      .map((u) => signedPhotoUrl(u))
  );
  return { active, avatars: signed.filter((u): u is string => Boolean(u)) };
}

export async function getUnreadMessageCount(userId: bigint): Promise<number> {
  return prisma.messages.count({ where: { receiver_id: userId, is_read: false } });
}

export type NavCounts = {
  /** Bell dot — unread Activity + unread Updates. */
  bellUnread: number;
  /** Numbered badge on the Introductions/Requests nav item. */
  incomingRequests: number;
  /** Numbered badge on the Messages/Chats nav item. */
  unreadMessages: number;
};

export type ProfileViewItem = {
  id: string;
  peerUserId: string;
  code: string;
  place: string;
  viewedAt: string;
  avatarSeed: number;
  /**
   * Where the two members stand, so the card shows the right button: matched → Open chat,
   * a request either way → Request sent / Respond, an ended match → View profile, else Send request.
   */
  relation: { state: "none" | "accepted" | "sent" | "received" | "ended"; requestId: string | null };
};

export type ProfileViewsData = {
  isGold: boolean;
  /** Basic tier: identity is hidden, only aggregate counts are shown. */
  locked: boolean;
  summary: { total: number; last7d: number; last30d: number };
  viewers: ProfileViewItem[];
};

/** Overview's "Profile Views" section — moved here from the old Requests → Views tab. */
export async function getProfileViews(userId: bigint, isGold: boolean): Promise<ProfileViewsData> {
  const [viewRows, me] = await Promise.all([
    prisma.profile_views.findMany({
      where: { viewed_id: userId },
      orderBy: { viewed_at: "desc" },
      take: 120,
    }),
    prisma.profiles.findUnique({ where: { user_id: userId }, select: { gender: true } }),
  ]);

  // Only members of the opposite gender count as profile views — same-gender visitors are left
  // out of the list and the numbers entirely.
  const viewerIdsAll = [...new Set(viewRows.map((v) => v.viewer_id.toString()))].map((id) => BigInt(id));
  const profiles = viewerIdsAll.length
    ? await prisma.profiles.findMany({
        where: { user_id: { in: viewerIdsAll } },
        select: { id: true, user_id: true, profile_code: true, city: true, country: true, gender: true },
      })
    : [];
  const { sameGender } = await import("@/lib/gender");
  const byUserId = new Map(profiles.map((p) => [p.user_id.toString(), p]));
  const eligible = viewRows.filter((v) => {
    const p = byUserId.get(v.viewer_id.toString());
    return Boolean(p) && !sameGender(me?.gender, p!.gender);
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const summary = {
    total: eligible.length,
    last7d: eligible.filter((v) => now - v.viewed_at.getTime() <= 7 * day).length,
    last30d: eligible.filter((v) => now - v.viewed_at.getTime() <= 30 * day).length,
  };

  if (!isGold) {
    // Free: reveal that they were viewed and roughly when, never who — full identity is Gold-only.
    return { isGold: false, locked: true, summary, viewers: [] };
  }

  const blocked = new Set((await blockedUserIds(userId)).map((id) => id.toString()));
  // One row per viewer (their latest visit).
  const seen = new Set<string>();
  const visibleRows = eligible.filter((v) => {
    const id = v.viewer_id.toString();
    if (blocked.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Every request between me and these viewers, newest first — the live one decides the button.
  const viewerIds = visibleRows.map((v) => v.viewer_id);
  const requests = viewerIds.length
    ? await prisma.match_requests.findMany({
        where: {
          OR: [
            { sender_id: userId, receiver_id: { in: viewerIds } },
            { receiver_id: userId, sender_id: { in: viewerIds } },
          ],
        },
        select: { id: true, sender_id: true, receiver_id: true, status: true },
        orderBy: { id: "desc" },
      })
    : [];
  const relationOf = (peer: bigint): ProfileViewItem["relation"] => {
    const rows = requests.filter((r) => r.sender_id === peer || r.receiver_id === peer);
    const accepted = rows.find((r) => r.status === "accepted");
    if (accepted) return { state: "accepted", requestId: accepted.id.toString() };
    const pending = rows.find((r) => r.status === "pending");
    if (pending) return { state: pending.sender_id === userId ? "sent" : "received", requestId: pending.id.toString() };
    const ended = rows.find((r) => r.status === "ended");
    if (ended && rows[0] === ended) return { state: "ended", requestId: ended.id.toString() };
    return { state: "none", requestId: null };
  };

  const viewers: ProfileViewItem[] = visibleRows
    .map((v): ProfileViewItem | null => {
      const p = byUserId.get(v.viewer_id.toString());
      if (!p) return null;
      return {
        id: `view-${v.id}`,
        peerUserId: v.viewer_id.toString(),
        code: p.profile_code || "Member",
        place: [p.city, p.country].filter(Boolean).join(", "),
        viewedAt: v.viewed_at.toISOString(),
        avatarSeed: Number(p.id % BigInt(70)),
        relation: relationOf(v.viewer_id),
      };
    })
    .filter((v): v is ProfileViewItem => v !== null);

  return { isGold: true, locked: false, summary, viewers };
}

/** One call for every count the app nav needs (spec §2/§15 — bell and nav badges are separate). */
export async function getNavCounts(userId: bigint): Promise<NavCounts> {
  const { getBellCounts } = await import("@/lib/notifications");
  const [bell, incomingRequests, unreadMessages] = await Promise.all([
    getBellCounts(userId).catch(() => ({ bellUnread: 0 })),
    prisma.match_requests
      .count({ where: { receiver_id: userId, status: "pending" } })
      .catch(() => 0),
    getUnreadMessageCount(userId).catch(() => 0),
  ]);
  return { bellUnread: bell.bellUnread, incomingRequests, unreadMessages };
}
