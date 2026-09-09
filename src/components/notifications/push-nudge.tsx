"use client";

import { useEffect, useState } from "react";
import { getPushSupport, subscribeToPush } from "@/lib/push/client";

/**
 * Spec §16: after the user has sent their first match request, invite them to turn on push —
 * the browser permission dialog only fires when they tap "Enable Notifications". "Not now" is
 * remembered server-side so we don't nag.
 */
export function PushNudge() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getPushSupport().supported) return;
    fetch("/api/push/prompt")
      .then((r) => r.json())
      .then((d) => setShow(Boolean(d.shouldPrompt)))
      .catch(() => {});
  }, []);

  if (!show) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    const res = await subscribeToPush();
    if (res.ok) {
      await fetch("/api/push/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: true }),
      }).catch(() => {});
      setShow(false);
    } else if (res.reason === "denied") {
      setError("Notifications are blocked for this site — allow them in your browser settings.");
    } else {
      setError(res.detail || "Couldn't enable notifications. Try again.");
    }
    setBusy(false);
  }

  async function dismiss() {
    setShow(false);
    await fetch("/api/push/prompt", { method: "POST" }).catch(() => {});
  }

  return (
    <div className="card p-4 sm:p-5 flex items-start gap-4 border-rose-100">
      <span className="shrink-0 h-10 w-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink-950">Don&apos;t miss a request</p>
        <p className="text-sm text-ink-700/70 mt-0.5">
          Turn on notifications so you know the moment someone replies, matches or messages you.
        </p>
        {error ? <p className="text-xs text-rose-700 mt-1.5">{error}</p> : null}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable Notifications"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-2 text-sm font-semibold text-ink-700/60 hover:text-ink-900"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
