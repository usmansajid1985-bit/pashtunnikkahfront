import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNavCounts } from "@/lib/dashboard";
import { loadSmartMatches } from "@/lib/smart-matches";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { SmartMatchCard } from "@/components/smart-matches/smart-match-card";

export const dynamic = "force-dynamic";

export default async function SmartMatchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const viewerId = BigInt(session.userId);
  const [data, navCounts] = await Promise.all([
    loadSmartMatches(viewerId),
    getNavCounts(viewerId),
  ]);

  if (!data) redirect("/signup");

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <BrowseAppNav profileCode={session.profileCode} active="smartMatches" unreadCount={navCounts.unreadMessages} requestsCount={navCounts.incomingRequests} bellUnread={navCounts.bellUnread} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Gold intelligence</p>
        <h1 className="mt-1 text-[28px] lg:text-[34px] font-bold text-ink-950 tracking-tight">
          Smart Matches
        </h1>
        <p className="mt-1.5 text-sm text-ink-700/65 max-w-xl">
          Your best compatibility picks from the member pool — ranked by AI analysis and cached after the
          first look.
        </p>

        {!data.isGold ? (
          <div className="mt-8 card p-8 text-center max-w-lg">
            <p className="text-lg font-bold text-ink-950">Unlock Smart Matches with Gold</p>
            <p className="mt-2 text-sm text-ink-700/70 leading-relaxed">
              Gold members get a dedicated hub of top-ranked candidates with AI compatibility scores and
              short explanations of why you match.
            </p>
            <Link
              href="/settings/membership"
              className="mt-6 inline-flex px-6 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
            >
              Upgrade to Gold
            </Link>
          </div>
        ) : data.items.length === 0 ? (
          <div className="mt-8 card p-8 text-center">
            <p className="font-semibold text-ink-950">No candidates yet</p>
            <p className="mt-2 text-sm text-ink-700/65">
              Check back soon — new profiles are added as members join and get approved.
            </p>
            <Link href="/browse" className="mt-4 inline-block text-sm font-semibold text-rose-600 hover:underline">
              Browse all profiles
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-ink-700/60">
              Showing top {data.items.length} matches · scores improve as AI explanations cache
            </p>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.items.map((item) => (
                <SmartMatchCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
