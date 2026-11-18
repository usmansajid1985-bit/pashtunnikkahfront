"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";

/** useLayoutEffect in the browser (runs before paint), useEffect on the server (no warning). */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type NavCounts = {
  bellUnread: number;
  incomingRequests: number;
  unreadMessages: number;
};

const EVENT = "pn:nav-counts";
/** Per-tab cache of the last confirmed counts, so a full page load starts from real numbers
 * instead of flashing 0 → N while the first poll is in flight. Cleared on logout / account switch. */
const CACHE_KEY = "pn_nav_counts";
let polling = false;
let tickNow: (() => Promise<void>) | null = null;
/** Last counts seen by the shared poller — the base for optimistic nudges, and the value every nav
 * badge island re-mounts to so it never flashes back to zero on a client-side page navigation. */
let lastCounts: NavCounts = { bellUnread: 0, incomingRequests: 0, unreadMessages: 0 };
/** True once a real count (server poll, cache or a page's initial props) has been applied, so later
 * mounts seed from `lastCounts` rather than briefly showing a default/zero. */
let seeded = false;
let cacheOwner: string | null = null;

function readCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { owner?: string | null; counts?: NavCounts };
    if (parsed.counts) {
      lastCounts = { ...lastCounts, ...parsed.counts };
      cacheOwner = parsed.owner ?? null;
      seeded = true;
    }
  } catch {
    /* storage blocked — just start from server props */
  }
}
readCache();

function writeCache() {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ owner: cacheOwner, counts: lastCounts }));
  } catch {
    /* ignore */
  }
}

function broadcast() {
  writeCache();
  window.dispatchEvent(new CustomEvent<NavCounts>(EVENT, { detail: lastCounts }));
}

/** Forget cached badge counts — call on logout so the next account never sees the previous one's. */
export function clearNavCountsCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
  lastCounts = { bellUnread: 0, incomingRequests: 0, unreadMessages: 0 };
  seeded = false;
  cacheOwner = null;
}

/** Tie the cache to the signed-in account; a different account wipes it and re-fetches at once. */
export function setNavCountsOwner(userId: string | null) {
  if (typeof window === "undefined") return;
  if (cacheOwner && userId !== cacheOwner) {
    clearNavCountsCache();
    cacheOwner = userId;
    broadcast();
    refreshNavCounts();
    return;
  }
  cacheOwner = userId;
  writeCache();
}

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
  broadcast();
}

/**
 * Single poller shared by the bell and the nav badges. Fetches the summary endpoint on an
 * interval and on tab focus, and broadcasts the result so every badge island updates together
 * (spec §2: badges update in real time; polling is the pragmatic version of that).
 */
function startPolling() {
  if (polling || typeof window === "undefined") return;
  polling = true;

  // Throttle: focus + visibilitychange + mount can all fire within a second of each other and each
  // triggered its own fetch, so a short visit hit /summary ~12×. Collapse bursts to one request.
  let lastFetch = 0;
  const tick = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch < 5000) return;
    lastFetch = now;
    try {
      const res = await fetch("/api/notifications/summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NavCounts;
      lastCounts = data;
      seeded = true;
      broadcast();
    } catch {
      /* offline — keep last known counts */
    }
  };

  tickNow = () => tick(true); // realtime events bypass the throttle
  void tick(true);
  const id = window.setInterval(() => tick(true), 45_000);
  window.addEventListener("focus", () => tick());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void tick();
  });
  window.addEventListener("beforeunload", () => window.clearInterval(id));
}

function useNavCounts(initial: Partial<NavCounts>): NavCounts {
  // First render must match the server HTML (which can't see the per-tab cache), so start from the
  // page's props; the layout effect below swaps in the cached/shared counts *before paint*, so the
  // badge never visibly flashes. `undefined` in `initial` = "this page didn't compute it" (never 0).
  const [counts, setCounts] = useState<NavCounts>(() => ({
    bellUnread: initial.bellUnread ?? 0,
    incomingRequests: initial.incomingRequests ?? 0,
    unreadMessages: initial.unreadMessages ?? 0,
  }));
  useIsoLayoutEffect(() => {
    // Fold this page's server-provided counts into the shared base (so optimistic bumps start from
    // the right number and other islands match), then let the poll/realtime keep it fresh.
    let changed = false;
    if (initial.bellUnread != null && initial.bellUnread !== lastCounts.bellUnread) {
      lastCounts = { ...lastCounts, bellUnread: initial.bellUnread };
      changed = true;
    }
    if (initial.incomingRequests != null && initial.incomingRequests !== lastCounts.incomingRequests) {
      lastCounts = { ...lastCounts, incomingRequests: initial.incomingRequests };
      changed = true;
    }
    if (initial.unreadMessages != null && initial.unreadMessages !== lastCounts.unreadMessages) {
      lastCounts = { ...lastCounts, unreadMessages: initial.unreadMessages };
      changed = true;
    }
    if (changed || !seeded) {
      seeded = true;
      broadcast();
    }
    setCounts({ ...lastCounts });
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
  initialUnread,
  active = false,
  className = "",
}: {
  initialUnread?: number;
  active?: boolean;
  className?: string;
}) {
  const { bellUnread } = useNavCounts({ bellUnread: initialUnread });
  return (
    <Link
      href="/notifications"
      aria-label={bellUnread > 0 ? `Notifications (${bellUnread} unread)` : "Notifications"}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full ${
        active ? "bg-rose-50 text-rose-600" : "text-ink-700 hover:bg-ink-900/5"
      } ${className}`}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {bellUnread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e12d72] text-white text-[10.5px] font-bold leading-none flex items-center justify-center ring-2 ring-white tabular-nums">
          {bellUnread > 99 ? "99+" : bellUnread}
        </span>
      ) : null}
    </Link>
  );
}

/** Numbered badge for a nav item that stays in sync with the shared poll. */
export function NavCountBadge({
  kind,
  initialCount,
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
      className={`min-w-5 h-5 px-1.5 rounded-full bg-[#e12d72] text-white text-[11px] font-bold flex items-center justify-center ${className}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Red dot on the closed ☰ menu icon while there are unread messages or requests (Q02). */
export function NavUnreadDot({
  initialUnread,
  initialRequests,
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
