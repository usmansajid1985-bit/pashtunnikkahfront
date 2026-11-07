"use client";

import Link from "next/link";
import { NAV_ITEMS, type NavKey } from "@/components/browse/nav-items";
import { NavCountBadge } from "@/components/browse/nav-notifications";

const BOTTOM_TABS: { key: NavKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "browse", label: "Browse" },
  { key: "requests", label: "Requests" },
  { key: "messages", label: "Chats" },
  { key: "profile", label: "Profile" },
  // Settings opens from the gear in My Profile's header on phones (desktop keeps it in the sidebar).
];

/**
 * Sticky mobile tab bar — the alternative to MobileNavMenu's slide-in panel. Fixed positioning
 * takes it out of flow, so it can be dropped anywhere in a page's JSX; content that needs to
 * clear it should add `pb-[var(--pn-bottom-nav-h)]`, which the "pn-has-bottom-nav" body class
 * (toggled by useMobileNavStyle) resolves to this bar's real height, and 0 otherwise.
 */
export function MobileBottomNav({
  active,
  unreadCount = 0,
  requestsCount = 0,
}: {
  active?: NavKey;
  unreadCount?: number;
  requestsCount?: number;
}) {
  return (
    // Floating, frosted sticky bar: translucent so the page shows faintly through it as you scroll.
    // pointer-events-none on the wrapper lets taps pass through the side gutters; the bar re-enables.
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pointer-events-none"
      aria-label="Primary"
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-[24px] border border-white/50 bg-white/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(17,17,24,0.14)]">
        <div className="grid grid-cols-5 h-[62px]">
          {BOTTOM_TABS.map(({ key, label }) => {
            const item = NAV_ITEMS.find((n) => n.key === key);
            if (!item) return null;
            // Settings pages sit under Profile on phones.
            const isActive = (active === "settings" ? "profile" : active) === key;
            return (
              <Link
                key={key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition ${
                  isActive ? "text-rose-600" : "text-ink-700/55"
                }`}
              >
                <span className="relative flex items-center justify-center w-9 h-9">
                  {isActive ? <span aria-hidden className="absolute inset-0 rounded-full bg-rose-500/12" /> : null}
                  <span className="relative">{item.icon}</span>
                  {key === "messages" ? (
                    <NavCountBadge
                      kind="messages"
                      initialCount={unreadCount}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[9px]"
                    />
                  ) : null}
                  {key === "requests" ? (
                    <NavCountBadge
                      kind="requests"
                      initialCount={requestsCount}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[9px]"
                    />
                  ) : null}
                </span>
                <span className="truncate max-w-[4rem]">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
