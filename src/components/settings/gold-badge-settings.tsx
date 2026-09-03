"use client";

import { useState, useTransition } from "react";

export function GoldBadgeSettings({
  initialHide,
  isGold,
}: {
  initialHide: boolean;
  isGold: boolean;
}) {
  const [hide, setHide] = useState(initialHide);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!isGold) return null;

  function toggle(next: boolean) {
    setHide(next);
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/gold-badge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hide: next }),
      });
      if (!res.ok) {
        setHide(!next);
        return;
      }
      setMsg(next ? "Gold badge hidden on your profile." : "Gold badge visible on your profile.");
    });
  }

  return (
    <section className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-ink-950">Gold member badge</h3>
          <p className="mt-1 text-[12.5px] text-ink-700/65 leading-relaxed">
            Show a Gold pill on your public profile. You can hide it if you prefer a discreet presence.
          </p>
          {msg ? <p className="mt-2 text-xs font-medium text-emerald-700">{msg}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!hide}
          disabled={pending}
          onClick={() => toggle(!hide)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-50 ${
            hide ? "bg-ink-900/15" : "bg-rose-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
              hide ? "translate-x-0" : "translate-x-5"
            }`}
          />
        </button>
      </div>
      <p className="mt-3 text-xs text-ink-700/50">{hide ? "Badge hidden" : "Badge shown"}</p>
    </section>
  );
}
