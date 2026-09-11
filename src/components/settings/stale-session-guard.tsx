"use client";

import { useEffect } from "react";
import { readSessionMarker, writeSessionMarker, SESSION_MARKER_KEY } from "@/lib/session-marker";

/**
 * Detects a logout-then-different-login that happened in another tab while this Settings page
 * stayed open, and reloads before the user can submit a change that would silently apply to the
 * new account (PN-SETTINGS-005). Render once per Settings page via SettingsShell.
 */
export function StaleSessionGuard({ userId }: { userId: string }) {
  useEffect(() => {
    const existing = readSessionMarker();
    if (existing === null) {
      writeSessionMarker(userId);
    } else if (existing !== userId) {
      window.location.reload();
      return;
    }

    function checkStillCurrent() {
      const current = readSessionMarker();
      if (current !== null && current !== userId) window.location.reload();
    }

    function onStorage(e: StorageEvent) {
      if (e.key === SESSION_MARKER_KEY && e.newValue !== userId) window.location.reload();
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", checkStillCurrent);
    document.addEventListener("visibilitychange", checkStillCurrent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", checkStillCurrent);
      document.removeEventListener("visibilitychange", checkStillCurrent);
    };
  }, [userId]);

  return null;
}
