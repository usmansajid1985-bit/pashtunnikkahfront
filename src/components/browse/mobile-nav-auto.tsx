"use client";

import { MobileNavMenu } from "@/components/browse/mobile-nav-menu";
import { MobileBottomNav } from "@/components/browse/mobile-bottom-nav";
import { useMobileNavStyle } from "@/lib/mobile-nav-preference";
import type { NavItem, NavKey } from "@/components/browse/nav-items";

/** Renders whichever mobile nav chrome the user picked in Settings (defaults to the bottom bar). */
export function MobileNavAuto({
  items,
  active,
  unread,
  requests = 0,
}: {
  items: NavItem[];
  active: NavKey;
  unread: number;
  requests?: number;
}) {
  const [style] = useMobileNavStyle();

  if (style === "menu") {
    return <MobileNavMenu items={items} active={active} unread={unread} requests={requests} />;
  }

  return <MobileBottomNav active={active} unreadCount={unread} requestsCount={requests} />;
}
