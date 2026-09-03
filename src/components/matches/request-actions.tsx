"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RequestActions({
  requestId,
  mode,
}: {
  requestId: string;
  mode: "incoming" | "sent";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
