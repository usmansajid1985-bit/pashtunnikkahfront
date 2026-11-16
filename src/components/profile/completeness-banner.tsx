"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listAnd, type CompletionField } from "@/lib/profile-completeness";

const DISMISS_KEY = "pn_completeness_banner_dismissed_until";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/**
 * "N profile details left to add" banner shown beneath the header on Overview, Browse and Profile.
 * White card, pink percentage ring and ×. Lists the actual missing fields, links to Edit profile,
 * and is dismissible for 7 days (per device). Hidden automatically at 100%.
 */
export function CompletenessBanner({
  percent,
  missing,
  completeHref,
}: {
  percent: number;
  missing: Pick<CompletionField, "label">[];
  completeHref: string;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (percent >= 100 || missing.length === 0) {
      setHidden(true);
      return;
    }
    let until = 0;
    try {
      until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    } catch {
      until = 0;
    }
    setHidden(Date.now() < until);
  }, [percent, missing.length]);

  if (hidden || percent >= 100 || missing.length === 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS));
    } catch {
      /* private mode / blocked storage — just hide for this view */
    }
    setHidden(true);
  };

  const r = 16;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative mb-5 flex items-center gap-4 rounded-2xl border border-ink-900/8 bg-white px-4 py-3.5 shadow-[0_2px_14px_-10px_rgba(15,13,14,0.25)]">
      <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#f3e3ea" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="#e12d72"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - percent / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-ink-950">
          {percent}%
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink-950">
          {missing.length} profile detail{missing.length === 1 ? "" : "s"} left to add
        </p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-700/65">
          {listAnd(missing.map((m) => m.label))}.{" "}
          <span className="text-ink-700/50">Completed profiles appear higher in Browse.</span>
        </p>
        <Link href={completeHref} className="mt-1 inline-block text-[13px] font-semibold text-[#e12d72] hover:underline">
          Complete my profile →
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 self-start -mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-ink-700/50 hover:bg-ink-900/5 hover:text-ink-900"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
