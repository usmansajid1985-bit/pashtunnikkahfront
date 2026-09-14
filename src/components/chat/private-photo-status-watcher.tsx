"use client";

import { useEffect } from "react";

const POLL_MS = 4000;

/**
 * Headless poller so the header lock badge/subtitle can reflect incoming private-photo status
 * even while the PrivatePhotoShare dropdown/banner (which owns the actual UI) isn't mounted.
 */
export function PrivatePhotoStatusWatcher({
  requestId,
  matchEnded,
  onStatusChange,
}: {
  requestId: string;
  matchEnded: boolean;
  onStatusChange: (status: "none" | "shared" | "active" | "expired") => void;
}) {
  useEffect(() => {
    if (matchEnded) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chats/${requestId}/private-photos`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) onStatusChange(data.incoming?.status || "none");
      } catch {
        /* transient — next poll retries */
      }
    };
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, matchEnded]);

  return null;
}
