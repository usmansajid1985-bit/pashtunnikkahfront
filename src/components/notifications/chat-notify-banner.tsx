"use client";

import { useEffect, useState } from "react";
import { getPushSupport, subscribeToPush } from "@/lib/push/client";

const DISMISS_KEY = "pn_chat_notify_dismissed_at";
/** "×" hides the banner on this device for a while, then it may ask again. */
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

type State = "hidden" | "ask" | "busy" | "done";

/**
 * "Love moves fast. Make sure you're notified." at the top of a chat. "Notify me" runs the real
 * push sign-up — the browser's permission prompt, then registering this device — instead of just
 * closing. Hidden once notifications are on; explains what to do when they're blocked or (iPhone)
 * the app has to be added to the Home Screen first.
 */
export function ChatNotifyBanner() {
  const [state, setState] = useState<State>("hidden");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_MS) return;
    } catch {
      /* storage blocked — still show */
    }
    const support = getPushSupport();
    // Already allowed on this device: nothing to ask.
    if (support.supported && Notification.permission === "granted") return;
    setState("ask");
  }, []);

  if (state === "hidden") return null;

  async function enable() {
    setNote(null);
    setState("busy");
    const res = await subscribeToPush();
    if (res.ok) {
      await fetch("/api/push/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: true }),
      }).catch(() => {});
      setState("done");
      window.setTimeout(() => setState("hidden"), 2500);
      return;
    }
    setState("ask");
    if (res.reason === "denied") {
      setNote("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
    } else if (res.reason === "ios_not_installed") {
      setNote("On iPhone, tap Share → Add to Home Screen, open Pashtun Nikah from there, then tap Notify me.");
    } else if (res.reason === "unsupported") {
      setNote("This browser doesn't support notifications. Try Chrome, Edge or Safari.");
    } else {
      setNote(res.detail || "Couldn't turn on notifications. Please try again.");
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setState("hidden");
  }

  return (
    <div className="rounded-2xl px-3.5 py-3 bg-gradient-to-r from-[#eef2ff] to-[#f5f0ff] border border-indigo-100">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[13px] text-ink-900 leading-snug">
          {state === "done" ? "You're all set — we'll notify you of new messages." : "Love moves fast. Make sure you're notified."}
        </p>
        {state === "done" ? (
          <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5 9-10" />
            </svg>
          </span>
        ) : (
          <>
            <button
              type="button"
              disabled={state === "busy"}
              className="shrink-0 px-3 py-1.5 rounded-full bg-[#4f6ef7] hover:bg-[#3f5ee6] text-white text-xs font-semibold disabled:opacity-60"
              onClick={() => void enable()}
            >
              {state === "busy" ? "Turning on…" : "Notify me"}
            </button>
            <button type="button" className="shrink-0 text-ink-700/40 hover:text-ink-700" onClick={dismiss} aria-label="Dismiss">
              ×
            </button>
          </>
        )}
      </div>
      {note ? <p className="mt-2 text-[12px] text-rose-700 leading-snug">{note}</p> : null}
    </div>
  );
}
