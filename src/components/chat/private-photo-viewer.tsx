"use client";

import { useEffect, useState } from "react";

type ViewerPhoto = { index: number; url: string };

type Props = {
  photos: ViewerPhoto[];
  secondsRemaining: number;
  watermark: string;
  onClose: () => void;
  /** Called once the countdown hits zero so the parent can show its own "ended" screen. */
  onExpire: () => void;
};

/**
 * Full-screen private photo gallery (spec §7/§8). Countdown is purely cosmetic here — the server
 * is the source of truth on expiry (spec §10/§11); this just ticks the display down and tells the
 * parent to fetch fresh state once it hits zero, rather than trusting the client clock outright.
 */
export function PrivatePhotoViewer({ photos, secondsRemaining, watermark, onClose, onExpire }: Props) {
  const [active, setActive] = useState(0);
  const [remaining, setRemaining] = useState(secondsRemaining);

  useEffect(() => setRemaining(secondsRemaining), [secondsRemaining]);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const t = setTimeout(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-3">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-black shadow-2xl">
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2.5 bg-gradient-to-b from-black/70 to-transparent">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <span className="text-white text-xs font-semibold bg-black/40 rounded-full px-2.5 py-1">
            {active + 1} / {photos.length}
          </span>
          <span
            className={`text-xs font-bold rounded-full px-2.5 py-1 flex items-center gap-1 ${
              remaining <= 10 ? "bg-rose-600 text-white" : "bg-black/40 text-white"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {mm}:{String(ss).padStart(2, "0")}
          </span>
        </div>

        <div className="relative aspect-[4/5] select-none" style={{ userSelect: "none" }}>
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.index}
              src={p.url}
              alt=""
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
                p.index === active ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />
          ))}
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => setActive((i) => (i === 0 ? photos.length - 1 : i - 1))}
                className="absolute left-0 top-0 bottom-0 w-1/3"
              />
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => setActive((i) => (i === photos.length - 1 ? 0 : i + 1))}
                className="absolute right-0 top-0 bottom-0 w-1/3"
              />
            </>
          ) : null}
        </div>

        {photos.length > 1 ? (
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {photos.map((p) => (
              <span
                key={p.index}
                className={`h-1.5 rounded-full transition-all ${
                  p.index === active ? "w-5 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <p className="sr-only">{watermark}</p>
    </div>
  );
}
