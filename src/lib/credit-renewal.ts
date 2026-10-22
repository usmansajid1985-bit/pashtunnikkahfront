import type { PlanSettings } from "@/lib/plan-settings";
import { ensureBasicAllowance } from "@/lib/tokens";

/** Basic members' monthly allowance — now a dated token lot (see lib/tokens). Returns the balance. */
export async function maybeRenewMonthlyCredits(userId: bigint): Promise<number | null> {
  return ensureBasicAllowance(userId);
}

export function creditsLowWarning(balance: number, settings: PlanSettings) {
  return balance <= 1 && settings.plan === "free";
}
