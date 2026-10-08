import type { Prisma } from "@/generated/prisma/client";
import { oppositeGenderLabels, type BrowseFilters } from "@/lib/browse-filters-shared";
import { JUST_JOINED_DAYS } from "@/lib/presence";
import { normalizeRelocation } from "@/lib/relocation";
import { countryByCode, toCountryCode } from "@/lib/country";
import { parseTribeList, tribeSpellings } from "@/lib/tribes";
import { professionGroup } from "@/lib/professions";

export {
  BROWSE_PAGE_SIZE,
  DEFAULT_FILTERS,
  GOLD_ONLY_FILTER_KEYS,
  SALAH_OPTIONS,
  countActiveFilters,
  filtersToQuery,
  oppositeGender,
  oppositeGenderLabels,
  parseBrowseFilters,
  stripGoldFilters,
  type BrowseFilters,
  type BrowseSearchParams,
} from "@/lib/browse-filters-shared";

/**
 * Basic/Free-tier fields: gender, age, country, marital status. Everything else below —
 * including religious practice and relocation (B09, V2 QA 19 Sep) — is Gold-only. Gating happens here, not at call sites, so it can't be bypassed by a caller
 * forgetting to check — `isGold` must come from a fresh DB read of the querying user, never
 * from the query string or a cached session claim.
 *
 * Gender is always opposite of the viewer (male → female profiles, female → male). Query
 * params cannot override this.
 */
