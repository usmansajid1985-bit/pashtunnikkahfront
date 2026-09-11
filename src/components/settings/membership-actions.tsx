"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TOPUP_CREDITS, TOPUP_AMOUNT_PENCE } from "@/lib/stripe-constants";

export function MembershipActions({
  isGold,
  activeSubscription,
  credits,
  topupConfigured = true,
}: {
  isGold: boolean;
  activeSubscription: boolean;
  credits: number;
  /** false when no Stripe price is resolvable for the top-up right now — show the CTA disabled
   * instead of letting it fail at checkout (PN-SETTINGS-006). */
  topupConfigured?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = search.get("session_id");
    const success = search.get("success");
    const topup = search.get("topup");
    if ((success === "1" || topup === "1") && sessionId) {
      startTransition(async () => {
        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not confirm payment");
          return;
        }
        setMessage(
          data.type === "topup"
            ? `${TOPUP_CREDITS} Match Requests added to your account.`
            : "Welcome to Gold — your membership is active."
        );
        router.replace("/settings/membership");
        router.refresh();
      });
    } else if (search.get("canceled") === "1") {
      setMessage("Checkout canceled — no charge was made.");
    }
  }, [search, router]);

  async function upgrade() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Checkout failed");
        return;
      }
      window.location.href = data.url;
    });
  }

  async function buyTopup() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/stripe/topup", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Checkout failed");
        return;
      }
      window.location.href = data.url;
    });
  }

  async function manage() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not open billing portal");
        return;
      }
      window.location.href = data.url;
    });
  }

  const topupLabel = `Buy ${TOPUP_CREDITS} Match Requests — £${(TOPUP_AMOUNT_PENCE / 100).toFixed(2)}`;

  return (
    <div className="space-y-3">
      {credits <= 1 ? (
        <p className="text-sm rounded-xl bg-amber-50 text-amber-900 px-3 py-2 border border-amber-100">
          Running low on Match Requests ({credits} left). Top up or wait for your monthly allowance.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2">{message}</p>
      ) : null}
      {error ? <p className="text-sm rounded-xl bg-rose-50 text-rose-700 px-3 py-2">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {isGold && activeSubscription ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void manage()}
            className="px-5 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Opening…" : "Manage subscription"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void upgrade()}
            className="px-5 py-2.5 rounded-full bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? "Redirecting…" : "Upgrade to Gold — $10/mo"}
          </button>
        )}
        <button
          type="button"
          disabled={pending || !topupConfigured}
          title={topupConfigured ? undefined : "Top-ups are temporarily unavailable"}
          onClick={() => void buyTopup()}
          className="px-5 py-2.5 rounded-full border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Redirecting…" : topupConfigured ? topupLabel : "Top-ups temporarily unavailable"}
        </button>
      </div>
      <p className="text-[11px] text-ink-700/50">
        Stripe test mode. Use card <span className="font-mono">4242 4242 4242 4242</span>, any future
        expiry, any CVC.
      </p>
    </div>
  );
}
