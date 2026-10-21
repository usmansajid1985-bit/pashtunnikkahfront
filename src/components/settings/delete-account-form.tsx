"use client";

import { useEffect, useState, useTransition } from "react";
import { DELETION_GRACE_DAYS, DELETION_REASONS, type DeletionReasonCode } from "@/lib/account-deletion-shared";

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * N54: why they're leaving (one of eight reasons; "Other" asks for a few words), what happens
 * next (hidden now, deleted after 30 days unless they log in), and a typed DELETE confirmation.
 */
export function DeleteAccountForm() {
  const [reason, setReason] = useState<DeletionReasonCode | "">("");
  const [other, setOther] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/account/delete")
      .then((r) => r.json())
      .then((d) => setScheduledFor(d.requested ? d.deleteOn : null))
      .catch(() => {});
  }, []);

  const deleteOn = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const otherOk = reason !== "other" || other.trim().length >= 3;
  const ready = Boolean(reason) && otherOk && confirm === "DELETE";

  if (scheduledFor) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        Your account is closed and will be deleted on <strong>{longDate(scheduledFor)}</strong>. Log in again before
        then to reactivate it.
      </div>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, other, confirm }),
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
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-bold text-ink-950">Why are you leaving?</legend>
        <p className="text-xs text-ink-700/60 mt-0.5">Your answer helps us improve Pashtun Nikah.</p>
        <div className="mt-3 space-y-2">
          {DELETION_REASONS.map((r) => (
            <label
              key={r.code}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer transition ${
                reason === r.code ? "border-rose-300 bg-rose-50/60" : "border-ink-900/10 bg-white hover:border-ink-900/20"
              }`}
            >
              <input
                type="radio"
                name="deletion-reason"
                value={r.code}
                checked={reason === r.code}
                onChange={() => setReason(r.code)}
                className="mt-0.5 accent-rose-600"
              />
              <span className="text-[14px] text-ink-900">{r.label}</span>
            </label>
          ))}
        </div>
        {reason === "other" ? (
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value.slice(0, 400))}
            rows={3}
            autoFocus
            placeholder="Please tell us a little more…"
            className="mt-3 w-full rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
          />
        ) : null}
      </fieldset>

      <div className="rounded-xl bg-ink-900/[0.03] border border-ink-900/8 px-4 py-3.5 text-[13.5px] text-ink-700/80 space-y-1.5">
        <p className="font-semibold text-ink-950">What happens next</p>
        <p>• Your profile is hidden straight away and you&apos;ll be signed out.</p>
        <p>
          • Your account will be permanently deleted on <strong>{longDate(deleteOn)}</strong> ({DELETION_GRACE_DAYS} days
          from today). We&apos;ll email you when it&apos;s done.
        </p>
        <p>• Changed your mind? Just log in before then and your account will be reactivated.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="delete-confirm" className="block text-sm font-semibold text-ink-950">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          className="w-full rounded-xl border border-ink-900/10 px-3 py-2.5 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending || !ready}
        onClick={submit}
        className="w-full sm:w-auto px-6 py-3 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-40"
      >
        {pending ? "Closing your account…" : "Close my account"}
      </button>
    </div>
  );
}
