import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { getNavCounts } from "@/lib/dashboard";
import { getActivityFeed } from "@/lib/notifications";
import { getAnnouncementCards } from "@/lib/announcements";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { StaleSessionGuard } from "@/components/settings/stale-session-guard";

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
  // "updates" is the old name of the Announcements tab — keep old links working.
  const initialTab = tab === "announcements" || tab === "updates" ? "announcements" : "activity";

  const [user, navCounts] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId }, select: { plan: true } }),
    getNavCounts(userId),
  ]);
  const isGold = (user?.plan ?? "").toLowerCase() === "gold";

  const [activity, announcements] = await Promise.all([
    getActivityFeed(userId, { isGold }),
    getAnnouncementCards(userId),
  ]);

  return (
    <div className="min-h-screen bg-[#faf8f7] lg:pl-60">
      <StaleSessionGuard userId={session.userId} />
      <BrowseAppNav
        profileCode={session.profileCode}
        active="overview"
        unreadCount={navCounts.unreadMessages}
        requestsCount={navCounts.incomingRequests}
        bellUnread={navCounts.bellUnread}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 lg:py-8 pb-[var(--pn-bottom-nav-h)]">
        <NotificationsView
          initialTab={initialTab}
          initialActivity={activity}
          initialAnnouncements={announcements}
        />
      </main>
    </div>
  );
}
