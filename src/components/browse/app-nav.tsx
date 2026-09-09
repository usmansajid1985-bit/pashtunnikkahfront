import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavMenu } from "@/components/browse/mobile-nav-menu";
import { NAV_ITEMS, type NavKey } from "@/components/browse/nav-items";
import { NavBell, NavCountBadge } from "@/components/browse/nav-notifications";

type Props = {
  profileCode?: string | null;
  active?: NavKey;
  /** Unread chat messages — Messages/Chats nav badge. */
  unreadCount?: number;
  /** Pending incoming match requests — Introductions/Requests nav badge. */
  requestsCount?: number;
  /** Unread Activity + Updates — bell dot. */
  bellUnread?: number;
};

/**
 * Purely presentational — no data fetching here. This component is imported by client
 * components (chat-app.tsx, profile-edit-form.tsx) as well as server ones; giving it any
 * server-only dependency (getSession, prisma) breaks the client bundle. Unread count must be
 * computed by the caller and passed in as a plain prop.
 */
export function BrowseAppNav({
  active = "browse",
  unreadCount = 0,
  requestsCount = 0,
  bellUnread = 0,
}: Props) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-60 lg:flex-col lg:border-r lg:border-ink-900/8 lg:bg-white px-4 py-6">
        <div className="flex items-center justify-between gap-2 px-1">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpeg" alt="Pashtun Nikah" width={30} height={30} className="rounded-lg" priority />
            <span className="text-base font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>
          <NavBell initialUnread={bellUnread} />
        </div>

        <nav className="mt-7 flex-1 flex flex-col gap-1 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                  isActive ? "bg-rose-50 text-rose-600" : "text-ink-700 hover:bg-ink-900/5"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.key === "messages" ? (
                  <NavCountBadge kind="messages" initialCount={unreadCount} />
                ) : null}
                {item.key === "introductions" ? (
                  <NavCountBadge kind="requests" initialCount={requestsCount} />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-ink-900/6">
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-ink-900/8">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.jpeg" alt="Pashtun Nikah" width={26} height={26} className="rounded-lg" priority />
            <span className="font-semibold text-ink-950">Pashtun Nikah</span>
          </Link>
          <div className="flex items-center gap-1">
            <NavBell initialUnread={bellUnread} />
            <MobileNavMenu items={NAV_ITEMS} active={active} unread={unreadCount} requests={requestsCount} />
          </div>
        </div>
      </header>
    </>
  );
}
