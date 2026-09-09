import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { getNavCounts } from "@/lib/dashboard";
import { getActivityFeed, getUpdatesFeed } from "@/lib/notifications";
import { NotificationsView } from "@/components/notifications/notifications-view";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const { tab } = await searchParams;
  const initialTab = tab === "updates" ? "updates" : "activity";

  const [user, navCounts] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId }, select: { plan: true } }),
    getNavCounts(userId),
  ]);
  const isGold = (user?.plan ?? "").toLowerCase() === "gold";

  const [activity, updates] = await Promise.all([
    getActivityFeed(userId, { isGold }),
    getUpdatesFeed(userId),
  ]);

  return (
    <div className="min-h-screen bg-[#faf8f7] lg:pl-60">
      <BrowseAppNav
        profileCode={session.profileCode}
        active="overview"
        unreadCount={navCounts.unreadMessages}
        requestsCount={navCounts.incomingRequests}
        bellUnread={navCounts.bellUnread}
      />
      <main className="max-w-2xl mx-auto px-4 py-6 lg:py-8">
        <NotificationsView
          initialTab={initialTab}
          initialActivity={activity}
          initialUpdates={updates}
        />
      </main>
    </div>
  );
}
