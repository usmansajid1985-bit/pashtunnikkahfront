"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Step = { img: string; alt: string; title: string; body: string };

const AUTOPLAY_MS = 3500;
/** After the visitor swipes or taps a dot, wait this long before auto-advancing again. */
const RESUME_AFTER_MS = 6000;

/**
 * The three privacy phones. On phones it's a swipeable, auto-advancing slider (native scroll-snap,
 * so swiping feels like the OS); from `sm` up the same markup lays out as a static 3-column grid.
 */
export function PrivacySlider({ steps }: { steps: Step[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);
  const visible = useRef(false);

  function goTo(i: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  // Keep the dots in sync with whatever moved the track (swipe, autoplay or a dot tap).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Only autoplay while the slider is on screen, actually scrollable (mobile) and motion is allowed.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = window.setInterval(() => {
      const scrollable = el.scrollWidth > el.clientWidth + 4;
      if (!scrollable || !visible.current || reduce.matches || Date.now() < pausedUntil.current) return;
      const current = Math.round(el.scrollLeft / el.clientWidth);
      goTo((current + 1) % steps.length);
    }, AUTOPLAY_MS);
    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [steps.length]);

  const pause = () => (pausedUntil.current = Date.now() + RESUME_AFTER_MS);

  return (
    <div className="reveal max-w-6xl mx-auto sm:px-8 mt-14 sm:mt-20">
      <div
        ref={track}
        onTouchStart={pause}
        onPointerDown={pause}
        className="flex sm:grid sm:grid-cols-3 sm:gap-8 overflow-x-auto sm:overflow-visible snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {steps.map((step, i) => (
          <div key={step.title} className="w-full shrink-0 snap-center flex flex-col items-center px-5 sm:px-0">
            <Image
              src={step.img}
              alt={step.alt}
              width={510}
              height={925}
              priority={i === 0}
              className="w-[230px] lg:w-[250px] h-auto"
            />
            <div className="mt-8 flex items-start gap-4 max-w-[270px]">
              <span className="font-display shrink-0 w-12 h-12 rounded-full bg-[#fde6ef] text-brand text-[22px] font-medium flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[19px] font-bold text-ink-950">{step.title}</h3>
                <p className="mt-1 text-[15px] leading-snug text-[#8b8e95]">{step.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sm:hidden mt-7 flex justify-center gap-2">
        {steps.map((step, i) => (
          <button
            key={step.title}
            type="button"
            aria-label={`Show step ${i + 1}: ${step.title}`}
            aria-current={i === active}
            onClick={() => {
              pause();
              goTo(i);
            }}
            className={`h-2 rounded-full transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
              i === active ? "w-6 bg-brand" : "w-2 bg-brand/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
