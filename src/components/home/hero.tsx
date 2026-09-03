"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const FALLBACK_SLIDES = [
  "https://images.unsplash.com/photo-1634858215875-ea5cf1b49bd5?q=80&w=1800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522389903690-657f5318cf1b?q=80&w=1800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1706471406001-cb671b29cc7f?q=80&w=1800&auto=format&fit=crop",
];

export function Hero({ slides = FALLBACK_SLIDES }: { slides?: string[] }) {
  const images = slides.length > 0 ? slides : FALLBACK_SLIDES;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <section className="relative overflow-hidden min-h-[560px] sm:min-h-[640px] flex items-center">
      <div className="absolute inset-0">
        {images.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2500ms]"
            style={{
              backgroundImage: `url('${src}')`,
              opacity: i === index ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-rose-50/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-16">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-4 items-end">
          <div className="reveal">
            <p className="font-serif italic text-rose-600 text-lg sm:text-xl">A modern take on tradition</p>
            <span className="inline-flex items-center gap-2 mt-3 px-3.5 py-1.5 rounded-full bg-white text-rose-600 text-xs font-semibold tracking-wide uppercase">
              Shariah Compliant · Guaranteed Anonymity
            </span>
            <h1 className="font-serif mt-5 text-[13vw] leading-[0.95] sm:text-6xl lg:text-7xl xl:text-8xl font-medium text-ink-950 tracking-tight">
              Find your
              <br />
              <span className="italic">Nikah</span>, the
              <br />
              <span className="underline-accent">right way.</span>
            </h1>
          </div>
          <div className="reveal lg:pb-3">
            <p className="text-ink-700 text-base sm:text-lg leading-relaxed max-w-md">
              The first dedicated Pashtun matrimony platform — connecting families with trust, tradition, and
              transparency. A safe space to find your partner while upholding our values.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="px-6 py-3.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition flex items-center gap-2"
              >
                Register Now
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-full border border-ink-900/20 bg-white/70 backdrop-blur-sm text-ink-900 text-sm font-semibold hover:border-rose-300 transition"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
