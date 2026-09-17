"use client";

import Link from "next/link";
import { NAV_ITEMS, type NavKey } from "@/components/browse/nav-items";
import { NavCountBadge } from "@/components/browse/nav-notifications";

const BOTTOM_TABS: { key: NavKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "browse", label: "Browse" },
  { key: "introductions", label: "Requests" },
  { key: "messages", label: "Chats" },
  { key: "profile", label: "Profile" },
  { key: "settings", label: "Settings" },
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
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ink-900/8"
      aria-label="Primary"
    >
      <div className="grid grid-cols-6 h-14">
        {BOTTOM_TABS.map(({ key, label }) => {
          const item = NAV_ITEMS.find((n) => n.key === key);
          if (!item) return null;
          const isActive = active === key;
          return (
            <Link
              key={key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                isActive ? "text-rose-600" : "text-ink-700/55"
              }`}
            >
              <span className="relative">
                {item.icon}
                {key === "messages" ? (
                  <NavCountBadge
                    kind="messages"
                    initialCount={unreadCount}
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 text-[9px]"
                  />
                ) : null}
                {key === "introductions" ? (
                  <NavCountBadge
                    kind="requests"
                    initialCount={requestsCount}
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 text-[9px]"
                  />
                ) : null}
              </span>
              <span className="truncate max-w-[3.5rem]">{label}</span>
            </Link>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
