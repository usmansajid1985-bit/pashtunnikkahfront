"use client";

import Link from "next/link";

export function PaymentGraceBanner({
  graceUntil,
  compact = false,
}: {
  graceUntil: string | null;
  compact?: boolean;
}) {
  if (!graceUntil) return null;
  const until = new Date(graceUntil);
  if (until.getTime() <= Date.now()) return null;

  return (
    <div
      className={`rounded-2xl border border-rose-200 bg-rose-50/90 ${
        compact ? "px-3 py-2.5" : "px-4 py-3"
      }`}
    >
      <p className={`${compact ? "text-[13px]" : "text-sm"} text-ink-900 leading-snug`}>
        <span className="font-semibold">Payment failed</span> — update your card to keep Gold. Grace
        period until {until.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
      </p>
      <Link
        href="/settings/membership"
        className="inline-block mt-2 text-xs font-semibold text-rose-700 hover:underline"
      >
        Update payment method →
      </Link>
    </div>
  );
}
