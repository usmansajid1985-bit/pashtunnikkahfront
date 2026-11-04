import type { GoldFeature } from "@/components/settings/membership-icons";
import type { PlanSettings } from "@/lib/plan-settings";
import { getPlanSettings } from "@/lib/plan-settings";

export const GOLD_PRICE_LABEL = "£9.99";

/** The Gold benefits list — one source for the Membership page and the app-wide upgrade popup. */
export function goldFeatures(gold: PlanSettings): GoldFeature[] {
  return [
    { icon: "tokens", title: `${gold.monthlyCredits} Match Tokens monthly`, detail: "Send more Match Requests every month." },
    { icon: "filters", title: "Advanced browse filters", detail: "Be more specific in your search." },
    { icon: "insights", title: "Match Insights", detail: "Explore shared values, potential differences and questions worth discussing." },
    { icon: "eye", title: "See who viewed your profile", detail: "See who has viewed your profile." },
  ];
}

export async function goldOffer() {
  const gold = await getPlanSettings("gold");
  return { priceLabel: GOLD_PRICE_LABEL, features: goldFeatures(gold) };
}
