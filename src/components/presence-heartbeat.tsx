"use client";

import { useEffect } from "react";

const INTERVAL_MS = 60_000;
const ACTIVITY_THROTTLE_MS = 45_000;
/** B04: an open-but-idle tab stops counting as active once nobody has touched it for this long. */
const IDLE_AFTER_MS = 3 * 60_000;

/**
 * Keeps last_seen_at fresh only while the member is genuinely using the app — a visible tab
 * with no taps/keys/scrolls for IDLE_AFTER_MS no longer heartbeats, so the server-side live
 * state expires after ~3–5 minutes of no meaningful activity.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    let lastBeat = 0;
    let lastInteraction = Date.now();

    async function beat(force = false) {
      if (cancelled || document.visibilityState !== "visible") return;
      if (Date.now() - lastInteraction > IDLE_AFTER_MS) return;
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
      if (document.visibilityState === "visible") {
        lastInteraction = Date.now();
        void beat(true);
      }
    };
    const onActivity = () => {
      lastInteraction = Date.now();
      void beat(false);
    };

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
