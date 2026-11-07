/**
 * Optional "Marriage Plans" — the two things a member most wants settled about married life:
 * their marriage timeframe and living arrangements. Lives in Profile (not mandatory onboarding).
 * (The older "Marriage Preferences" set also asked about location, children, work/study and
 * lifestyle, and tagged each Essential/Preferred/Flexible; those were dropped to keep this quick.
 * The stored shape keeps an `importance` field for backward compatibility with older saved data,
 * but it is no longer shown or editable — new saves default it to "preferred".)
 */

export const MARRIAGE_IMPORTANCE = ["essential", "preferred", "flexible"] as const;
export type MarriageImportance = (typeof MARRIAGE_IMPORTANCE)[number];

export type MarriagePrefItem = { value: string; importance: MarriageImportance };
export type MarriagePrefs = Record<string, MarriagePrefItem>;

export const IMPORTANCE_LABEL: Record<MarriageImportance, string> = {
  essential: "Essential",
  preferred: "Preferred",
  flexible: "Flexible",
};

export type MarriagePrefField = {
  key: string;
  label: string;
  /** Fixed choices, or null for free text. */
  options: readonly string[] | null;
  placeholder?: string;
};

export const MARRIAGE_PREF_FIELDS: readonly MarriagePrefField[] = [
  {
    key: "timeframe",
    label: "Marriage timeframe",
    options: ["Within 6 months", "Within a year", "1 to 2 years", "No fixed timeline"],
  },
  {
    key: "living",
    label: "Living arrangements",
    options: ["Our own home", "With my family", "With my spouse's family", "Flexible"],
  },
] as const;

const FIELD_KEYS = new Set(MARRIAGE_PREF_FIELDS.map((f) => f.key));
const VALUE_MAX = 120;

/** Keep only known fields with a non-empty value and a valid importance (defaults to "preferred"). */
export function cleanMarriagePrefs(input: unknown): MarriagePrefs {
  const out: MarriagePrefs = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!FIELD_KEYS.has(key) || !raw || typeof raw !== "object") continue;
    const value = String((raw as { value?: unknown }).value ?? "").trim().slice(0, VALUE_MAX);
    if (!value) continue;
    const imp = String((raw as { importance?: unknown }).importance ?? "");
    const importance = (MARRIAGE_IMPORTANCE as readonly string[]).includes(imp)
      ? (imp as MarriageImportance)
      : "preferred";
    out[key] = { value, importance };
  }
  return out;
}

/** A plain-text rendering for the Match Insights AI payload (and anywhere a summary helps). */
export function marriagePrefsText(prefs: MarriagePrefs | null | undefined): string {
  if (!prefs) return "";
  const lines: string[] = [];
  for (const field of MARRIAGE_PREF_FIELDS) {
    const item = prefs[field.key];
    if (item?.value) lines.push(`${field.label}: ${item.value}`);
  }
  return lines.join("; ");
}
