"use client";

import { useState, useTransition } from "react";

export function EmailVerificationBanner({
  emailVerified,
  compact = false,
}: {
  emailVerified: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  if (emailVerified) return null;

  function resend() {
    startTransition(async () => {
      setMessage(null);
      setDevUrl(null);
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Could not send email.");
        return;
      }
      setMessage(data.message || "Verification email sent.");
      if (data.devVerifyUrl) setDevUrl(data.devVerifyUrl);
    });
  }

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50/80 ${
        compact ? "px-3 py-2.5" : "px-4 py-3"
      }`}
    >
      <p className={`${compact ? "text-[13px]" : "text-sm"} text-ink-900 leading-snug`}>
        <span className="font-semibold">Verify your email</span> to send match introductions.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void resend()}
          className="px-3 py-1.5 rounded-full bg-amber-700 text-white text-xs font-semibold disabled:opacity-60"
        >
          {pending ? "Sending…" : "Resend verification email"}
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-ink-700/70">{message}</p> : null}
      {devUrl ? (
        <p className="mt-1 text-[11px] break-all text-ink-700/55">
          Dev link:{" "}
          <a href={devUrl} className="text-rose-600 underline">
            {devUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}
