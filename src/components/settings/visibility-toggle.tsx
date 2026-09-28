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
    <div className="mt-5 bg-white rounded-2xl border border-ink-900/6 p-5">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-ink-900/[0.04] p-1" role="radiogroup" aria-label="Profile visibility">
        {[
          { v: false, label: "Active" },
          { v: true, label: "Paused" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={paused === o.v}
            disabled={busy}
            onClick={() => void set(o.v)}
            className={`py-2.5 rounded-full text-sm font-semibold transition ${
              paused === o.v ? (o.v ? "bg-amber-500 text-white" : "bg-emerald-600 text-white") : "text-ink-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-800 leading-relaxed">
        {paused ? (
          <>
            <span className="font-semibold">Your profile is paused.</span> You&apos;re hidden from Browse and won&apos;t
            receive new Match Requests. Your existing matches and chats stay open, and your approval status
            doesn&apos;t change.
          </>
        ) : (
          <>
            <span className="font-semibold">Your profile is active.</span> Approved members can find you in Browse
            and send you Match Requests.
          </>
        )}
      </p>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
