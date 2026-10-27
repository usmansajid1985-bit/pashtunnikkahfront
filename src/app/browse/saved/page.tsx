import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocking";
import { getNavCounts } from "@/lib/dashboard";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { SavedGrid } from "@/components/browse/saved-grid";
import { BROWSE_PROFILE_SELECT, rankBrowseProfiles } from "@/lib/browse-rank";

export const dynamic = "force-dynamic";

/** Browse → My saves: every profile the member bookmarked, newest save first. */
export default async function SavedProfilesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = BigInt(session.userId);

  const [favourites, blocked, navCounts] = await Promise.all([
    prisma.favourites.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: { profile_user_id: true },
    }),
    blockedUserIds(userId),
    getNavCounts(userId),
  ]);
  const ids = favourites.map((f) => f.profile_user_id).filter((id) => !blocked.includes(id));
  const rows = await prisma.profiles.findMany({
    where: { user_id: { in: ids }, status: "approved", is_hidden: false },
    select: BROWSE_PROFILE_SELECT,
  });
  const cards = await rankBrowseProfiles(userId, rows);
  // Keep the order the member saved them in (newest first), not the Browse ranking.
  const order = new Map(ids.map((id, i) => [id.toString(), i]));
  cards.sort((a, b) => (order.get(a.userId) ?? 0) - (order.get(b.userId) ?? 0));

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <BrowseAppNav
        profileCode={session.profileCode}
        active="browse"
        unreadCount={navCounts.unreadMessages}
        requestsCount={navCounts.incomingRequests}
        bellUnread={navCounts.bellUnread}
      />
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 pb-[var(--pn-bottom-nav-h)]">
        <a href="/browse" className="inline-flex items-center gap-2 text-sm font-medium text-ink-700/70 hover:text-ink-950">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to browse
        </a>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink-950">My saves</h1>
          <span className="min-w-[1.75rem] h-7 px-2 rounded-full bg-rose-50 text-rose-600 text-sm font-semibold flex items-center justify-center tabular-nums">
            {cards.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-700/70">Profiles you&apos;ve bookmarked. Tap the bookmark again to remove one.</p>
        <SavedGrid initialItems={cards} />
      </main>
    </div>
  );
}
