import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocking";

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
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
};

const LEGACY_TITLES: Record<string, string> = {
  message: "New message",
  match: "Request update",
  wali: "Family handover",
  profile_activity: "Profile activity",
  system: "Account update",
};

export async function getRecentActivity(userId: bigint, limit = 6): Promise<ActivityItem[]> {
  const rows = await prisma.notifications.findMany({
    where: { recipient_user_id: userId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id.toString(),
    type: r.type,
    // New notifications carry a real title ("PNF306 sent you a match request"); only fall back
    // to the generic label for the legacy "Pashtun Nikah" rows.
    title: !r.title || r.title === "Pashtun Nikah" ? LEGACY_TITLES[r.type] || "Update" : r.title,
    body: r.body,
    url: r.url,
    createdAt: r.created_at.toISOString(),
  }));
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
};

export type ProfileViewsData = {
  isGold: boolean;
  /** Basic tier: identity is hidden, only aggregate counts are shown. */
  locked: boolean;
  summary: { total: number; last7d: number; last30d: number } | null;
  viewers: ProfileViewItem[];
};

/** Overview's "Profile Views" section — moved here from the old Requests → Views tab. */
export async function getProfileViews(userId: bigint, isGold: boolean): Promise<ProfileViewsData> {
  const viewRows = await prisma.profile_views.findMany({
    where: { viewed_id: userId },
    orderBy: { viewed_at: "desc" },
    take: 60,
  });

  if (!isGold) {
    // Free: reveal that they were viewed and roughly when, never who — full identity is Gold-only.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return {
      isGold: false,
      locked: true,
      summary: {
        total: viewRows.length,
        last7d: viewRows.filter((v) => now - v.viewed_at.getTime() <= 7 * day).length,
        last30d: viewRows.filter((v) => now - v.viewed_at.getTime() <= 30 * day).length,
      },
      viewers: [],
    };
  }

  const blocked = new Set((await blockedUserIds(userId)).map((id) => id.toString()));
  const visibleRows = viewRows.filter((v) => !blocked.has(v.viewer_id.toString()));
  const viewerIds = visibleRows.map((v) => v.viewer_id);
  const profiles = viewerIds.length
    ? await prisma.profiles.findMany({
        where: { user_id: { in: viewerIds } },
        select: { id: true, user_id: true, profile_code: true, city: true, country: true },
      })
    : [];
  const byUserId = new Map(profiles.map((p) => [p.user_id.toString(), p]));

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
      };
    })
    .filter((v): v is ProfileViewItem => v !== null);

  return { isGold: true, locked: false, summary: null, viewers };
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
