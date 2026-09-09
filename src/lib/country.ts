/**
 * Canonical country data (PN-BROWSE-001).
 *
 * Legacy `profiles.country` mixes clean names ("United Kingdom") with flag-prefixed ones
 * ("🇬🇧 United Kingdom") and spelling variants, so the same country splits the pool. We store a
 * stable ISO code in `profiles.country_code` and always render the label from the code.
 *
 * `toCountryCode` strips flag emoji, trims, case-folds and resolves aliases.
 */

export type Country = { code: string; name: string; flag: string; aliases?: string[] };

/** Ordered for the picker — common PN countries first, then alphabetical. */
export const COUNTRIES: Country[] = [
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", aliases: ["uk", "great britain", "britain", "england", "scotland", "wales", "northern ireland", "united kingdom of great britain and northern ireland"] },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
  { code: "US", name: "United States", flag: "🇺🇸", aliases: ["usa", "us", "united states of america", "america"] },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", aliases: ["uae", "emirates"] },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", aliases: ["ksa"] },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "DE", name: "Germany", flag: "🇩🇪", aliases: ["deutschland"] },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", aliases: ["holland", "the netherlands"] },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", aliases: ["republic of ireland", "eire"] },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "LY", name: "Libya", flag: "🇱🇾" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", aliases: ["türkiye", "turkiye"] },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
];

/** Fallback bucket for anything genuinely outside the list. */
export const OTHER_COUNTRY: Country = { code: "ZZ", name: "Other", flag: "🌍" };

const BY_CODE = new Map<string, Country>([...COUNTRIES, OTHER_COUNTRY].map((c) => [c.code, c]));

const BY_ALIAS = (() => {
  const m = new Map<string, string>();
  for (const c of COUNTRIES) {
    m.set(c.name.toLowerCase(), c.code);
    m.set(c.code.toLowerCase(), c.code);
    for (const a of c.aliases ?? []) m.set(a.toLowerCase(), c.code);
  }
  return m;
})();

/** Remove leading flag emoji / regional-indicator chars and surrounding punctuation. */
export function stripCountryFlag(raw: string): string {
  return raw
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve any stored/entered country string to an ISO code, or null if unrecognised. */
export function toCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = stripCountryFlag(String(raw)).toLowerCase().replace(/[.,]/g, "").trim();
  if (!cleaned) return null;
  if (BY_ALIAS.has(cleaned)) return BY_ALIAS.get(cleaned)!;
  // Loose contains match for values like "born in pakistan" / "uk (london)".
  for (const [alias, code] of BY_ALIAS) {
    if (alias.length >= 4 && cleaned.includes(alias)) return code;
  }
  return null;
}

export function countryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  return BY_CODE.get(code.toUpperCase()) ?? null;
}

/** Plain display name for a code ("United Kingdom"). */
export function countryLabel(code: string | null | undefined): string | null {
  return countryByCode(code)?.name ?? null;
}

/** Flag + name ("🇬🇧 United Kingdom") for pickers. */
export function countryDisplay(code: string | null | undefined): string | null {
  const c = countryByCode(code);
  return c ? `${c.flag} ${c.name}` : null;
}
