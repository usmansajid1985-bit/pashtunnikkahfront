import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { getNavCounts } from "@/lib/dashboard";
import { getGroupedActivity } from "@/lib/notification-groups";
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
    getGroupedActivity(userId, { isGold }),
    getAnnouncementCards(userId),
  ]);

  return (
    <div className="min-h-screen lg:pl-60" style={{ background: "#FAF7F5" }}>
      <StaleSessionGuard userId={session.userId} />
      <BrowseAppNav
        profileCode={session.profileCode}
        active={null}
        bellActive
        unreadCount={navCounts.unreadMessages}
        requestsCount={navCounts.incomingRequests}
        bellUnread={navCounts.bellUnread}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:py-8 pb-[var(--pn-bottom-nav-h)]">
        <NotificationsView
          initialTab={initialTab}
          initialActivity={activity}
          initialAnnouncements={announcements}
        />
      </main>
    </div>
  );
}
