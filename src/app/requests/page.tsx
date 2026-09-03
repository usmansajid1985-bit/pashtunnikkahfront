import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadRequestsHub } from "@/lib/requests-hub";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { RequestsHub } from "@/components/requests/requests-hub";

export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { tab } = await searchParams;
  const userId = BigInt(session.userId);
  const [hub, unreadCount] = await Promise.all([
    loadRequestsHub(userId),
    getUnreadMessageCount(userId),
  ]);

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <div className="hidden lg:block">
        <BrowseAppNav profileCode={session.profileCode} active="introductions" unreadCount={unreadCount} />
      </div>

      <header className="lg:hidden sticky top-0 z-20 bg-[#faf8f7] border-b border-ink-900/6">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/browse" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="font-bold text-[17px]">Requests</h1>
          <Link href="/chats" className="text-sm font-semibold text-rose-600">
            Chats
          </Link>
        </div>
      </header>

      <main className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-8 py-6">
        <div className="hidden lg:block mb-6">
          <h1 className="text-3xl font-bold text-ink-950">Requests</h1>
          <p className="mt-1 text-sm text-ink-700/65">
            Incoming, sent, matches, views, saved, and blocked — your connection hub.
          </p>
        </div>

        <RequestsHub data={hub} initialTab={tab} />
      </main>
    </div>
  );
}
