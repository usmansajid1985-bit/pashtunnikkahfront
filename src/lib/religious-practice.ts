/**
 * Single source of truth for the religious-practice options, shared by onboarding, Edit Profile
 * and the Browse filter so all three offer the same labels and store the same values.
 *
 * The four canonical options below are the only ones offered. Older stored values — from the
 * old-site import and earlier app versions, e.g. "Moderately Practising" and "Improving/Learning"
 * (both removed from the options) — are mapped to the canonical option they best fit via
 * `PRACTICE_MATCH`, so filtering by a canonical option still surfaces members who saved an older
 * label and nobody silently drops out of results.
 */

export const RELIGIOUS_PRACTICE_OPTIONS = [
  "Strictly Practising",
  "Actively Practising",
  "Occasionally Practising",
  "Does Not Practise",
] as const;

export type ReligiousPracticeOption = (typeof RELIGIOUS_PRACTICE_OPTIONS)[number];

export function isReligiousPracticeOption(v: string): v is ReligiousPracticeOption {
  return (RELIGIOUS_PRACTICE_OPTIONS as readonly string[]).includes(v);
}

/**
 * How a selected canonical option matches stored values. `keywords` are case-insensitive
 * substrings that also catch spellings we haven't listed explicitly. The groupings:
 *  - "Moderately Practising", "Improving", "Learning" → Occasionally Practising
 *  - a bare "Practising" (no qualifier) → Actively Practising
 */
export const PRACTICE_MATCH: Record<ReligiousPracticeOption, { exact: string[]; keywords: string[] }> = {
  "Strictly Practising": { exact: [], keywords: ["strict", "very practi", "highly practi", "fully practi", "devout"] },
  "Actively Practising": { exact: ["Practising"], keywords: ["activ", "regularly practi"] },
  "Occasionally Practising": {
    exact: [],
    keywords: ["occasion", "sometime", "moderate", "improv", "learn", "growing", "trying"],
  },
  "Does Not Practise": {
    exact: [],
    keywords: ["does not", "doesn't practi", "not practi", "non practi", "non-practi", "nonpracti", "not currently", "not religious"],
  },
};
