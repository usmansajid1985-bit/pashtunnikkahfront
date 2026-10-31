"use client";

import { useEffect, useState } from "react";

/**
 * Shared saved ("My saves") count. The number is shown in one component (the Browse "My saves"
 * pill, the saved list heading) while profiles are saved/removed in a sibling component (the Browse
 * grid, the saved grid). This tiny bus lets a save/removal nudge the count live — PN-AUD-005, where
 * the counter sat at its server value until a refresh.
 */
const listeners = new Set<(delta: number) => void>();

/** Call after a confirmed save (+1) or removal (-1). */
export function emitSavedChange(delta: number) {
  listeners.forEach((l) => l(delta));
}

function onSavedChange(cb: (delta: number) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The live saved count: starts from the server value, re-syncs to it on navigation, and applies
 * ±1 deltas from `emitSavedChange` without a refresh. */
export function useLiveSavedCount(serverCount: number): number {
  const [count, setCount] = useState(serverCount);
  // A fresh server value (route change / refresh) is authoritative.
  useEffect(() => setCount(serverCount), [serverCount]);
  useEffect(() => onSavedChange((delta) => setCount((c) => Math.max(0, c + delta))), []);
  return count;
}

/** The rounded count badge on the saved list heading. */
export function SavedCountBadge({ initial }: { initial: number }) {
  const count = useLiveSavedCount(initial);
  return (
    <span className="min-w-[1.75rem] h-7 px-2 rounded-full bg-rose-50 text-rose-600 text-sm font-semibold flex items-center justify-center tabular-nums">
      {count}
    </span>
  );
}
