"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useChatSocket } from "@/hooks/use-chat-socket";

const RECHECK_MS = 20_000;
/** Channel slot key in the shared realtime manager (kept apart from member thread/user slots). */
const WALI_SLOT = "wali-link";

/**
 * Wraps every wali portal page. Subscribes to this link's realtime topic (which also carries the
 * live chat messages) and swaps all protected content for an "Access revoked" screen the moment
 * the member revokes access — pushed over realtime, with a polled session check as a fallback.
 */
export function WaliRevocationGuard({ topic, children }: { topic: string; children: ReactNode }) {
  const [revoked, setRevoked] = useState(false);
  const { joinThread, leaveThread, on } = useChatSocket(true);

  useEffect(() => {
    if (revoked) return;
    void joinThread(WALI_SLOT, topic);
    return on("wali:revoked", () => setRevoked(true));
  }, [topic, revoked, joinThread, on]);

  useEffect(() => {
    if (revoked) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/wali/session", { cache: "no-store" });
        if (!cancelled && res.status === 401) setRevoked(true);
      } catch {
        // offline — keep current state, the next check will settle it
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = window.setInterval(check, RECHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [revoked]);

  useEffect(() => {
    if (revoked) leaveThread(WALI_SLOT);
  }, [revoked, leaveThread]);

  if (revoked) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-2">
          <p className="text-lg font-semibold text-ink-950">Access revoked</p>
          <p className="text-sm text-ink-700/65">
            The member has removed your wali access. This conversation is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
