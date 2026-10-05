/** A02: the reasons a member can pick when reporting a message or member (client + server). */
export const REPORT_REASONS = [
  { value: "inappropriate_messages", label: "Inappropriate messages or behaviour" },
  { value: "harassment", label: "Harassment, abuse or threats" },
  { value: "fake_profile", label: "Fake profile or impersonation" },
  { value: "not_seeking_marriage", label: "Not genuinely seeking marriage" },
  { value: "inappropriate_photos", label: "Inappropriate photos or content" },
  { value: "scam", label: "Scam, fraud or requesting money" },
  { value: "spam", label: "Spam or unsolicited promotion" },
  { value: "not_pashtun", label: "Not Pashtun / false ethnicity claim" },
  { value: "other", label: "Other" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_DETAILS_MIN = 10;
export const REPORT_DETAILS_MAX = 1000;

export function reportReasonLabel(value: string | null | undefined) {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? null;
}
