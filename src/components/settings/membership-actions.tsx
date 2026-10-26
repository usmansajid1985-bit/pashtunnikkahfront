"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TOPUP_CREDITS, TOPUP_AMOUNT_PENCE } from "@/lib/stripe-constants";
import { type GoldFeature } from "@/components/settings/membership-icons";
import { UpgradeModal } from "@/components/billing/gold-upsell";

export function MembershipActions({
  isGold,
  activeSubscription,
  topupConfigured = true,
  topupTokens = TOPUP_CREDITS,
  topupPricePence = TOPUP_AMOUNT_PENCE,
  priceLabel,
  features,
}: {
  isGold: boolean;
  activeSubscription: boolean;
  /** false when no Stripe price is resolvable for the top-up right now — show the CTA disabled
   * instead of letting it fail at checkout (PN-SETTINGS-006). */
  topupConfigured?: boolean;
  /** The pack on sale (Admin → Billing). */
  topupTokens?: number;
  topupPricePence?: number;
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
            ? `${topupTokens} Match Tokens added to your account.`
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

  const topupLabel = `Buy ${topupTokens} Match Tokens — £${(topupPricePence / 100).toFixed(2)}`;

  return (
    <div className="space-y-2.5">
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
      {/* Top-ups are Gold-only (the API refuses Basic accounts as well). */}
      {isGold ? (
        <button
          type="button"
          disabled={pending || !topupConfigured}
          title={topupConfigured ? undefined : "Top-ups are temporarily unavailable"}
          onClick={() => void buyTopup()}
          className="w-full h-12 rounded-full border-2 border-[#e12d72]/70 bg-white text-[14px] font-semibold text-[#c2185b] hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Redirecting…" : topupConfigured ? topupLabel : "Top-ups temporarily unavailable"}
        </button>
      ) : null}

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
