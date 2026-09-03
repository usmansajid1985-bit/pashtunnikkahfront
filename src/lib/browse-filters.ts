import type { Prisma } from "@/generated/prisma/client";
import { oppositeGenderLabels, type BrowseFilters } from "@/lib/browse-filters-shared";

export {
  BROWSE_PAGE_SIZE,
  DEFAULT_FILTERS,
  SALAH_OPTIONS,
  countActiveFilters,
  filtersToQuery,
  oppositeGender,
  oppositeGenderLabels,
  parseBrowseFilters,
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
    if (!value) return;
    and.push({ [field]: { equals: value, mode: "insensitive" } } as Prisma.profilesWhereInput);
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

  if (f.salah) {
    and.push({ salah_pattern: { contains: f.salah, mode: "insensitive" } });
  }

  if (f.occupation) {
    and.push({ occupation: { contains: f.occupation, mode: "insensitive" } });
  }

  if (f.language) {
    and.push({
      OR: [
        { home_language: { contains: f.language, mode: "insensitive" } },
        { pashto_speaker: { contains: f.language, mode: "insensitive" } },
      ],
    });
  }

  if (f.dress) {
    and.push({ appearance: { contains: f.dress, mode: "insensitive" } });
  }

  if (f.interests) {
    and.push({ interests: { contains: f.interests, mode: "insensitive" } });
  }

  if (f.newMembers) {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    and.push({ created_at: { gte: since } });
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
