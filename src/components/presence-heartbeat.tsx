"use client";

import { useEffect } from "react";

const INTERVAL_MS = 60_000;
const ACTIVITY_THROTTLE_MS = 45_000;

/** Keeps last_seen_at fresh while the tab is visible — drives Online status on Browse. */
export function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    let lastBeat = 0;

    async function beat(force = false) {
      if (cancelled || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (!force && now - lastBeat < ACTIVITY_THROTTLE_MS) return;
      lastBeat = now;
      try {
        await fetch("/api/presence/heartbeat", { method: "POST", credentials: "include" });
      } catch {
        /* ignore */
      }
    }

    void beat(true);
    const id = window.setInterval(() => void beat(true), INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void beat(true);
    };
    const onActivity = () => void beat(false);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, []);

  return null;
}
