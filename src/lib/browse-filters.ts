import type { Prisma } from "@/generated/prisma/client";
import { oppositeGenderLabels, type BrowseFilters } from "@/lib/browse-filters-shared";
import { JUST_JOINED_DAYS } from "@/lib/presence";

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
 * Fields the spec (§6.4) lists as basic/Free-tier: gender, age, country, city, marital status,
 * basic religious practice, basic relocation preference. Everything else below (§15) is
 * Gold-only. Gating happens here, not at call sites, so it can't be bypassed by a caller
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

  eq("country", f.country);
  eq("marital_status", f.marital);
  eq("religious_practice", f.practice);

  if (f.relocate) {
    and.push({
      OR: [
        { willing_to_relocate: { equals: f.relocate, mode: "insensitive" } },
        { relocate: { equals: f.relocate, mode: "insensitive" } },
      ],
    });
  }

  if (!opts.isGold) return { AND: and };

  eq("city", f.city);

  eq("ethnicity", f.ethnicity);
  eq("religious_methodology", f.sect);
  eq("tribe", f.tribe);
  eq("appearance", f.appearance);
  eq("education", f.education);
  eq("dialect", f.dialect);
  eq("ancestral_village", f.ancestral);
  eq("height", f.height);

  const salah = kw(f.salah);
  if (salah) {
    and.push({ salah_pattern: { contains: salah, mode: "insensitive" } });
  }

  const occupation = kw(f.occupation);
  if (occupation) {
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

  const dress = kw(f.dress);
  if (dress) {
    and.push({ appearance: { contains: dress, mode: "insensitive" } });
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
