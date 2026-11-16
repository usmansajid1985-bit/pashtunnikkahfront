"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * The one global success toast: a compact white rounded pill with a subtle grey border and shadow,
 * a soft green circled tick on the left, dark Poppins text, and a grey circled X on the right. It
 * slides down from the top, stays for `duration` ms, then calls `onClose`; it can be dismissed
 * manually. It never dims or blocks the page. Used for "Match request sent", "User blocked",
 * "Filters applied", "Profile updated", etc.
 */
export function SuccessToast({
  message,
  onClose,
  duration = 3000,
}: {
  message: string | null | undefined;
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
      <div
        className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ink-900/10 bg-white py-2.5 pl-2.5 pr-3 shadow-[0_12px_30px_-10px_rgba(15,13,14,0.3)] animate-[pnBannerIn_240ms_ease-out]"
        style={{ fontFamily: "var(--font-poppins), var(--font-inter), system-ui, sans-serif" }}
        role="status"
        aria-live="polite"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4 4 10-10" />
          </svg>
        </span>
        <span className="min-w-0 max-w-[70vw] truncate text-[14px] font-medium text-ink-950">{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-700/45 hover:bg-ink-900/5 hover:text-ink-900"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
