"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { REPORT_DETAILS_MIN, REPORT_REASONS } from "@/lib/report-reasons";

export type ReportTarget = {
  userId: string;
  code: string;
  requestId?: string | null;
  /** Set when a specific message is being reported. */
  message?: { id: string; body: string } | null;
};

/** A02: report popup — reason from the agreed list + required details, then sent to the PN team. */
export function ReportDialog({
  target,
  onClose,
  onDone,
}: {
  target: ReportTarget | null;
  onClose: () => void;
  /** `alsoBlock` — the reporter ticked "Also block this member". */
  onDone: (ok: boolean, alsoBlock: boolean) => void;
}) {
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setCategory("");
    setDetails("");
    setError(null);
    setBusy(false);
    // Reporting the member (3-dot menu) blocks them too unless unticked; a single reported
    // message doesn't end the conversation by default.
    setAlsoBlock(!target.message);
  }, [target]);

  if (!target || typeof document === "undefined") return null;

  const detailsOk = details.trim().length >= REPORT_DETAILS_MIN;
  const canSubmit = Boolean(category) && detailsOk && !busy;

  async function submit() {
    if (!target || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: target.userId,
          category,
          details: details.trim(),
          requestId: target.requestId ?? null,
          messageId: target.message?.id && !target.message.id.startsWith("c_") ? target.message.id : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send the report. Please try again.");
        return;
      }
      onDone(true, alsoBlock);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink-950/35 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-700/70 hover:bg-ink-900/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4 3 19.5h18L12 4Z" />
            <path d="M12 10v4.5M12 17.2v.3" />
          </svg>
        </span>
        <h2 id="report-title" className="mt-3 text-center text-xl font-bold text-ink-950">
          {target.message ? "Report this message?" : `Report ${target.code}?`}
        </h2>
        <p className="mt-1.5 text-center text-sm text-ink-700/70">
          Our team will review your report and take appropriate action. {target.code} won&apos;t be told who
          reported them.
        </p>

        {target.message ? (
          <blockquote className="mt-3 rounded-xl border-l-[3px] border-rose-300 bg-rose-50/60 px-3 py-2 text-[13px] text-ink-800 line-clamp-3">
            {target.message.body}
          </blockquote>
        ) : null}

        <label className="sr-only" htmlFor="report-reason">
          Reason
        </label>
        <select
          id="report-reason"
          className="field mt-4"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select a reason</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="report-details">
          What happened? (required)
        </label>
        <textarea
          id="report-details"
          className="field mt-3 min-h-[96px] resize-y"
          maxLength={1000}
          required
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Tell us what happened (required)"
        />
        <p className={`mt-1 text-[11px] ${detailsOk || !details ? "text-ink-700/50" : "text-rose-600"}`}>
          {detailsOk ? `${details.trim().length}/1000` : `At least ${REPORT_DETAILS_MIN} characters`}
        </p>

        <label className="mt-3 flex items-start gap-2.5 text-sm text-ink-900">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-rose-600"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
          />
          <span>
            Also block {target.code}
            <span className="block text-[12px] text-ink-700/60">
              This ends the conversation and they can no longer contact you.
            </span>
          </span>
        </label>

        <p className="mt-3 flex items-start gap-2 text-[12px] text-ink-700/65">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-px shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.2" strokeLinecap="round" />
          </svg>
          Intentional false reports may result in your account being terminated.
        </p>

        {error ? <p className="mt-2 text-[13px] text-rose-600">{error}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="py-2.5 rounded-xl bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-45"
          >
            {busy ? "Sending…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
