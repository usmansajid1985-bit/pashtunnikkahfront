"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RematchButton({ profileCode }: { profileCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function requestRematch() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileCode, rematch: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not request rematch");
        return;
      }
      router.push(`/requests?tab=sent`);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={requestRematch}
        className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Rematch"}
      </button>
      {error ? <span className="text-[10px] text-rose-700 max-w-[140px] text-right">{error}</span> : null}
    </span>
  );
}
