"use client";

import { useEffect } from "react";

/** Remembers which greeting Overview just showed, so the next load shows the other one. */
export function GreetingMemo({ shown }: { shown: string }) {
  useEffect(() => {
    document.cookie = `pn_greeting=${shown}; path=/; max-age=31536000; samesite=lax`;
  }, [shown]);
  return null;
}
