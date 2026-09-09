"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileCard, type ProfileCardData } from "@/components/browse/profile-card";
import { filtersToQuery, type BrowseFilters } from "@/lib/browse-filters-shared";

type Props = {
  initialItems: ProfileCardData[];
  initialHasMore: boolean;
  filters: BrowseFilters;
  initialSavedUserIds?: string[];
};

export function BrowseInfiniteGrid({
  initialItems,
  initialHasMore,
  filters,
  initialSavedUserIds = [],
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState(() => new Set(initialSavedUserIds));
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(1);
  const itemCountRef = useRef(initialItems.length);

  // Key that identifies "this exact filtered browse" for save/restore.
  const filtersKey = filtersToQuery({ ...filters, page: 1 });
  const RESTORE_KEY = "pn_browse_restore";

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function toggleSave(userId: string) {
    if (savingIds.has(userId)) return;
    setSavingIds((prev) => new Set(prev).add(userId));
    const isSaved = savedIds.has(userId);
    try {
      const res = await fetch("/api/favourites", {
        method: isSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not update saved profiles.");
        return;
      }
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(userId);
        else next.add(userId);
        return next;
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  // Reset when filters change (server re-renders with new initial props)
  useEffect(() => {
    setItems(initialItems);
    setPage(1);
    pageRef.current = 1;
    itemCountRef.current = initialItems.length;
    setHasMore(initialHasMore);
    setLoading(false);
    loadingRef.current = false;
  }, [initialItems, initialHasMore, filters]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    itemCountRef.current = items.length;
  }, [items.length]);

  // Save enough to rebuild this view (filters + how many cards + scroll) when the user opens a
  // profile, so "Back to browse" and the browser Back restore the deep position (PN-BROWSE-007).
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(
          RESTORE_KEY,
          JSON.stringify({
            key: filtersKey,
            count: itemCountRef.current,
            page: pageRef.current,
            scrollY: window.scrollY,
            ts: Date.now(),
          })
        );
      } catch {
        /* private mode / disabled storage */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [filtersKey]);

  // On mount, if we're returning to the same filtered browse, re-load the pages we had and
  // restore the scroll position.
  useEffect(() => {
    let cancelled = false;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(RESTORE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;
    let snap: { key: string; count: number; page: number; scrollY: number; ts: number };
    try {
      snap = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      snap.key !== filtersKey ||
      snap.page <= 1 ||
      Date.now() - snap.ts > 30 * 60_000
    ) {
      return;
    }

    (async () => {
      let acc = [...initialItems];
      let more = initialHasMore;
      for (let p = 2; p <= snap.page && acc.length < snap.count && more && !cancelled; p++) {
        const res = await fetch(`/api/browse${filtersToQuery({ ...filters, page: p })}`);
        if (!res.ok) break;
        const data = await res.json();
        const seen = new Set(acc.map((it) => it.id));
        acc = [...acc, ...data.items.filter((it: ProfileCardData) => !seen.has(it.id))];
        more = Boolean(data.hasMore);
      }
      if (cancelled) return;
      setItems(acc);
      setPage(snap.page);
      pageRef.current = snap.page;
      setHasMore(more);
      requestAnimationFrame(() => window.scrollTo(0, snap.scrollY));
    })();

    return () => {
      cancelled = true;
    };
    // Only attempt a restore on the initial mount for a given filter set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    const nextPage = page + 1;
    try {
      const q = filtersToQuery({ ...filters, page: nextPage });
      const res = await fetch(`/api/browse${q}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const next = data.items.filter((p: ProfileCardData) => !seen.has(p.id));
        return [...prev, ...next];
      });
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filters, hasMore, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  if (items.length === 0) {
    return <p className="mt-16 text-center text-ink-700">No profiles match these filters.</p>;
  }

  return (
    <>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {items.map((p) => (
          <ProfileCard
            key={p.id}
            p={p}
            saved={savedIds.has(p.userId)}
            saveBusy={savingIds.has(p.userId)}
            onToggleSave={() => void toggleSave(p.userId)}
            returnQuery={filtersKey}
          />
        ))}
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-full bg-ink-950 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-10 w-full" aria-hidden />

      <div className="py-6 text-center text-sm text-ink-700/60">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-rose-600 border-t-transparent animate-spin" />
            Loading more…
          </span>
        ) : hasMore ? (
          <span>Scroll for more</span>
        ) : (
          <span>You&apos;ve reached the end</span>
        )}
      </div>
    </>
  );
}