export function buildProfileWhere(
  f: BrowseFilters,
  opts: {
    excludeUserId?: bigint;
    /** Users to hide entirely — blocked in either direction (mutual blocking rule). */
    excludeUserIds?: bigint[];
    viewerGender?: string | null;
    isGold: boolean;
    /** Ids within the searching user's saved distance radius, or undefined if no radius is set. */
    locationIds?: bigint[];
  }
): Prisma.profilesWhereInput {
  const and: Prisma.profilesWhereInput[] = [
    { status: "approved" },
    { is_hidden: false },
    { age: { gte: f.ageMin, lte: f.ageMax } },
  ];

  // Hard eligibility (B22): suspended accounts never appear, whatever filters are relaxed.
  and.push({
    users: { account_status: { not: "suspended" } },
  });
  if (opts.excludeUserId) and.push({ user_id: { not: opts.excludeUserId } });
  if (opts.excludeUserIds && opts.excludeUserIds.length > 0) {
    and.push({ user_id: { notIn: opts.excludeUserIds } });
  }
  if (opts.locationIds) and.push({ id: { in: opts.locationIds } });

  const opposite = oppositeGenderLabels(opts.viewerGender);
  if (opposite?.length) {
    and.push({
      OR: opposite.map((label) => ({
        gender: { equals: label, mode: "insensitive" as const },
      })),
    });
  } else {
    and.push({ id: { in: [] } });
  }

  const eq = (field: keyof Prisma.profilesWhereInput, value: string) => {
    const v = (value ?? "").trim();
    if (!v) return;
    and.push({ [field]: { equals: v, mode: "insensitive" } } as Prisma.profilesWhereInput);
  };
  /** Trimmed value for a `contains` filter, or null when effectively blank (PN-BROWSE-005). */
  const kw = (value: string) => {
    const v = (value ?? "").trim();
    return v || null;
  };

  // Country: the filter submits an ISO code. Match the canonical `country_code`, and also
  // legacy rows not yet backfilled (country_code NULL) by any alias spelling of the country
  // name — flag-prefixed or not (PN-BROWSE-001).
  const countryCode = toCountryCode(f.country) ?? (f.country ? f.country.toUpperCase() : null);
  const country = countryByCode(countryCode);
  if (country) {
    const names = [country.name, ...(country.aliases ?? [])];
    and.push({
      OR: [
        { country_code: country.code },
        {
          AND: [
            { country_code: null },
            {
              OR: names.map((n) => ({
                country: { contains: n, mode: "insensitive" as const },
              })),
            },
          ],
        },
      ],
    });
  }

  eq("marital_status", f.marital);

  if (!opts.isGold) return { AND: and };

  // B09: religious practice + relocation are Gold-only (client decision, V2 QA 19 Sep).
  eq("religious_practice", f.practice);

  // One canonical relocation field. Match any legacy spelling of the selected preference in
  // either column, but the value the user picks is normalised (yes|maybe|no) (PN-BROWSE-009).
  const relocate = normalizeRelocation(f.relocate);
  if (relocate) {
    const aliases: Record<string, string[]> = {
      yes: ["yes", "open to relocation", "open", "willing to relocate"],
      maybe: ["maybe", "maybe depends", "maybe — depends", "depends", "unsure"],
      no: ["no", "not open to relocation", "not open", "won't relocate"],
    };
    const list = aliases[relocate];
    and.push({
      OR: list.flatMap((val) => [
        { willing_to_relocate: { equals: val, mode: "insensitive" as const } },
        { relocate: { equals: val, mode: "insensitive" as const } },
      ]),
    });
  }

  eq("city", f.city);

  eq("religious_methodology", f.sect);
  // Tribe: one or more listed tribes. Known V1 spellings are matched too, so members who
  // haven't confirmed their tribe yet still appear under the right one.
  const tribes = parseTribeList(f.tribe).flatMap(tribeSpellings);
  if (tribes.length) {
    and.push({ OR: tribes.map((t) => ({ tribe: { equals: t, mode: "insensitive" as const } })) });
  }
  // Education: profiles from before the current options hold older wording.
  const OLDER_EDUCATION: Record<string, string[]> = {
    "bachelor's": ["Bachelors"],
    "master's": ["Masters"],
    "a levels": ["College / A-Levels"],
    gcses: ["Secondary School"],
    diploma: ["Vocational / Trade"],
  };
  const education = (f.education ?? "").trim();
  if (education) {
    and.push({
      OR: [education, ...(OLDER_EDUCATION[education.toLowerCase()] ?? [])].map((v) => ({
        education: { equals: v, mode: "insensitive" as const },
      })),
    });
  }
  eq("dialect", f.dialect);
  eq("ancestral_village", f.ancestral);

  // Minimum-height filter: submits a target in cm, matches validated `height_cm >= target`.
  // Rows with no parsed height_cm are excluded from a height search (PN-BROWSE-010).
  const heightCm = Number(f.height);
  if (f.height && Number.isFinite(heightCm) && heightCm > 0) {
    and.push({ height_cm: { gte: heightCm } });
  }

  const salah = kw(f.salah);
  if (salah) {
    and.push({ salah_pattern: { contains: salah, mode: "insensitive" } });
  }

  // Profession: a group from the filter's dropdown matches any of its words (professions are
  // free text on profiles); anything else is matched as typed (older links / saved presets).
  const occupation = kw(f.occupation);
  const group = professionGroup(occupation);
  if (group) {
    and.push({ OR: group.keywords.map((w) => ({ occupation: { contains: w, mode: "insensitive" as const } })) });
  } else if (occupation) {
    and.push({ occupation: { contains: occupation, mode: "insensitive" } });
  }

  const language = kw(f.language);
  if (language) {
    and.push({
      OR: [
        { home_language: { contains: language, mode: "insensitive" } },
        { pashto_speaker: { contains: language, mode: "insensitive" } },
      ],
    });
  }

  // Appearance is stored as one comma-joined value (head covering + dress styles, or a beard
  // style). `dress` is the head covering / beard choice, `appearance` the dress style.
  // Profiles from before the current options hold older wording ("Hijab", "No Hijab",
  // "Trimmed Beard", "Full Beard") — each choice also matches its older equivalent.
  const has = (text: string): Prisma.profilesWhereInput => ({ appearance: { contains: text, mode: "insensitive" } });
  const noHijab = [has("no hijab"), has("does not wear hijab")];
  const LOOKS: Record<string, Prisma.profilesWhereInput> = {
    "does not wear hijab": { OR: noHijab },
    "wears hijab": { AND: [has("hijab"), { NOT: noHijab }] },
    "wears niqab": has("niqab"),
    "short beard": { OR: [has("short beard"), has("trimmed beard")] },
    "long beard": { OR: [has("long beard"), has("full beard")] },
    "abaya / jilbab": { OR: [has("abaya"), has("jilbab")] },
  };
  for (const choice of [kw(f.dress), kw(f.appearance)]) {
    if (choice) and.push(LOOKS[choice.toLowerCase()] ?? has(choice));
  }

  const interests = kw(f.interests);
  if (interests) {
    and.push({ interests: { contains: interests, mode: "insensitive" } });
  }

  if (f.newMembers) {
    // "Just Joined" = first JUST_JOINED_DAYS after approval (falls back to created_at when a
    // profile has no approved_at). Must match the card badge's window.
    const since = new Date(Date.now() - JUST_JOINED_DAYS * 24 * 60 * 60_000);
    and.push({
      OR: [
        { users: { approved_at: { gte: since } } },
        { AND: [{ users: { approved_at: null } }, { created_at: { gte: since } }] },
      ],
    });
  }

  if (f.goldOnly || f.recentlyActive) {
    const userFilter: Prisma.usersWhereInput = {};
    if (f.goldOnly) {
      userFilter.plan = { equals: "gold", mode: "insensitive" };
    }
    if (f.recentlyActive) {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      userFilter.last_seen_at = { gte: since };
    }
    and.push({ users: userFilter });
  }

  return { AND: and };
}
