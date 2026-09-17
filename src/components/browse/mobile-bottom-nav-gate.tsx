"use client";

import { MobileBottomNav } from "@/components/browse/mobile-bottom-nav";
import { useMobileNavStyle } from "@/lib/mobile-nav-preference";
import type { NavKey } from "@/components/browse/nav-items";

/**
 * For pages that build their own mobile header (Requests, Chats, Settings, …) instead of using
 * BrowseAppNav's — those never had a hamburger menu, so this only ever adds the bottom bar and
 * renders nothing when the user prefers the menu-panel style.
 */
export function MobileBottomNavGate({
  active,
  unreadCount = 0,
  requestsCount = 0,
}: {
  active?: NavKey;
  unreadCount?: number;
  requestsCount?: number;
}) {
  const [style] = useMobileNavStyle();
  if (style !== "bottomBar") return null;
  return <MobileBottomNav active={active} unreadCount={unreadCount} requestsCount={requestsCount} />;
}
