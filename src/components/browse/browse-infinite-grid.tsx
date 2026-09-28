"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ProfileCard, type ProfileCardData } from "@/components/browse/profile-card";
import { useRouter } from "next/navigation";
import { filtersToQuery, type BrowseFilters } from "@/lib/browse-filters-shared";
import { useChatSocket } from "@/hooks/use-chat-socket";

const FRESH_CHECK_MS = 60_000;

/** `/api/browse` URL for these filters plus extra params. filtersToQuery() returns "" (no "?")
 * for default filters, so extras can't simply be appended with "&". */
function browseUrl(filters: BrowseFilters, extra: Record<string, string | number> = {}) {
  const params = new URLSearchParams(filtersToQuery(filters).replace(/^\?/, ""));
  for (const [k, v] of Object.entries(extra)) params.set(k, String(v));
  const q = params.toString();
  return `/api/browse${q ? `?${q}` : ""}`;
}

type Props = {
  initialItems: ProfileCardData[];
  initialHasMore: boolean;
  filters: BrowseFilters;
  initialSavedUserIds?: string[];
  /** Expansion stage to continue with once the member's own filters are exhausted (B12/B21). */
  initialNextStage?: number | null;
  /** Shared realtime topic announcing members leaving/returning to Browse (S03/S04). */
  browseTopic?: string;
};

