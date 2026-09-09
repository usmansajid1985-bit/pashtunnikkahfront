"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type NavCounts = {
  bellUnread: number;
  incomingRequests: number;
  unreadMessages: number;
};

const EVENT = "pn:nav-counts";
let polling = false;

/**
 * Single poller shared by the bell and the nav badges. Fetches the summary endpoint on an
 * interval and on tab focus, and broadcasts the result so every badge island updates together
 * (spec §2: badges update in real time; polling is the pragmatic version of that).
 */
function startPolling() {
  if (polling || typeof window === "undefined") return;
  polling = true;

  const tick = async () => {
    try {
      const res = await fetch("/api/notifications/summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NavCounts;
      window.dispatchEvent(new CustomEvent<NavCounts>(EVENT, { detail: data }));
    } catch {
      /* offline — keep last known counts */
    }
  };

  void tick();
  const id = window.setInterval(tick, 45_000);
  window.addEventListener("focus", tick);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void tick();
  });
  window.addEventListener("beforeunload", () => window.clearInterval(id));
}

function useNavCounts(initial: Partial<NavCounts>): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({
    bellUnread: initial.bellUnread ?? 0,
    incomingRequests: initial.incomingRequests ?? 0,
    unreadMessages: initial.unreadMessages ?? 0,
  });
  useEffect(() => {
    startPolling();
    const onEvt = (e: Event) => setCounts((e as CustomEvent<NavCounts>).detail);
    window.addEventListener(EVENT, onEvt);
    return () => window.removeEventListener(EVENT, onEvt);
  }, []);
  return counts;
}

export function NavBell({
  initialUnread = 0,
  className = "",
}: {
  initialUnread?: number;
  className?: string;
}) {
  const { bellUnread } = useNavCounts({ bellUnread: initialUnread });
  return (
    <Link
      href="/notifications"
      aria-label={bellUnread > 0 ? `Notifications (${bellUnread} unread)` : "Notifications"}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-700 hover:bg-ink-900/5 ${className}`}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {bellUnread > 0 ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />
      ) : null}
    </Link>
  );
}

/** Numbered badge for a nav item that stays in sync with the shared poll. */
export function NavCountBadge({
  kind,
  initialCount = 0,
}: {
  kind: "requests" | "messages";
  initialCount?: number;
}) {
  const counts = useNavCounts(
    kind === "requests"
      ? { incomingRequests: initialCount }
      : { unreadMessages: initialCount }
  );
  const n = kind === "requests" ? counts.incomingRequests : counts.unreadMessages;
  if (n <= 0) return null;
  return (
    <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
      {n > 99 ? "99+" : n}
    </span>
  );
}
