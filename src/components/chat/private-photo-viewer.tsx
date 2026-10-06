"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ViewerPhoto = { index: number; url: string };

type Props = {
  photos: ViewerPhoto[];
  secondsRemaining: number;
  watermark: string;
  onClose: () => void;
  /** Called once the countdown hits zero so the parent can show its own "ended" screen. */
  onExpire: () => void;
};

type LoadState = "loading" | "loaded" | "error";

const SWIPE_PX = 40;

/**
 * Full-screen private photo gallery (spec §7/§8). The server is the source of truth on expiry;
 * the display counts down from a FIXED expiry timestamp (PH04/PH05) so it never stutters, never
 * pauses while closed/backgrounded, and reopening resumes from the real remaining time.
 *
 * Rendered through a portal: the chat panes use CSS transforms for the swipe gesture, which would
 * otherwise trap this `position: fixed` overlay inside the pane (clipped under the header, M06).
 */
export function PrivatePhotoViewer({ photos, secondsRemaining, watermark, onClose, onExpire }: Props) {
  const [active, setActive] = useState(0);
  const [expiresAt] = useState(() => Date.now() + secondsRemaining * 1000);
  const [remaining, setRemaining] = useState(secondsRemaining);
  const [load, setLoad] = useState<Record<number, LoadState>>({});
  const [mounted, setMounted] = useState(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        onExpireRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    // Background tabs throttle intervals — re-sync the moment the page is visible again.
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [expiresAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function prev() {
    setActive((i) => (i === 0 ? photos.length - 1 : i - 1));
  }
  function next() {
    setActive((i) => (i === photos.length - 1 ? 0 : i + 1));
  }

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const state = load[photos[active]?.index ?? -1] ?? "loading";

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Private photos"
      data-chat-overlay
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm px-3 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative w-full max-w-sm">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <span className="text-white text-sm font-semibold tabular-nums bg-white/10 rounded-full px-3 py-1">
            {active + 1}/{photos.length}
          </span>
          <span
            className={`text-sm font-bold tabular-nums rounded-full px-3 py-1 flex items-center gap-1.5 ${
              remaining <= 10 ? "bg-rose-600 text-white" : "bg-white/10 text-white"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {mm}:{String(ss).padStart(2, "0")}
          </span>
        </div>

        <div
          className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-ink-950 select-none"
          style={{ userSelect: "none", touchAction: "pan-y" }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start || photos.length < 2) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - start.y)) {
              if (dx < 0) next();
              else prev();
            }
          }}
        >
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.index}
              src={p.url}
              alt=""
              draggable={false}
              onLoad={() => setLoad((s) => ({ ...s, [p.index]: "loaded" }))}
              onError={() => setLoad((s) => ({ ...s, [p.index]: "error" }))}
              onContextMenu={(e) => e.preventDefault()}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                p.index === photos[active]?.index && load[p.index] === "loaded"
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
            />
          ))}

          {state === "loading" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
              <span className="h-8 w-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              <span className="text-xs">Loading photo…</span>
            </div>
          ) : null}
          {state === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-white/80">
              <span className="text-sm font-semibold">This photo couldn&apos;t be loaded</span>
              <span className="text-xs text-white/55">Your timer keeps running. Try the next photo or reopen.</span>
            </div>
          ) : null}

          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {photos.map((p, i) => (
                  <span
                    key={p.index}
                    className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/50">
          One-time viewing session — photos blur again when the timer ends.
        </p>
      </div>
      <p className="sr-only">{watermark}</p>
    </div>,
    document.body
  );
}
