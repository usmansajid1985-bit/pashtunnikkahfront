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
let tickNow: (() => Promise<void>) | null = null;
/** Last counts seen by the shared poller — the base for optimistic nudges. */
let lastCounts: NavCounts = { bellUnread: 0, incomingRequests: 0, unreadMessages: 0 };

/** Re-fetch badge counts immediately — called by LiveUpdates on realtime events (Q02/N07). */
export function refreshNavCounts() {
  if (tickNow) void tickNow();
}

/**
 * Optimistically nudge the shared badge counts and broadcast right away, so the bell drops the
 * instant a notification is opened instead of waiting for the next poll (V2 badge-sync). Clamp at
 * zero. Callers should still reconcile with the server (refreshNavCounts) once the read is saved.
 */
export function bumpNavCounts(delta: Partial<NavCounts>) {
  if (typeof window === "undefined") return;
  lastCounts = {
    bellUnread: Math.max(0, lastCounts.bellUnread + (delta.bellUnread ?? 0)),
    incomingRequests: Math.max(0, lastCounts.incomingRequests + (delta.incomingRequests ?? 0)),
    unreadMessages: Math.max(0, lastCounts.unreadMessages + (delta.unreadMessages ?? 0)),
  };
  window.dispatchEvent(new CustomEvent<NavCounts>(EVENT, { detail: lastCounts }));
}

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
      lastCounts = data;
      window.dispatchEvent(new CustomEvent<NavCounts>(EVENT, { detail: data }));
    } catch {
      /* offline — keep last known counts */
    }
  };

  tickNow = tick;
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
    // Seed the shared base from this island's server-provided initial before the first poll lands,
    // so an optimistic bump (e.g. opening a notification) starts from the right number.
    if (initial.bellUnread != null && lastCounts.bellUnread === 0) lastCounts.bellUnread = initial.bellUnread;
    if (initial.incomingRequests != null && lastCounts.incomingRequests === 0) lastCounts.incomingRequests = initial.incomingRequests;
    if (initial.unreadMessages != null && lastCounts.unreadMessages === 0) lastCounts.unreadMessages = initial.unreadMessages;
    startPolling();
    const onEvt = (e: Event) => {
      lastCounts = (e as CustomEvent<NavCounts>).detail;
      setCounts(lastCounts);
    };
    window.addEventListener(EVENT, onEvt);
    return () => window.removeEventListener(EVENT, onEvt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10.5px] font-bold leading-none flex items-center justify-center ring-2 ring-white tabular-nums">
          {bellUnread > 99 ? "99+" : bellUnread}
        </span>
      ) : null}
    </Link>
  );
}

/** Numbered badge for a nav item that stays in sync with the shared poll. */
export function NavCountBadge({
  kind,
  initialCount = 0,
  className = "",
}: {
  kind: "requests" | "messages";
  initialCount?: number;
  className?: string;
}) {
  const counts = useNavCounts(
    kind === "requests"
      ? { incomingRequests: initialCount }
      : { unreadMessages: initialCount }
  );
  const n = kind === "requests" ? counts.incomingRequests : counts.unreadMessages;
  if (n <= 0) return null;
  return (
    <span
      className={`min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center ${className}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Red dot on the closed ☰ menu icon while there are unread messages or requests (Q02). */
export function NavUnreadDot({
  initialUnread = 0,
  initialRequests = 0,
  className = "",
}: {
  initialUnread?: number;
  initialRequests?: number;
  className?: string;
}) {
  const counts = useNavCounts({ unreadMessages: initialUnread, incomingRequests: initialRequests });
  if (counts.unreadMessages <= 0 && counts.incomingRequests <= 0) return null;
  return <span className={className} />;
}
