"use client";

import { PASHTO_LEVELS } from "@/lib/signup";

/** "How well do you speak Pashto?" — rendered only when Pashto is one of the member's languages. */
export function PashtoLevelQuestion({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (level: string) => void;
  /** Edit Profile: smaller heading, no intro tag. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "pt-2" : "mt-5 border-t border-ink-900/8 pt-5"}>
      {compact ? (
        <p id="pashto-level-label" className="text-xs font-semibold">
          How well do you speak Pashto?
        </p>
      ) : (
        <>
          <span className="inline-block rounded-full bg-[#f7e9dc] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a45a1c]">
            Cultural verification
          </span>
          <h2 id="pashto-level-label" className="font-serif mt-2.5 text-xl font-medium text-ink-950">
            How well do you speak Pashto?
          </h2>
          <p className="mt-1 text-sm text-ink-700/70">This helps us understand your connection to the language.</p>
        </>
      )}
      <div role="radiogroup" aria-labelledby="pashto-level-label" className="mt-3 space-y-2">
        {PASHTO_LEVELS.map((level) => {
          const on = value === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(level)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                on
                  ? "border-rose-600 bg-rose-50 font-semibold text-rose-700"
                  : "border-ink-900/10 bg-white text-ink-950 hover:border-rose-200"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-rose-600 bg-rose-600 text-white" : "border-ink-900/25 bg-white"
                }`}
              >
                {on ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                ) : null}
              </span>
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
}
