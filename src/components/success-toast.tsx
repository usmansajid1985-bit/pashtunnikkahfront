"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Per-device opt-out, toggled in Settings → Notifications. */
export const SUCCESS_TOAST_OFF_KEY = "pn_success_toasts_off";

function successToastsDisabled() {
  try {
    return localStorage.getItem(SUCCESS_TOAST_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

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
  const [disabled, setDisabled] = useState(false);
  useEffect(() => {
    setDisabled(successToastsDisabled());
  }, [message]);

  // Slide back up before unmounting (both on the 3s timer and when dismissed by hand).
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [message]);
  const dismiss = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    if (!message || disabled) return;
    const t = setTimeout(dismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, dismiss, disabled]);

  if (!message || disabled || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex justify-center px-4">
      <div
        key={message}
        className={`pointer-events-auto flex items-center gap-3 rounded-full border border-ink-900/[0.07] bg-white py-2 pl-2.5 pr-2.5 shadow-[0_10px_28px_-10px_rgba(15,13,14,0.28)] ${
          leaving ? "animate-[pnToastOut_220ms_ease-in_forwards]" : "animate-[pnBannerIn_260ms_ease-out]"
        }`}
        style={{ fontFamily: "var(--font-poppins), var(--font-inter), system-ui, sans-serif" }}
        role="status"
        aria-live="polite"
      >
        {/* Soft green outlined circle + tick */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden className="shrink-0">
          <circle cx="14" cy="14" r="12" stroke="#22a35a" strokeWidth="2" />
          <path d="m8.8 14.3 3.4 3.4 7-7.2" stroke="#22a35a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 max-w-[70vw] truncate text-[15px] font-semibold text-ink-950">{message}</span>
        {/* Grey outlined circle + X */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="ml-1 shrink-0 rounded-full text-ink-700/45 transition hover:text-ink-900"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.8" />
            <path d="m10 10 8 8M18 10l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
