"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 20_000;

/**
 * Live "Active now / Active today…" labels for the given member user ids. Re-reads every 20s while
 * this tab is visible, immediately when it becomes visible again, and on realtime resync — so dots
 * flip within ~20s of a member opening or leaving the app, without a page refresh.
 * Returns a map userId → label; ids not yet fetched are absent (callers keep their server label).
 */
export function useLivePresence(userIds: string[]): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const key = [...new Set(userIds)].sort().join(",");
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let inFlight = false;

    const load = async () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const ids = keyRef.current.split(",").slice(0, 60).join(",");
        const res = await fetch(`/api/presence/status?ids=${ids}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { statuses?: Record<string, string> };
        if (!cancelled && data.statuses) setLabels((prev) => ({ ...prev, ...data.statuses }));
      } catch {
        /* offline — keep last labels */
      } finally {
        inFlight = false;
      }
    };

    const first = window.setTimeout(load, 1500); // let the page settle; server labels are fresh
    const id = window.setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", load);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", load);
    };
  }, [key]);

  return labels;
}
