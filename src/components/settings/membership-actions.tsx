"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TOPUP_CREDITS, TOPUP_AMOUNT_PENCE } from "@/lib/stripe-constants";
import { GoldFeatureIcon, type GoldFeature } from "@/components/settings/membership-icons";

export function MembershipActions({
  isGold,
  activeSubscription,
  credits,
  topupConfigured = true,
  priceLabel,
  features,
}: {
  isGold: boolean;
  activeSubscription: boolean;
  credits: number;
  /** false when no Stripe price is resolvable for the top-up right now — show the CTA disabled
   * instead of letting it fail at checkout (PN-SETTINGS-006). */
  topupConfigured?: boolean;
  priceLabel: string;
  features: GoldFeature[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
            ? `${TOPUP_CREDITS} Match Tokens added to your account.`
            : "Welcome to Gold — your membership is active."
        );
        router.replace("/settings/membership");
        router.refresh();
      });
    } else if (search.get("canceled") === "1") {
      setMessage("Checkout canceled — no charge was made.");
    } else if (search.get("upgrade") === "1" && !isGold) {
      setModalOpen(true);
    }
  }, [search, router, isGold]);

  async function upgrade() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Checkout failed");
        setModalOpen(false);
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

  const topupLabel = `Buy ${TOPUP_CREDITS} Match Tokens — £${(TOPUP_AMOUNT_PENCE / 100).toFixed(2)}`;

  return (
    <div className="space-y-2.5">
      {credits <= 1 ? (
        <p className="text-sm rounded-xl bg-amber-50 text-amber-900 px-3 py-2 border border-amber-100">
          Running low on Match Tokens ({credits} left). Top up or wait for your monthly allowance.
        </p>
      ) : null}
      {message ? (
        <p className="text-sm rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2">{message}</p>
      ) : null}
      {error ? <p className="text-sm rounded-xl bg-rose-50 text-rose-700 px-3 py-2">{error}</p> : null}

      {isGold && activeSubscription ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void manage()}
          className="w-full h-12 rounded-full border border-ink-900/12 bg-white text-[15px] font-semibold text-ink-950 hover:bg-ink-900/[0.03] disabled:opacity-60"
        >
          {pending ? "Opening…" : "Manage subscription"}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void upgrade()}
          className="w-full h-12 rounded-full bg-gradient-to-r from-[#c2185b] via-[#ec407a] to-[#ffb74d] text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(225,45,114,0.8)] hover:brightness-105 disabled:opacity-60"
        >
          {pending ? "Redirecting…" : "Upgrade to Gold →"}
        </button>
      )}
      <button
        type="button"
        disabled={pending || !topupConfigured}
        title={topupConfigured ? undefined : "Top-ups are temporarily unavailable"}
        onClick={() => void buyTopup()}
        className="w-full h-12 rounded-full border-2 border-[#e12d72]/70 bg-white text-[14px] font-semibold text-[#c2185b] hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "Redirecting…" : topupConfigured ? topupLabel : "Top-ups temporarily unavailable"}
      </button>

      {modalOpen ? (
        <UpgradeModal
          priceLabel={priceLabel}
          features={features}
          pending={pending}
          onUpgrade={() => void upgrade()}
          onClose={() => {
            setModalOpen(false);
            router.replace("/settings/membership");
          }}
        />
      ) : null}
    </div>
  );
}

function UpgradeModal({
  priceLabel,
  features,
  pending,
  onUpgrade,
  onClose,
}: {
  priceLabel: string;
  features: GoldFeature[];
  pending: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const monthly = features.find((f) => f.icon === "tokens");
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-ink-950/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-gold-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="upgrade-gold-title" className="text-[28px] font-bold leading-tight text-ink-950">
              Upgrade to <span className="text-[#e12d72]">Gold</span>
            </h2>
            <p className="mt-1.5 text-[15px] text-ink-700/65">Unlock more ways to continue your search for marriage.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 h-10 w-10 rounded-full border border-ink-900/12 flex items-center justify-center text-ink-700 hover:bg-ink-900/5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="relative mt-7 rounded-2xl border border-[#e12d72]/40 bg-gradient-to-br from-[#fbcfe0] via-[#fde2e4] to-[#fde9b8] p-5">
          <span className="absolute -top-3.5 left-4 inline-flex items-center gap-1.5 rounded-full bg-[#e12d72] px-3 py-1 text-xs font-semibold text-white shadow">
            ✦ Most popular
          </span>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[28px] font-bold text-ink-950">Gold</p>
              {monthly ? (
                <p className="mt-1 flex items-center gap-2 text-[14px] text-ink-900">
                  <GoldFeatureIcon icon="tokens" className="h-4 w-4 text-[#e12d72]" />
                  {monthly.title}
                </p>
              ) : null}
              <p className="mt-1 flex items-center gap-2 text-[14px] text-ink-700/70">
                <GoldFeatureIcon icon="calendar" className="h-4 w-4 text-[#e12d72]" />
                Cancel anytime
              </p>
            </div>
            <div className="text-right border-l border-[#e12d72]/25 pl-4">
              <p className="text-[26px] font-bold text-ink-950">{priceLabel}</p>
              <p className="text-sm text-ink-700/60">/ month</p>
            </div>
          </div>
        </div>

        <h3 className="mt-6 text-lg font-bold text-ink-950">What&apos;s included</h3>
        <ul className="mt-3 space-y-2.5">
          {features.map((f) => (
            <li key={f.title} className="flex items-center gap-3 text-[15px] text-ink-900">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]">
                <GoldFeatureIcon icon={f.icon} className="h-[18px] w-[18px]" />
              </span>
              {f.title}
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={pending}
          onClick={onUpgrade}
          className="mt-6 w-full h-14 rounded-full bg-gradient-to-r from-[#c2185b] via-[#ec407a] to-[#ffb74d] text-[17px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(225,45,114,0.8)] hover:brightness-105 disabled:opacity-60"
        >
          {pending ? "Redirecting…" : "Upgrade to Gold →"}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-ink-700/60">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Secure monthly subscription · Cancel anytime.
        </p>
      </div>
    </div>
  );
}
