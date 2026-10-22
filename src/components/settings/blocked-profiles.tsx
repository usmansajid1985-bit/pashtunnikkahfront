"use client";

import { useState, useTransition } from "react";

export type BlockedProfileRow = {
  id: string;
  peerUserId: string;
  code: string;
  blockedAt: string;
};

export function BlockedProfiles({ initial }: { initial: BlockedProfileRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  function unblock(peerUserId: string) {
    startTransition(async () => {
      const res = await fetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peerUserId }),
      });
      if (res.ok) setRows((prev) => prev.filter((r) => r.peerUserId !== peerUserId));
    });
  }

  if (rows.length === 0) {
    return <p className="mt-2 text-sm text-ink-700/55">You have not blocked anyone.</p>;
  }

  return (
    <ul className={`mt-3 space-y-2 text-sm ${pending ? "opacity-60" : ""}`}>
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="font-semibold text-ink-950">{r.code}</span>{" "}
            <span className="text-[13px] text-ink-700/55">
              Blocked on{" "}
              {new Date(r.blockedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => unblock(r.peerUserId)}
            className="shrink-0 rounded-full border border-ink-900/15 px-4 py-1.5 text-[13px] font-semibold text-ink-950 hover:border-ink-900/30 disabled:opacity-50"
          >
            Unblock
          </button>
        </li>
      ))}
    </ul>
  );
}
