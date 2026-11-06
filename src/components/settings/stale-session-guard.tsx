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
    // This page was just server-rendered for the current session cookie, so `userId` is, by
    // definition, the user who is signed in right now. Adopt it as the marker and NEVER reload on
    // mount: a reload can't change the stored marker, so reloading here on a mismatch (e.g. a stale
    // marker left by a prior account, or a signup that didn't update it) would loop forever. We
    // only reload when the marker CHANGES to a different user while this page stays open — the real
    // "logged out then back in as someone else in another tab" case. (PN-SETTINGS-005)
    writeSessionMarker(userId);

    function checkStillCurrent() {
      const current = readSessionMarker();
      if (current !== null && current !== userId) window.location.reload();
    }

    function onStorage(e: StorageEvent) {
      if (e.key === SESSION_MARKER_KEY && e.newValue !== null && e.newValue !== userId) {
        window.location.reload();
      }
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
