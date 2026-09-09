import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { getIntroductionStats, getRecentActivity, getNavCounts } from "@/lib/dashboard";
import { BrowseAppNav } from "@/components/browse/app-nav";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const ACTIVITY_ICON: Record<string, { bg: string; fg: string }> = {
  message: { bg: "bg-sky-100", fg: "text-sky-700" },
  match: { bg: "bg-emerald-100", fg: "text-emerald-700" },
  wali: { bg: "bg-amber-100", fg: "text-amber-700" },
  profile_activity: { bg: "bg-indigo-100", fg: "text-indigo-700" },
  system: { bg: "bg-ink-900/8", fg: "text-ink-700" },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, profile, stats, activity, navCounts] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    getIntroductionStats(userId),
    getRecentActivity(userId),
    getNavCounts(userId),
  ]);
  if (!user || !profile) redirect("/signup");

  const view = mapProfileView(profile, user);
  const firstName = view.fullName.split(" ")[0] || "there";

  const introStats: { key: keyof typeof stats; label: string; href: string }[] = [
    { key: "active", label: "Active", href: "/requests" },
    { key: "accepted", label: "Accepted", href: "/requests?tab=matches" },
    { key: "pending", label: "Pending", href: "/requests" },
    { key: "declined", label: "Declined", href: "/requests" },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <BrowseAppNav profileCode={session.profileCode} active="overview" unreadCount={navCounts.unreadMessages} requestsCount={navCounts.incomingRequests} bellUnread={navCounts.bellUnread} />

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink-950">
          Welcome back, {firstName} <span aria-hidden>👋</span>
        </h1>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Left column */}
          <div className="space-y-5 min-w-0">
            <section className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-ink-950">Your Introductions</h2>
                <Link href="/requests" className="text-sm font-semibold text-rose-600 hover:text-rose-700">
                  View all introductions →
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {introStats.map((s) => (
                  <div key={s.key} className="text-center">
                    <p className="text-xs text-ink-700/55">{s.label}</p>
                    <p className="mt-1 text-3xl font-bold text-ink-950 tabular-nums">{stats[s.key]}</p>
                    <Link href={s.href} className="mt-1 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                      View →
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
              <h2 className="font-bold text-ink-950">Recent Activity</h2>
              {activity.length === 0 ? (
                <p className="mt-3 text-sm text-ink-700/55">Nothing yet — activity will show up here.</p>
              ) : (
                <div className="mt-3 divide-y divide-ink-900/6">
                  {activity.map((item) => {
                    const tone = ACTIVITY_ICON[item.type] || ACTIVITY_ICON.system;
                    return (
                      <Link
                        key={item.id}
                        href={item.url || "#"}
                        className="flex items-start gap-3 py-3 hover:bg-ink-900/[0.02] rounded-lg px-1 -mx-1 transition"
                      >
                        <span className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tone.bg} ${tone.fg}`}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-ink-950">{item.title}</span>
                          <span className="block text-sm text-ink-700/65">{item.body}</span>
                        </span>
                        <span className="text-xs text-ink-700/45 shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <section className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
              <h2 className="font-bold text-ink-950">Complete Your Profile</h2>
              <p className="mt-1.5 text-sm text-ink-700/65">
                Increase your chances of a successful match by completing your profile.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-ink-900/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400"
                    style={{ width: `${view.completeness}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-ink-950 tabular-nums">{view.completeness}%</span>
              </div>
              <Link
                href="/profile/edit"
                className="mt-4 block text-center py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                Edit Profile
              </Link>
            </section>

            <section className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
              <h2 className="font-bold text-ink-950">Need Help?</h2>
              <p className="mt-1.5 text-sm text-ink-700/65">
                Read our guides or contact support for assistance.
              </p>
              <a
                href="mailto:info@pashtunnikah.com"
                className="mt-3 inline-block text-sm font-semibold text-rose-600 hover:text-rose-700"
              >
                Contact support →
              </a>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
