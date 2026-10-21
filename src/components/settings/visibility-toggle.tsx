"use client";

import { useState } from "react";

/** S01: Profile Visibility + Pause in one place — a single Active / Paused switch, saved instantly. */
export function VisibilityToggle({ initialPaused }: { initialPaused: boolean }) {
  const [paused, setPaused] = useState(initialPaused);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    if (busy || next === paused) return;
    setBusy(true);
    setError(null);
    const prev = paused;
    setPaused(next);
    try {
      const res = await fetch("/api/profile/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPaused(prev);
      setError("Couldn't update your visibility. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-ink-900/8 bg-white p-1.5 shadow-[0_8px_30px_-20px_rgba(15,13,14,0.35)]">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-ink-900/[0.04] p-1" role="radiogroup" aria-label="Profile visibility">
          {[
            { v: false, label: "Active" },
            { v: true, label: "Paused" },
          ].map((o) => {
            const on = paused === o.v;
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy}
                onClick={() => void set(o.v)}
                className={`h-12 rounded-xl flex items-center justify-center gap-2 text-[15px] font-semibold transition ${
                  on
                    ? o.v
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-emerald-700 text-white shadow-sm"
                    : "text-ink-700 hover:text-ink-950"
                }`}
              >
                {o.v ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                )}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-[#fde8f1] px-4 py-4">
        <svg className="mt-0.5 shrink-0 text-[#e12d72]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-ink-950">Paused mode hides your profile from Browse</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700/75">
            You can still access your existing chats and requests, and subscription billing continues while paused.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
