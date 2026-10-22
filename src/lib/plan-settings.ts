import { prisma } from "@/lib/prisma";

export type PlanSettings = {
  plan: "free" | "gold";
  monthlyCredits: number;
  rolloverCap: number;
  maxBalance: number;
  pendingRequestLimit: number;
  requestExpiryDays: number;
  savedProfileLimit: number | null;
};

const DEFAULTS: Record<"free" | "gold", PlanSettings> = {
  free: {
    plan: "free",
    monthlyCredits: 3,
    rolloverCap: 0,
    maxBalance: 3,
    pendingRequestLimit: 3,
    requestExpiryDays: 7,
    savedProfileLimit: 3,
  },
  gold: {
    plan: "gold",
    monthlyCredits: 10,
    rolloverCap: 3,
    maxBalance: 13,
    pendingRequestLimit: 5,
    requestExpiryDays: 7,
    savedProfileLimit: null,
  },
};

function planKey(plan: string | null | undefined): "free" | "gold" {
  return (plan || "").toLowerCase() === "gold" ? "gold" : "free";
}

/** Admin-configurable plan limits, with hardcoded fallbacks if the settings row is ever missing. */
export async function getPlanSettings(plan: string | null | undefined): Promise<PlanSettings> {
  const key = planKey(plan);
  const row = await prisma.plan_settings.findUnique({ where: { plan: key } });
  const base: PlanSettings = !row
    ? DEFAULTS[key]
    : {
        plan: key,
        monthlyCredits: row.monthly_credits,
        rolloverCap: row.rollover_cap,
        maxBalance: row.max_balance,
        pendingRequestLimit: row.pending_request_limit,
        requestExpiryDays: row.request_expiry_days,
        savedProfileLimit: row.saved_profile_limit,
      };
  // Token allowances and rollover live in token_settings (Admin → Billing); plan_settings keeps
  // the other limits. Overlay so every reader — copy, gates, the engine — agrees.
  try {
    const { getTokenSettings } = await import("@/lib/tokens");
    const t = await getTokenSettings();
    if (key === "gold") {
      base.monthlyCredits = t.goldMonthly;
      base.rolloverCap = t.rolloverEnabled ? Math.min(t.rolloverMax, Math.max(0, t.goldMaxTotal - t.goldMonthly)) : 0;
      base.maxBalance = t.goldMaxTotal;
    } else {
      base.monthlyCredits = t.basicMonthly;
      base.rolloverCap = 0;
      base.maxBalance = t.basicMonthly;
    }
  } catch {
    // token_settings unavailable — fall back to plan_settings
  }
  return base;
}
