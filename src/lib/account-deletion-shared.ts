/** N54: client-safe constants for closing an account (the server logic is in account-deletion.ts). */

export const DELETION_GRACE_DAYS = 30;

export const DELETION_REASONS = [
  { code: "married_pn", label: "I married someone from Pashtun Nikah." },
  { code: "found_elsewhere", label: "I found someone outside of Pashtun Nikah." },
  { code: "not_interested", label: "I'm not interested in marriage anymore." },
  { code: "no_matches", label: "I'm not getting any matches." },
  { code: "too_complicated", label: "The app is too complicated to use." },
  { code: "too_expensive", label: "The app is too expensive." },
  { code: "just_curious", label: "I was just curious about the app and wasn't looking for marriage." },
  { code: "other", label: "Other." },
] as const;

export type DeletionReasonCode = (typeof DELETION_REASONS)[number]["code"];
