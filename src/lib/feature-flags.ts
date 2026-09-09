/** Env-based feature flags for gradual rollout. */
export function featureEnabled(name: string): boolean {
  const key = `FEATURE_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const val = process.env[key];
  if (val === "0" || val === "false") return false;
  return true;
}

export const features = {
  aiMatching: () => featureEnabled("AI_MATCHING"),
  rematch: () => featureEnabled("REMATCH"),
  filterPresets: () => featureEnabled("FILTER_PRESETS"),
  privateBrowsing: () => featureEnabled("PRIVATE_BROWSING"),
  /** Backup activity emails (match request / accepted / message). Opt-in — off unless "1". */
  notificationEmails: () => process.env.NOTIFICATION_ACTIVITY_EMAILS === "1",
} as const;
