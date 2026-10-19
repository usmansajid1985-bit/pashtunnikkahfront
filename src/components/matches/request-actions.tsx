"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type RequestAction = "accept" | "decline" | "withdraw";

/**
 * Accept / decline / withdraw a match request, or block the requester. Shared by the Requests
 * page cards and the request view inside Chats so both behave the same: accepting opens the new
 * chat, everything else refreshes the lists (`onDone` runs first, e.g. to close a panel).
 */
export function useRequestActions(requestId: string, opts: { onDone?: (action: RequestAction | "block") => void } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(action: RequestAction) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/matches/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong — please try again.");
        if (data.code === "stale_request") router.refresh();
        return;
      }
      opts.onDone?.(action);
      if (action === "accept") {
        router.push(`/chats/${requestId}`);
        return;
      }
      router.refresh();
    });
  }

  function block(peerUserId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peerUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not block");
        return;
      }
      opts.onDone?.("block");
      router.refresh();
    });
  }

  return { act, block, pending, error };
}