export function BrowseInfiniteGrid({
  initialItems,
  initialHasMore,
  filters,
  initialSavedUserIds = [],
  initialNextStage = null,
  browseTopic,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [freshActivity, setFreshActivity] = useState(false);
  const router = useRouter();
  // 0 = the member's own filters; >0 = expanded discovery stage currently being paged.
  const [stage, setStage] = useState(0);
  const [nextStage, setNextStage] = useState<number | null>(initialNextStage);
  /** Number of cards that matched the member's own preferences — the divider goes after them. */
  const [strictCount, setStrictCount] = useState<number | null>(
    initialHasMore ? null : initialItems.length
  );
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
    setStage(0);
    setNextStage(initialNextStage);
    setStrictCount(initialHasMore ? null : initialItems.length);
    setLoading(false);
    loadingRef.current = false;
  }, [initialItems, initialHasMore, initialNextStage, filters]);

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
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        save();
      }, 300);
    };
    window.addEventListener("pagehide", save);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("scroll", onScroll);
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
    if (snap.key !== filtersKey || Date.now() - snap.ts > 30 * 60_000) return;
    // B02: page 1 needs no re-fetch — just put the member back where they were.
    if (snap.page <= 1) {
      requestAnimationFrame(() => window.scrollTo(0, snap.scrollY));
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

  // S03/S04: a member paused / was hidden → their card disappears at once. A member resumed →
  // ask the server whether they belong in THIS viewer's filtered results, and if so slot them in
  // at the top (they were just active). No refresh needed either way.
  const { joinThread, leaveThread, on } = useChatSocket(Boolean(browseTopic));
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (!browseTopic) return;
    void joinThread("browse", browseTopic);
    const off = on("browse:visibility", async (e: { userId: string; visible: boolean }) => {
      if (!e?.userId) return;
      if (!e.visible) {
        setItems((prev) => prev.filter((it) => it.userId !== e.userId));
        return;
      }
      if (itemsRef.current.some((it) => it.userId === e.userId)) return;
      // Spread the re-checks out so one resume doesn't hit the server from every open Browse at once.
      await new Promise((r) => setTimeout(r, Math.random() * 1500));
      try {
        const res = await fetch(browseUrl({ ...filters, page: 1 }, { peekUser: e.userId }));
        if (!res.ok) return;
        const data: { item: ProfileCardData | null } = await res.json();
        if (!data.item) return;
        setItems((prev) => (prev.some((it) => it.userId === e.userId) ? prev : [data.item!, ...prev]));
      } catch {
        /* offline — the next Browse load picks them up */
      }
    });
    return () => {
      off();
      leaveThread("browse");
    };
  }, [browseTopic, filters, joinThread, leaveThread, on]);

  // B20: keep the list stable, but tell the member when someone who wasn't already near the
  // top has become active since this Browse was loaded.
  useEffect(() => {
    const loadedAt = Date.now();
    setFreshActivity(false);
    const alreadyActive = new Set(
      initialItems.filter((it) => (it.activityBucket ?? 99) <= 2).map((it) => it.userId)
    );
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(browseUrl({ ...filters, page: 1 }, { freshSince: loadedAt }));
        if (!res.ok) return;
        const data: { userIds: string[] } = await res.json();
        if (data.userIds.some((id) => !alreadyActive.has(id))) setFreshActivity(true);
      } catch {
        /* offline */
      }
    };
    const id = window.setInterval(check, FRESH_CHECK_MS);
    return () => window.clearInterval(id);
  }, [initialItems, filters]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    // Current result set exhausted → continue into the next expansion stage, if any.
    const continuing = !hasMore && nextStage != null;
    if (!hasMore && !continuing) return;
    loadingRef.current = true;
    setLoading(true);
    const targetStage = continuing ? nextStage! : stage;
    const nextPage = continuing ? 1 : page + 1;
    try {
      const res = await fetch(
        browseUrl({ ...filters, page: nextPage }, targetStage > 0 ? { x: targetStage } : {})
      );
      if (!res.ok) return;
      const data = await res.json();
      const seen = new Set(items.map((p) => p.id));
      const fresh: ProfileCardData[] = data.items.filter((p: ProfileCardData) => !seen.has(p.id));
      // Divider position = how many cards matched the member's own preferences.
      if (continuing && stage === 0) setStrictCount((c) => c ?? items.length);
      if (targetStage === 0 && !data.hasMore) setStrictCount((c) => c ?? items.length + fresh.length);
      setItems([...items, ...fresh]);
      setStage(targetStage);
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
      setNextStage(data.nextStage ?? null);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filters, hasMore, items, nextStage, page, stage]);

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

  if (items.length === 0 && nextStage == null) {
    return <p className="mt-16 text-center text-ink-700">No profiles match these filters.</p>;
  }

  const expandedDivider = (
    <div className="col-span-full my-2 rounded-2xl border border-sky-100 bg-sky-50/70 px-5 py-4 text-center">
      <p className="font-semibold text-ink-950">You&apos;ve seen everyone matching your preferences</p>
      <p className="mt-1 text-sm text-ink-700/70">
        Here are more members close to what you&apos;re looking for. Each one shows which preference it
        falls outside.
      </p>
    </div>
  );

  return (
    <>
      {freshActivity ? (
        <div className="sticky top-3 z-30 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setFreshActivity(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
              router.refresh();
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            New activity available — Refresh
          </button>
        </div>
      ) : null}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {strictCount === 0 ? expandedDivider : null}
        {items.map((p, i) => (
          <Fragment key={p.id}>
            {strictCount != null && strictCount > 0 && i === strictCount ? expandedDivider : null}
          <ProfileCard
            key={p.id}
            p={p}
            saved={savedIds.has(p.userId)}
            saveBusy={savingIds.has(p.userId)}
            onToggleSave={() => void toggleSave(p.userId)}
            returnQuery={filtersKey}
          />
          </Fragment>
        ))}
      </div>

      {toast ? (
        <div className="fixed bottom-[calc(1.5rem+var(--pn-bottom-nav-h))] left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-full bg-ink-950 text-white text-sm font-medium shadow-lg">
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
        ) : hasMore || nextStage != null ? (
          <span>Scroll for more</span>
        ) : strictCount != null && stage === 0 && items.length > 0 ? (
          <span>You&apos;ve seen everyone matching your preferences</span>
        ) : (
          <span>You&apos;ve reached the end</span>
        )}
      </div>
    </>
  );
}
