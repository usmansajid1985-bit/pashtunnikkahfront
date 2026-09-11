"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RequestActions({
  requestId,
  mode,
  peerUserId,
}: {
  requestId: string;
  mode: "incoming" | "sent";
  /** Needed to block an incoming requester without accepting them first. */
  peerUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  async function act(action: "accept" | "decline" | "withdraw") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/matches/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      if (action === "accept") {
        router.push(`/chats/${requestId}`);
        return;
      }
      router.refresh();
    });
  }

  async function block() {
    if (!peerUserId) return;
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
      setConfirmBlock(false);
      router.refresh();
    });
  }

  if (mode === "sent") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => act("withdraw")}
        className="text-sm font-semibold text-ink-700/70 hover:text-rose-600 disabled:opacity-50"
      >
        Withdraw
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("decline")}
          className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("accept")}
          className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Accept
        </button>
      </div>
      {peerUserId ? (
        confirmBlock ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-700/60">Block this member?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => void block()}
              className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
            >
              Confirm block
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmBlock(false)}
              className="text-xs font-semibold text-ink-700/50 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmBlock(true)}
            className="text-xs font-semibold text-ink-700/40 hover:text-rose-600 disabled:opacity-50"
          >
            Block
          </button>
        )
      ) : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
