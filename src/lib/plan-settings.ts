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
  if (!row) return DEFAULTS[key];
  return {
    plan: key,
    monthlyCredits: row.monthly_credits,
    rolloverCap: row.rollover_cap,
    maxBalance: row.max_balance,
    pendingRequestLimit: row.pending_request_limit,
    requestExpiryDays: row.request_expiry_days,
    savedProfileLimit: row.saved_profile_limit,
  };
}
