/** A02: the reasons a member can pick when reporting a message or member (client + server). */
export const REPORT_REASONS = [
  { value: "inappropriate", label: "Inappropriate or sexual content" },
  { value: "harassment", label: "Harassment, threats or abusive language" },
  { value: "scam", label: "Asking for money or a possible scam" },
  { value: "contact_details", label: "Pushing to share contact details / move off PN" },
  { value: "fake_profile", label: "Fake profile or not who they say they are" },
  { value: "religious_disrespect", label: "Disrespectful about faith or family" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_DETAILS_MIN = 10;
export const REPORT_DETAILS_MAX = 1000;

export function reportReasonLabel(value: string | null | undefined) {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? null;
}
