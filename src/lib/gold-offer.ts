import type { GoldFeature } from "@/components/settings/membership-icons";
import type { PlanSettings } from "@/lib/plan-settings";
import { getPlanSettings } from "@/lib/plan-settings";

export const GOLD_PRICE_LABEL = "£9.99";

/** The Gold benefits list — one source for the Membership page and the app-wide upgrade popup. */
export function goldFeatures(gold: PlanSettings): GoldFeature[] {
  return [
    { icon: "tokens", title: `${gold.monthlyCredits} Match Tokens monthly`, detail: "Send more Match Requests every month." },
    { icon: "filters", title: "Advanced browse filters", detail: "Be more specific in your search." },
    { icon: "insights", title: "AI Match Insights", detail: "See your compatibility and shared values." },
    ...(gold.rolloverCap > 0
      ? [
          {
            icon: "rollover" as const,
            title: `Up to ${gold.rolloverCap} unused tokens roll over`,
            detail: "Don't lose unused Gold tokens (next month only).",
          },
        ]
      : []),
    { icon: "eye", title: "See who viewed your profile", detail: "Find out who's interested in you." },
  ];
}

export async function goldOffer() {
  const gold = await getPlanSettings("gold");
  return { priceLabel: GOLD_PRICE_LABEL, features: goldFeatures(gold) };
}
