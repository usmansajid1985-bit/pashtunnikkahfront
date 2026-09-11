/**
 * Cross-tab "who is signed in" marker (PN-SETTINGS-005). A Settings tab left open across a
 * logout-then-different-login on the same browser must not keep submitting mutations against
 * whichever session cookie now happens to be attached — the page looks like it still belongs to
 * the old user, but the server would apply the change to the new one. Every login/logout writes
 * this key; `StaleSessionGuard` (rendered by SettingsShell) watches it and reloads a stale tab.
 */
const KEY = "pn_session_user";

export function writeSessionMarker(userId: string | null) {
  try {
    if (userId) localStorage.setItem(KEY, userId);
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts — nothing to do.
  }
}

export function readSessionMarker(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const SESSION_MARKER_KEY = KEY;
