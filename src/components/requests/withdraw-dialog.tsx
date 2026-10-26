"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Withdraw request?" — opened from the ⋮ menu on a sent request. Nothing is withdrawn until the
 * member presses Withdraw request; Keep request, Escape or tapping outside just closes it.
 */
export function WithdrawDialog({
  open,
  code,
  busy,
  onKeep,
  onWithdraw,
}: {
  open: boolean;
  code: string;
  busy: boolean;
  onKeep: () => void;
  onWithdraw: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onKeep();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onKeep]);

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/35 backdrop-blur-[3px] px-5"
      onClick={onKeep}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[340px] rounded-[22px] bg-white px-5 pt-6 pb-5 text-center shadow-[0_24px_60px_-20px_rgba(15,13,14,0.45)]"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
          </svg>
        </span>
        <h2 id="withdraw-title" className="mt-3 text-[18px] font-bold text-ink-950">
          Withdraw request?
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-700/80">
          Are you sure you want to withdraw your request to {code}? If they have not accepted it yet, 1 token will be
          returned to your account.
        </p>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-700/55">
          If the request has already been accepted, it can no longer be withdrawn.
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 h-11 rounded-full border border-ink-900/15 text-[14px] font-semibold text-ink-900 hover:border-ink-900/30"
          >
            Keep request
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onWithdraw}
            className="flex-1 h-11 rounded-full bg-[#e12d72] text-[14px] font-semibold text-white hover:bg-[#c41d5e] disabled:opacity-60"
          >
            {busy ? "Withdrawing…" : "Withdraw request"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
