import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { MarkNotificationsRead } from "@/components/notifications/mark-notifications-read";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [rows, unreadCount] = await Promise.all([
    prisma.notifications.findMany({
      where: { recipient_user_id: userId },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    getUnreadMessageCount(userId),
  ]);

  return (
    <div className="min-h-screen bg-[#faf8f7] lg:pl-60">
      <BrowseAppNav profileCode={session.profileCode} active="settings" unreadCount={unreadCount} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-950">Notifications</h1>
            <p className="text-sm text-ink-700/60 mt-1">Recent activity from introductions and messages.</p>
          </div>
          <MarkNotificationsRead />
        </div>

        <div className="mt-6 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-700/55 card p-6 text-center">No notifications yet.</p>
          ) : (
            rows.map((n) => (
              <Link
                key={n.id.toString()}
                href={n.url || "#"}
                className={`block card p-4 hover:border-rose-200 transition ${n.read_at ? "opacity-75" : "border-rose-100"}`}
              >
                <p className="font-semibold text-ink-950">{n.title}</p>
                {n.body ? <p className="text-sm text-ink-700/70 mt-1">{n.body}</p> : null}
                <p className="text-[11px] text-ink-700/45 mt-2">{n.created_at.toLocaleString()}</p>
              </Link>
            ))
          )}
        </div>

        <Link href="/settings" className="mt-6 inline-block text-sm font-semibold text-rose-600">
          ← Back to settings
        </Link>
      </main>
    </div>
  );
}
