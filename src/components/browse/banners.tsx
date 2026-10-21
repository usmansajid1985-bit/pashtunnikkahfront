"use client";

import { useEffect, useState } from "react";
import { openGoldUpsell } from "@/components/billing/gold-upsell";
import { GOLD_MONTHLY_CREDITS } from "@/lib/stripe-constants";
import { GoldFeatureIcon, type GoldFeatureIconName } from "@/components/settings/membership-icons";

export function PremiumBanner({
  isGold,
  monthlyTokens = GOLD_MONTHLY_CREDITS,
}: {
  isGold: boolean;
  monthlyTokens?: number;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isGold) return;
    setHidden(sessionStorage.getItem("pn_hide_premium") === "1");
  }, [isGold]);

  if (isGold || hidden) return null;

  const chips: { icon: GoldFeatureIconName | "bookmark"; label: string }[] = [
    { icon: "tokens", label: `${monthlyTokens} Match Tokens / month` },
    { icon: "eye", label: "See who viewed you" },
    { icon: "bookmark", label: "Saved profiles" },
    { icon: "filters", label: "Advanced filters" },
  ];

  return (
    <div className="relative rounded-2xl border border-[#f7d9e5] bg-gradient-to-r from-[#fdf0f5] via-[#fdf3f6] to-[#fdf7f4] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem("pn_hide_premium", "1");
          setHidden(true);
        }}
        className="absolute top-2 right-2 sm:static sm:order-last w-8 h-8 shrink-0 flex items-center justify-center text-ink-700/40 hover:text-ink-700 transition"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>
      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
        <span className="w-14 h-14 shrink-0 rounded-full bg-white shadow-[0_6px_18px_-8px_rgba(225,45,114,0.45)] flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#e7a93b" aria-hidden>
            <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
          </svg>
        </span>
        <div className="min-w-0 pr-6 sm:pr-0">
          <p className="font-serif text-lg font-bold text-ink-950">Unlock more with Gold</p>
          <p className="mt-0.5 text-[13px] text-ink-700/70">
            Get {monthlyTokens} Match Tokens each month, see who viewed you, save profiles and unlock advanced filters.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#f3d3e0] bg-white px-2.5 py-1 text-[12px] text-ink-900"
              >
                {c.icon === "bookmark" ? (
                  <svg className="h-3.5 w-3.5 text-[#e12d72]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                    <path d="M6 3h12v18l-6-4-6 4z" />
                  </svg>
                ) : (
                  <GoldFeatureIcon icon={c.icon} className="h-3.5 w-3.5 text-[#e12d72]" />
                )}
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openGoldUpsell("upgrade")}
        className="shrink-0 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-[#e12d72] to-[#ec407a] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(225,45,114,0.8)] hover:brightness-105 transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden>
          <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2Z" />
        </svg>
        Upgrade to Gold
      </button>
    </div>
  );
}

export function CompletenessBanner({ percent }: { percent: number }) {
  if (percent >= 80) return null;
  const circ = 2 * Math.PI * 27;
  const offset = circ - (percent / 100) * circ;

  return (
    <div className="card p-5 flex flex-col sm:flex-row items-center gap-5">
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
