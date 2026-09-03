"use client";

import { useEffect, useState } from "react";

export function PremiumBanner({ isGold }: { isGold: boolean }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isGold) return;
    setHidden(sessionStorage.getItem("pn_hide_premium") === "1");
  }, [isGold]);

  if (isGold || hidden) return null;

  return (
    <div
      className="card p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-5"
      style={{ background: "linear-gradient(90deg,#fdf0f5,#fdf7f4)", borderColor: "#f7d9e5" }}
    >
      <span className="w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
        </svg>
      </span>
      <div className="flex-1 text-center sm:text-left">
        <p className="font-bold text-ink-950">
          Premium members get <span className="text-rose-600">10x</span> more responses
        </p>
        <p className="text-sm text-ink-700/70 mt-0.5">
          Upgrade now to unlock messages, see who liked you &amp; more.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="/settings/membership"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2Z" />
          </svg>
          Upgrade Now
        </a>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("pn_hide_premium", "1");
            setHidden(true);
          }}
          className="w-8 h-8 flex items-center justify-center text-ink-700/40 hover:text-ink-700 transition"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function CompletenessBanner({ percent }: { percent: number }) {
  if (percent >= 80) return null;
  const circ = 2 * Math.PI * 27;
  const offset = circ - (percent / 100) * circ;

  return (
    <div className="card p-5 mt-4 flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-16 h-16 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="27" fill="none" stroke="#f1eeef" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r="27"
            fill="none"
            stroke="#aa1945"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-bold text-sm text-ink-950">
          {percent}%
        </span>
      </div>
      <div className="flex-1 text-center sm:text-left">
        <p className="font-bold text-ink-950">Complete your profile</p>
        <p className="text-sm text-ink-700/70 mt-0.5">A fuller profile gets more meaningful responses.</p>
      </div>
      <div className="text-center sm:text-right shrink-0">
        <a
          href="/browse"
          className="inline-block px-6 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition"
        >
          Continue
        </a>
        <a href="#why" className="block mt-1.5 text-xs text-rose-600 font-medium hover:underline">
          Why is this important?
        </a>
      </div>
    </div>
  );
}
