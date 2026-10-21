"use client";

import { useEffect, useState } from "react";

/** N54: shown once after logging back in within 30 days of closing the account. */
export function ReactivatedNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reactivated") === "1") {
      setShow(true);
      url.searchParams.delete("reactivated");
      window.history.replaceState(null, "", url);
    }
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <span aria-hidden className="text-xl leading-none">🎉</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-emerald-900">Welcome back — your account has been reactivated</p>
        <p className="text-[13px] text-emerald-800/80">It won&apos;t be deleted, and your profile is visible in Browse again.</p>
      </div>
      <button type="button" onClick={() => setShow(false)} className="text-emerald-800/60 hover:text-emerald-900" aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
