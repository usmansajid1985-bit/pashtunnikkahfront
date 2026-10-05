import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView, statusLabel } from "@/lib/profile";
import { getChatsOverview, getRecentActivity, getNavCounts, getProfileViews, type ActivityItem } from "@/lib/dashboard";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { PushNudge } from "@/components/notifications/push-nudge";
import { ProfileViewsCard } from "@/components/dashboard/profile-views-card";
import { GreetingMemo } from "@/components/dashboard/greeting-memo";
import { withOwnerPhotoUrls } from "@/lib/photos";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (mins < 1) return "just now";
  if (mins < 60) return unit(mins, "min");
  const hours = Math.round(mins / 60);
  if (hours < 24) return unit(hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 7) return unit(days, "day");
  if (days < 60) return unit(Math.round(days / 7), "week");
  return unit(Math.round(days / 30), "month");
}

const card = "bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)]";
const primaryBtn =
  "mt-4 block text-center py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700";
const quietBtn =
  "mt-4 block text-center py-2.5 rounded-xl border border-ink-900/12 text-rose-600 text-sm font-semibold hover:border-rose-300";

const ACTIVITY_ICONS: Record<ActivityItem["kind"], React.ReactNode> = {
  view: (
    <>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  message: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  request: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2M18 8v6M15 11h6" />
    </>
  ),
  photo: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <circle cx="9.5" cy="9.5" r="1.5" />
      <path d="m5 17 4.5-4.5 3.5 3.5 2.5-2.5L20 17" />
    </>
  ),
  wali: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M14.5 14.5c2.8-.4 5.5 1.2 5.5 4.5" />
    </>
  ),
  other: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
};

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white ${ok ? "bg-emerald-600" : "bg-amber-500"}`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {ok ? <path d="m5 12 5 5L20 7" /> : <path d="M12 6v7M12 17.5v.5" />}
      </svg>
    </span>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, profile, chats, navCounts, cookieStore] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    getChatsOverview(userId),
    getNavCounts(userId),
    cookies(),
  ]);
  if (!user || !profile) redirect("/signup");

  const view = await withOwnerPhotoUrls(mapProfileView(profile, user));
  const firstName = view.fullName.split(" ")[0] || "there";
  const isGold = view.plan === "gold";
  const [activity, profileViews] = await Promise.all([
    getRecentActivity(userId, isGold),
    getProfileViews(userId, isGold),
  ]);

  // Alternates on every visit: "Pakhair raghley" (welcome), then "Sanga ye" (how are you).
  const greeting = cookieStore.get("pn_greeting")?.value === "pakhair" ? "sanga" : "pakhair";
  const waiting = navCounts.incomingRequests;
  const live = view.status === "approved" && !profile.is_hidden;
  const complete = view.completeness >= 100;

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <BrowseAppNav profileCode={session.profileCode} active="overview" unreadCount={navCounts.unreadMessages} requestsCount={navCounts.incomingRequests} bellUnread={navCounts.bellUnread} />
      <GreetingMemo shown={greeting} />

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 pb-[var(--pn-bottom-nav-h)]">
        <header className="flex items-start justify-between gap-6">
          <div>
            <span aria-hidden className="block h-0.5 w-8 rounded bg-rose-600" />
            <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-ink-950">
              {greeting === "pakhair" ? "Pakhair raghley" : "Sanga ye"}, {firstName} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1.5 text-ink-700/65">Salamuna! May your day be filled with barakah.</p>
          </div>
          <p className="hidden lg:block pt-5 text-right text-[15px] leading-snug text-ink-700/70">
            “Good people,
            <br />
            brighter tomorrows.”
            <span aria-hidden className="mt-3 ml-auto block h-0.5 w-8 rounded bg-rose-600" />
          </p>
        </header>

        {/* Quick overview: conversations, waiting requests, browse */}
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <section className={`${card} p-5 bg-gradient-to-br from-rose-50/80 to-white`}>
            <p className="flex items-center gap-3 text-sm font-semibold text-ink-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  {ACTIVITY_ICONS.message}
                </svg>
              </span>
              Your conversations
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink-950 whitespace-nowrap">
                {chats.active === 0 ? "No active chats" : `${chats.active} active chat${chats.active === 1 ? "" : "s"}`}
              </h2>
              {chats.avatars.length ? (
                <div className="flex shrink-0 items-center -space-x-3">
                  {chats.avatars.map((url) => (
                    <span key={url} className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-rose-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full scale-125 object-cover blur-[3px]" />
                    </span>
                  ))}
                  {chats.active > chats.avatars.length ? (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white text-xs font-bold text-ink-900 shadow-sm">
                      +{chats.active - chats.avatars.length}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink-700/65">
              {chats.active === 0
                ? "Accepted requests open a chat here."
                : "Continue your conversations and get to know your matches."}
            </p>
            <Link href="/chats" className={chats.active === 0 ? quietBtn : primaryBtn}>
              {chats.active === 0 ? "Open messages" : "Continue chatting →"}
            </Link>
          </section>

          <section className={`${card} p-5`}>
            <p className="flex items-center gap-3 text-sm font-semibold text-ink-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900/5 text-ink-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  {ACTIVITY_ICONS.wali}
                </svg>
              </span>
              Message requests
            </p>
            <h2 className="mt-3 text-xl font-bold text-ink-950">
              {waiting === 0 ? "No requests waiting" : `${waiting} request${waiting === 1 ? "" : "s"} waiting`}
            </h2>
            <p className="mt-1 text-sm text-ink-700/65">
              {waiting === 0
                ? "When someone sends you a request, it will appear here."
                : "Someone is interested in getting to know you."}
            </p>
            <Link href="/requests" className={waiting === 0 ? quietBtn : primaryBtn}>
              View requests
            </Link>
          </section>

          <section className={`${card} p-5 bg-gradient-to-br from-rose-50/80 to-white`}>
            <p className="flex items-center gap-3 text-sm font-semibold text-ink-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
              </span>
              Find your match
            </p>
            <h2 className="mt-3 text-xl font-bold text-ink-950">Browse profiles</h2>
            <p className="mt-1 text-sm text-ink-700/65">Discover compatible Pashtun Muslims looking for marriage.</p>
            <Link href="/browse" className={primaryBtn}>
              Browse profiles →
            </Link>
          </section>
        </div>

        <div className="mt-4">
          <PushNudge />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className={`${card} p-5 min-w-0`}>
            <div className="flex items-center justify-between gap-3 border-b border-ink-900/6 pb-3">
              <h2 className="text-lg font-bold text-ink-950">Recent activity</h2>
              <Link href="/notifications" className="text-sm font-semibold text-rose-600 hover:text-rose-700">
                View all activity →
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-ink-700/55">Nothing yet — activity will show up here.</p>
            ) : (
              <div className="divide-y divide-ink-900/6">
                {activity.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url || "#"}
                    className="flex items-center gap-3 py-3.5 hover:bg-ink-900/[0.02] rounded-lg px-1 -mx-1 transition"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        {ACTIVITY_ICONS[item.kind]}
                      </svg>
                    </span>
                    {item.kind === "view" ? (
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-ink-900/20 to-ink-900/5">
                        {item.avatarUrl ? (
                          // Free members get an unrecognisable smear, blurred harder still here.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.avatarUrl}
                            alt=""
                            className={`h-full w-full object-cover ${item.avatarObscured ? "scale-150 blur-md" : "scale-125 blur-[3px]"}`}
                          />
                        ) : null}
                      </span>
                    ) : null}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium text-ink-950">{item.title}</span>
                      {item.body ? <span className="block text-sm text-ink-700/60">{item.body}</span> : null}
                    </span>
                    <span className="text-xs text-ink-700/45 shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="space-y-4">
            <section className={`${card} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2.5 font-bold text-ink-950">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-emerald-600" aria-hidden>
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
                  </svg>
                  Your profile
                </h2>
                <Link href="/profile" className="text-sm font-semibold text-rose-600 hover:text-rose-700">
                  View profile →
                </Link>
              </div>
              <p className="mt-2 text-xl font-bold text-ink-950 tabular-nums">{view.completeness}% complete</p>
              <div className="mt-2 h-1.5 rounded-full bg-ink-900/8 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400" style={{ width: `${view.completeness}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-900">
                <span className="flex items-center gap-2">
                  <Check ok={live} />
                  {live ? "Profile live and visible" : profile.is_hidden ? "Profile paused" : statusLabel(view.status)}
                </span>
                <span className="flex items-center gap-2">
                  <Check ok={Boolean(user.email_verified)} />
                  {user.email_verified ? "Email verified" : "Email not verified"}
                </span>
              </div>
              {/* The prompt to finish the profile disappears once it is 100% complete. */}
              {complete ? null : (
                <>
                  <p className="mt-3 text-sm text-ink-700/65">
                    Increase your chances of a successful match by completing your profile.
                  </p>
                  <Link href="/profile/edit" className={primaryBtn}>
                    Complete your profile
                  </Link>
                </>
              )}
            </section>

            <ProfileViewsCard data={profileViews} />

            <section className={`${card} p-5`}>
              <h2 className="font-bold text-ink-950">Need help?</h2>
              <p className="mt-1.5 text-sm text-ink-700/65">Read our guides or contact our support team for assistance.</p>
              <a href="mailto:info@pashtunnikah.com" className="mt-3 inline-block text-sm font-semibold text-rose-600 hover:text-rose-700">
                Contact support →
              </a>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
