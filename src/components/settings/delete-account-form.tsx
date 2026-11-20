"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { DELETION_GRACE_DAYS, DELETION_REASONS, type DeletionReasonCode } from "@/lib/account-deletion-shared";

const PINK = "#e12d72";

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** The account deletion terms, shown in a sheet from the confirmation checkbox. */
function DeletionTermsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/35 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Account deletion terms"
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink-900/15 sm:hidden" />
        <div className="mt-2 flex items-start justify-between gap-3">
          <h3 className="text-[19px] font-bold text-ink-950">Account deletion terms</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-700/60 hover:bg-ink-900/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[14px] leading-relaxed text-ink-700/85">
          <li>When you schedule deletion, your profile is hidden from all members straight away and you are signed out on this device.</li>
          <li>
            Your account stays closed for {DELETION_GRACE_DAYS} days. Logging in at any time during these {DELETION_GRACE_DAYS} days
            reactivates your account and cancels the deletion.
          </li>
          <li>
            After {DELETION_GRACE_DAYS} days, your account and its associated data — including your profile, photos, matches and
            conversations — are permanently deleted and cannot be recovered.
          </li>
          <li>We&apos;ll email you to confirm once your account has been deleted.</li>
        </ol>
        <button type="button" onClick={onClose} className="mt-5 h-12 w-full rounded-full bg-ink-900/[0.07] text-[15px] font-semibold text-ink-950 hover:bg-ink-900/10">
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

/**
 * N54 / Tweaks 6: reason for leaving (dropdown; "Other" asks for a few words), what happens next
 * (hidden now, deleted after 30 days unless they log in), and a terms confirmation checkbox. The
 * button stays dimmed until a reason is chosen and the box is ticked.
 */
export function DeleteAccountForm() {
  const [reason, setReason] = useState<DeletionReasonCode | "">("");
  const [other, setOther] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  // Computed on the device (today + 30 days), refreshed if the page stays open past midnight.
  const [deleteOn, setDeleteOn] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/account/delete")
      .then((r) => r.json())
      .then((d) => setScheduledFor(d.requested ? d.deleteOn : null))
      .catch(() => {});
    const calc = () => setDeleteOn(new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString());
    calc();
    const t = window.setInterval(calc, 60_000);
    return () => window.clearInterval(t);
  }, []);

  const otherOk = reason !== "other" || other.trim().length >= 3;
  const ready = Boolean(reason) && otherOk && agreed;

  if (scheduledFor) {
    return (
      <div className="rounded-2xl bg-[#f6f5f6] px-4 py-3.5 text-[14px] text-ink-900">
        Your account is closed and will be deleted on <strong>{longDate(scheduledFor)}</strong>. Log in again before then to
        reactivate it.
      </div>
    );
  }

  function submit() {
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, other, agreed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not close your account. Please try again.");
        return;
      }
      window.location.assign("/login?closed=1");
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="deletion-reason" className="block text-[16px] font-bold text-ink-950">
          Reason for leaving
        </label>
        <div className="relative mt-2.5">
          <select
            id="deletion-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as DeletionReasonCode | "");
              setError(null);
            }}
            className={`h-14 w-full appearance-none rounded-2xl border border-ink-900/15 bg-white pl-4 pr-11 text-[15px] outline-none transition focus:border-[#e12d72] ${
              reason ? "text-ink-950" : "text-ink-700/60"
            }`}
          >
            <option value="" disabled>
              Select a reason
            </option>
            {DELETION_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label.replace(/\.$/, "")}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-950" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {reason === "other" ? (
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value.slice(0, 400))}
            rows={3}
            autoFocus
            placeholder="Please tell us a little more…"
            className="mt-3 w-full rounded-2xl border border-ink-900/15 px-4 py-3 text-[14px] outline-none focus:border-[#e12d72]"
          />
        ) : null}
      </div>

      <div className="rounded-2xl bg-[#f6f5f6] px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100" style={{ color: PINK }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </span>
          <p className="text-[16px] font-bold text-ink-950">What happens next</p>
        </div>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-900">
          {[
            <>Your profile is hidden straight away and you&apos;ll be signed out.</>,
            <>
              Your account will be permanently deleted on <strong>{deleteOn ? longDate(deleteOn) : "…"}</strong> ({DELETION_GRACE_DAYS}{" "}
              days from today). We&apos;ll email you when it&apos;s done.
            </>,
            <>Changed your mind? Just log in before then and your account will be reactivated.</>,
          ].map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PINK }} aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="deletion-agree"
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-ink-900/30 accent-[#e12d72]"
        />
        <label htmlFor="deletion-agree" className="cursor-pointer text-[14px] leading-relaxed text-ink-900">
          I have read the{" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setTermsOpen(true);
            }}
            className="font-medium underline underline-offset-2"
          >
            account deletion terms
          </button>
          . I understand that after {DELETION_GRACE_DAYS} days, my account and associated data will be permanently deleted
          and cannot be recovered.
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-[13.5px] text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending || !ready}
        onClick={submit}
        className="h-14 w-full rounded-full text-[16px] font-semibold text-white transition disabled:cursor-not-allowed"
        style={{ background: ready ? PINK : "#f0b3c9" }}
      >
        {pending ? "Scheduling deletion…" : "Schedule account deletion"}
      </button>

      <DeletionTermsSheet open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
