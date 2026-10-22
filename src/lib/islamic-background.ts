/** Islamic background options shared by Browse filters and Edit profile. */
export const ISLAMIC_SECTS = [
  "Sunni – Hanafi",
  "Sunni – Shafi'i",
  "Sunni – Maliki",
  "Sunni – Hanbali",
  "Salafi",
  "Prefer not to say",
] as const;

/** Dash styles members may already have saved (hyphen, en dash, em dash). */
export function sectSpellings(value: string): string[] {
  const v = value.trim();
  if (!v) return [];
  return [...new Set([v, v.replace(/[–—-]/g, "-"), v.replace(/[–—-]/g, "–"), v.replace(/[–—-]/g, "—")])];
}
