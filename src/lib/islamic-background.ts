/** Islamic background options shared by Browse filters and Edit profile. */
export const ISLAMIC_SECTS = [
  "Sunni – Hanafi",
  "Sunni – Shafi'i",
  "Sunni – Maliki",
  "Sunni – Hanbali",
  "Salafi",
  "Not specified",
] as const;

/** Older profiles saved "Prefer not to say"; show and match it as "Not specified". */
const LEGACY_SECTS: Record<string, string> = { "Prefer not to say": "Not specified" };

/** Normalise a stored value for display (maps legacy labels to the current wording). */
export function displaySect(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.trim();
  if (!v) return null;
  return LEGACY_SECTS[v] ?? v;
}

/** Dash styles members may already have saved (hyphen, en dash, em dash), plus legacy labels. */
export function sectSpellings(value: string): string[] {
  const v = value.trim();
  if (!v) return [];
  const out = new Set<string>();
  const add = (s: string) => {
    out.add(s);
    out.add(s.replace(/[–—-]/g, "-"));
    out.add(s.replace(/[–—-]/g, "–"));
    out.add(s.replace(/[–—-]/g, "—"));
  };
  add(v);
  // "Not specified" must still match profiles saved under the old "Prefer not to say" label.
  if (v === "Not specified") add("Prefer not to say");
  return [...out];
}
