"use client";

import { useRef, useState } from "react";

export type ProfileSlide = {
  id: string;
  url: string;
  isMain?: boolean;
  status?: "pending" | "approved" | "rejected";
};

export function ProfilePhotoSlider({
  slides,
  showPhoto,
  fallbackSrc,
  arrows = false,
}: {
  slides: ProfileSlide[];
  showPhoto: boolean;
  fallbackSrc: string;
  /** Previous / next buttons at the sides, for pointer devices (desktop). */
  arrows?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(0);
  const images = slides.length > 0 ? slides : [{ id: "fallback", url: fallbackSrc }];
  const many = images.length > 1;
  const current = images[index] ?? images[0];

  function syncIndex() {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.min(images.length - 1, Math.max(0, next)));
  }

  function goTo(i: number) {
    const el = scroller.current;
    if (!el) return;
    const clamped = Math.min(images.length - 1, Math.max(0, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setIndex(clamped);
  }

  return (
    <div className="absolute inset-0" data-no-pane-swipe>
      <div
        ref={scroller}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch", touchAction: many ? "pan-x" : "pan-y" }}
        onScroll={syncIndex}
        onPointerDown={(e) => {
          tap.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = tap.current;
          tap.current = null;
          if (!start || !many) return;
          if (Math.abs(e.clientX - start.x) > 12 || Math.abs(e.clientY - start.y) > 12) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width * 0.32) goTo(index - 1);
          else if (x > rect.width * 0.68) goTo(index + 1);
        }}
        onPointerCancel={() => {
          tap.current = null;
        }}
        role={many ? "region" : undefined}
        aria-roledescription={many ? "carousel" : undefined}
        aria-label={many ? "Profile photos" : undefined}
      >
        {images.map((slide) => (
          <div key={slide.id} className="relative h-full w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.url}
              alt=""
              draggable={false}
              className="h-full w-full object-cover object-[50%_20%]"
              style={showPhoto ? undefined : { filter: "blur(18px) saturate(0.85)" }}
            />
          </div>
        ))}
      </div>

      {many ? (
        <div className="absolute top-3 inset-x-12 z-10 flex justify-center gap-1">
          {images.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Photo ${i + 1} of ${images.length}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-3 bg-white/45"}`}
            />
          ))}
        </div>
      ) : null}

      {many && arrows
        ? ([-1, 1] as const).map((dir) => {
            const disabled = dir === -1 ? index === 0 : index === images.length - 1;
            return (
              <button
                key={dir}
                type="button"
                onClick={() => goTo(index + dir)}
                disabled={disabled}
                aria-label={dir === -1 ? "Previous photo" : "Next photo"}
                className={`absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-0 ${
                  dir === -1 ? "left-4" : "right-4"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={dir === -1 ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
                </svg>
              </button>
            );
          })
        : null}

      {current?.status === "pending" ? (
        <span className="absolute top-3 right-3 z-20 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          In review
        </span>
      ) : null}
      {current?.status === "rejected" ? (
        <span className="absolute top-3 right-3 z-20 rounded-full bg-rose-700/80 px-2 py-0.5 text-[10px] font-semibold text-white">
          Rejected
        </span>
      ) : null}
    </div>
  );
}
