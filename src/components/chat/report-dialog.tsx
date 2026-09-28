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
  onDone: (ok: boolean) => void;
}) {
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setCategory("");
    setDetails("");
    setError(null);
    setBusy(false);
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
      onDone(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="report-title" className="font-bold text-ink-950">
          {target.message ? "Report message" : `Report ${target.code}`}
        </h2>
        <p className="mt-1 text-[13px] text-ink-700/70">
          Reports go privately to the Pashtun Nikah team. {target.code} won&apos;t be told who reported them.
        </p>

        {target.message ? (
          <blockquote className="mt-3 rounded-xl border-l-[3px] border-rose-300 bg-rose-50/60 px-3 py-2 text-[13px] text-ink-800 line-clamp-3">
            {target.message.body}
          </blockquote>
        ) : null}

        <label className="mt-4 block text-xs font-semibold text-ink-900" htmlFor="report-reason">
          Reason
        </label>
        <select
          id="report-reason"
          className="field mt-1.5"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Choose a reason…</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-xs font-semibold text-ink-900" htmlFor="report-details">
          What happened?
        </label>
        <textarea
          id="report-details"
          className="field mt-1.5 min-h-[96px] resize-y"
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Tell us briefly what happened so the team can review it."
        />
        <p className={`mt-1 text-[11px] ${detailsOk || !details ? "text-ink-700/50" : "text-rose-600"}`}>
          {detailsOk ? `${details.trim().length}/1000` : `At least ${REPORT_DETAILS_MIN} characters`}
        </p>

        {error ? <p className="mt-2 text-[13px] text-rose-600">{error}</p> : null}

        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-full border border-ink-900/12 text-sm font-semibold text-ink-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-45"
          >
            {busy ? "Sending…" : "Send report"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
