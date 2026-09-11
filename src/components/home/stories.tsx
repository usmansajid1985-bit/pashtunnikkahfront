"use client";

import { useEffect, useState } from "react";

const stories = [
  {
    quote:
      "We connected through Wali Oversight mode and it made the whole process feel respectful and comfortable for my family.",
    name: "Placeholder Member · Manchester",
    img: "https://images.unsplash.com/photo-1522389903690-657f5318cf1b?q=80&w=300&auto=format&fit=crop",
  },
  {
    quote: "The verification process gave us real peace of mind before we even started chatting.",
    name: "Placeholder Member · Birmingham",
    img: "https://images.unsplash.com/photo-1634858215875-ea5cf1b49bd5?q=80&w=300&auto=format&fit=crop",
  },
  {
    quote: "Simple, respectful, and built around our values — exactly what we were looking for.",
    name: "Placeholder Member · Bradford",
    img: "https://images.unsplash.com/photo-1706471406001-cb671b29cc7f?q=80&w=300&auto=format&fit=crop",
  },
];

function StoryCard({ quote, name, img }: (typeof stories)[0]) {
  return (
    <div className="bg-white border border-ink-900/8 rounded-3xl p-7 shadow-sm h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="Placeholder success story" className="w-14 h-14 rounded-full object-cover grayscale" />
      <p className="font-serif italic text-lg text-ink-950 leading-relaxed mt-4">&ldquo;{quote}&rdquo;</p>
      <p className="mt-4 font-semibold text-rose-600 text-sm">{name}</p>
    </div>
  );
}

export function Stories() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % stories.length), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="stories" className="bg-[#faf6f1] border-y border-ink-900/5 overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="reveal text-center max-w-xl mx-auto">
          <span className="text-rose-600 text-xs font-semibold uppercase tracking-widest">Success Stories</span>
          <h2 className="font-serif mt-3 text-4xl sm:text-5xl font-medium text-ink-950 tracking-tight">
            Real families, real matches
          </h2>
          <p className="mt-2 text-xs text-ink-900/35">
            (Placeholder photos &amp; quotes for design preview — to be replaced with real member stories)
          </p>
        </div>

        <div className="reveal hidden sm:grid mt-12 sm:grid-cols-3 gap-5">
          {stories.map((s) => (
            <StoryCard key={s.name} {...s} />
          ))}
        </div>

        <div className="reveal sm:hidden mt-10 relative">
          <div className="overflow-hidden rounded-3xl">
            <div
              className="flex transition-transform duration-500"
              style={{
                transform: `translateX(-${index * 100}%)`,
                transitionTimingFunction: "cubic-bezier(.16,1,.3,1)",
              }}
            >
              {stories.map((s) => (
                <div key={s.name} className="min-w-full px-1">
                  <StoryCard {...s} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + stories.length) % stories.length)}
              className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
              aria-label="Previous story"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f0d0e" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % stories.length)}
              className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
              aria-label="Next story"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f0d0e" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
          <div className="flex justify-center gap-2 mt-4">
            {stories.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to story ${i + 1}`}
                className={`story-dot ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
