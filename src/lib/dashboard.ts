import { prisma } from "@/lib/prisma";

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

const ACTIVITY_TITLES: Record<string, string> = {
  message: "New message",
  match: "Introduction update",
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
    title: ACTIVITY_TITLES[r.type] || "Update",
    body: r.body,
    url: r.url,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getUnreadMessageCount(userId: bigint): Promise<number> {
  return prisma.messages.count({ where: { receiver_id: userId, is_read: false } });
}
