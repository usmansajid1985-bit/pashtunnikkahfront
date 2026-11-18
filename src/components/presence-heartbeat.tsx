"use client";

import { useEffect } from "react";
import { FOREGROUND_IDLE_MS, HEARTBEAT_INTERVAL_MS } from "@/lib/presence";

const INTERVAL_MS = HEARTBEAT_INTERVAL_MS;
/** A tap after a quiet spell re-beats quickly, but scrolling doesn't spam the server. */
const ACTIVITY_THROTTLE_MS = 15_000;
/** B04: an open-but-idle tab stops counting as active once nobody has touched it for this long. */
const IDLE_AFTER_MS = FOREGROUND_IDLE_MS;

/**
 * Keeps last_seen_at fresh only while the member is genuinely using the app in the foreground:
 * - foreground + touched within 5 min → heartbeat every 20s ("Active now" within ~1s of opening);
 * - backgrounded / locked → an "away" beacon drops the dot within seconds;
 * - app killed / signal lost (no beacon) → heartbeats stop, dot expires after the 45s window.
 * Works per device, so another device in use keeps the member active.
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
      } else {
        // Backgrounded / locked: tell the server we've gone away so the "Active now" dot drops in
        // seconds instead of lingering for the full online window. Beacon survives the page freezing.
        try {
          navigator.sendBeacon?.("/api/presence/heartbeat?away=1");
        } catch {
          /* ignore */
        }
      }
    };
    const onActivity = () => {
      lastInteraction = Date.now();
      void beat(false);
    };

    // iOS PWAs swiped away don't always fire visibilitychange — pagehide still lets the beacon go.
    const onHide = () => {
      try {
        navigator.sendBeacon?.("/api/presence/heartbeat?away=1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
    };
  }, []);

  return null;
}
