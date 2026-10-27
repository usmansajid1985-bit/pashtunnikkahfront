"use client";

import { useRef, useState } from "react";
import { ProfileCard, type ProfileCardData } from "@/components/browse/profile-card";

/** Browse → My saves: the member's bookmarked profiles. Unsaving removes the card. */
export function SavedGrid({ initialItems }: { initialItems: ProfileCardData[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function unsave(userId: string) {
    if (busy.has(userId)) return;
    setBusy((prev) => new Set(prev).add(userId));
    const res = await fetch("/api/favourites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    if (!res?.ok) {
      showToast("Could not update saved profiles.");
      return;
    }
    setItems((prev) => prev.filter((p) => p.userId !== userId));
    showToast("Removed from My saves");
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 card p-8 text-center">
        <span aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
            <path d="M6 3.5h12v17l-6-4.2-6 4.2v-17Z" />
          </svg>
        </span>
        <p className="mt-3 font-semibold text-ink-950">No saved profiles yet</p>
        <p className="mt-1 text-sm text-ink-700/70">Tap the bookmark on a profile in Browse to save it here.</p>
        <a href="/browse" className="mt-4 inline-flex px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold">
          Browse members
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => (
          <ProfileCard
            key={p.id}
            p={p}
            saved
            saveBusy={busy.has(p.userId)}
            onToggleSave={() => void unsave(p.userId)}
            returnQuery="?saved=1"
          />
        ))}
      </div>
      {toast ? (
        <div className="fixed bottom-[calc(1.5rem+var(--pn-bottom-nav-h))] left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-full bg-ink-950 text-white text-sm font-medium shadow-lg">
          {toast}
        </div>
      ) : null}
    </>
  );
}
