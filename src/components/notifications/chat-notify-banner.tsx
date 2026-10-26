"use client";

import { useEffect, useState } from "react";
import { getPushSupport, subscribeToPush } from "@/lib/push/client";

const DISMISS_KEY = "pn_chat_notify_dismissed_at";
/** "×" hides the banner on this device for a while, then it may ask again. */
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

type State = "hidden" | "ask" | "busy" | "done";

/**
 * "Don't miss a message" card at the top of a chat. "Enable notifications" runs the real
 * push sign-up — the browser's permission prompt, then registering this device — instead of just
 * closing. Hidden once notifications are on; explains what to do when they're blocked or (iPhone)
 * the app has to be added to the Home Screen first. "Maybe later" hides it on this device for 14 days.
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
      setNote("On iPhone, tap Share → Add to Home Screen, open Pashtun Nikah from there, then tap Enable notifications.");
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
    <div className="@container rounded-2xl border border-sky-100 bg-[#f1f6fd] px-4 py-3.5">
      {state === "done" ? (
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5 9-10" />
            </svg>
          </span>
          <p className="text-[13px] font-semibold text-ink-950">You&apos;re all set — we&apos;ll notify you of new messages.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="shrink-0 mt-0.5 text-ink-950" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 2 6 2 6H4s2-1.5 2-6Z" />
                <path d="M10 19a2 2 0 0 0 4 0" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-ink-950">Don&apos;t miss a message</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-700/75">
                Get notified when someone sends you a request, accepts yours or messages you, so you can respond without delay.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 @lg:flex-col @lg:items-end @lg:gap-1 shrink-0">
            <button
              type="button"
              disabled={state === "busy"}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1d72f2] hover:bg-[#1663d6] px-5 py-2.5 text-[14px] font-semibold text-white disabled:opacity-60"
              onClick={() => void enable()}
            >
              {state === "busy" ? "Turning on…" : "Enable notifications"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            <button type="button" className="text-[11.5px] text-ink-700/55 hover:text-ink-900" onClick={dismiss}>
              Maybe later
            </button>
          </div>
        </div>
      )}
      {note ? <p className="mt-2 text-[12px] text-rose-700 leading-snug">{note}</p> : null}
    </div>
  );
}
