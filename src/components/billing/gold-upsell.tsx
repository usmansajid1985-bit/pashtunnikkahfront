"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GoldFeatureIcon, type GoldFeature } from "@/components/settings/membership-icons";

/**
 * The one "Upgrade to Gold" popup, shown app-wide: when Match Tokens run out, when a Basic member
 * taps a Gold filter or any other Gold-only feature, and from the Membership page. "Upgrade to Gold"
 * goes straight to Stripe Checkout (no extra screen). Open it from anywhere with openGoldUpsell().
 */

export type GoldUpsellReason = "upgrade" | "out_of_tokens" | "gold_filter" | "profile_views" | "saved_limit" | "gold_feature";

const HEADINGS: Record<GoldUpsellReason, { kicker?: string; subtitle: string }> = {
  upgrade: { subtitle: "Unlock more ways to continue your search for marriage." },
  out_of_tokens: {
    kicker: "You've used all your Match Tokens",
    subtitle: "Get 10 Match Tokens every month with Gold, or top up to keep sending requests.",
  },
  gold_filter: { kicker: "Advanced filters are a Gold feature", subtitle: "Search by distance, tribe, faith, education and more." },
  profile_views: { kicker: "See who viewed your profile", subtitle: "Gold members see everyone who's been looking." },
  saved_limit: { kicker: "You've reached the saved-profiles limit", subtitle: "Save as many profiles as you like with Gold." },
  gold_feature: { kicker: "That's a Gold feature", subtitle: "Unlock more ways to continue your search for marriage." },
};

const OPEN_EVENT = "pn:gold-upsell";

/** Open the Upgrade to Gold popup from anywhere in the app. */
export function openGoldUpsell(reason: GoldUpsellReason = "upgrade") {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { reason } }));
}

type Offer = {
  priceLabel: string;
  features: GoldFeature[];
  isGold: boolean;
  /** Gold members only — Basic members can't buy top-ups. */
  topup: { tokens: number; priceLabel: string } | null;
};

/** Mounted once in the root layout; renders the popup when something asks for it. */
export function GoldUpsellHost() {
  const [reason, setReason] = useState<GoldUpsellReason | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const loading = useRef(false);

  useEffect(() => {
    const onOpen = async (e: Event) => {
      const r = ((e as CustomEvent<{ reason?: GoldUpsellReason }>).detail?.reason || "upgrade") as GoldUpsellReason;
      setError(null);
      let o = offer;
      if (!o && !loading.current) {
        loading.current = true;
        const res = await fetch("/api/billing/gold-offer", { cache: "no-store" }).catch(() => null);
        loading.current = false;
        if (!res?.ok) {
          window.location.href = "/settings/membership";
          return;
        }
        o = (await res.json()) as Offer;
        setOffer(o);
      }
      // Gold already (e.g. out of tokens): nothing to upgrade — go to Membership & Billing to top up.
      if (o?.isGold) {
        window.location.href = "/settings/membership";
        return;
      }
      setReason(r);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [offer]);

  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReason(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reason]);

  if (!reason || !offer) return null;

  const go = (endpoint: string) =>
    startTransition(async () => {
      setError(null);
      const res = await fetch(endpoint, { method: "POST" }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok || !data.url) {
        setError(data.error || "Couldn't open checkout — please try again.");
        return;
      }
      window.location.href = data.url;
    });

  return (
    <UpgradeModal
      priceLabel={offer.priceLabel}
      features={offer.features}
      pending={pending}
      reason={reason}
      topup={offer.topup}
      error={error}
      onUpgrade={() => go("/api/stripe/checkout")}
      onTopup={() => go("/api/stripe/topup")}
      onClose={() => setReason(null)}
    />
  );
}

export function UpgradeModal({
  priceLabel,
  features,
  pending,
  onUpgrade,
  onClose,
  reason = "upgrade",
  topup,
  onTopup,
  error,
}: {
  priceLabel: string;
  features: GoldFeature[];
  pending: boolean;
  onUpgrade: () => void;
  onClose: () => void;
  /** Why it opened — changes the headline; "out_of_tokens" also offers a top-up. */
  reason?: GoldUpsellReason;
  topup?: { tokens: number; priceLabel: string } | null;
  onTopup?: () => void;
  error?: string | null;
}) {
  const heading = HEADINGS[reason] ?? HEADINGS.upgrade;
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
            {heading.kicker ? (
              <p className="mb-1 text-[13px] font-semibold text-[#e12d72]">{heading.kicker}</p>
            ) : null}
            <h2 id="upgrade-gold-title" className="text-[28px] font-bold leading-tight text-ink-950">
              Upgrade to <span className="text-[#e12d72]">Gold</span>
            </h2>
            <p className="mt-1.5 text-[15px] text-ink-700/65">{heading.subtitle}</p>
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
        {reason === "out_of_tokens" && topup && onTopup ? (
          <button
            type="button"
            disabled={pending}
            onClick={onTopup}
            className="mt-2.5 w-full h-12 rounded-full border-2 border-[#e12d72]/70 bg-white text-[14px] font-semibold text-[#c2185b] hover:bg-rose-50 disabled:opacity-60"
          >
            Or buy {topup.tokens} Match Tokens — {topup.priceLabel}
          </button>
        ) : null}
        {error ? <p className="mt-2 text-center text-sm text-rose-700">{error}</p> : null}
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
