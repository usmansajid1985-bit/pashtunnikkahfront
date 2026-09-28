import { DEFAULT_FILTERS, type BrowseFilters } from "@/lib/browse-filters-shared";

/**
 * Controlled preference expansion (B12/B21/B22). Once every profile matching the member's own
 * filters has been shown, Browse keeps going by relaxing SOFT preferences one step at a time.
 * Stages are cumulative — each includes everything the previous one relaxed — and each stage's
 * query excludes whatever the previous stage already matched, so nothing is shown twice.
 *
 * Hard eligibility (approved, not hidden/paused, not suspended, opposite gender, not blocked,
 * not self) lives in buildProfileWhere's base clauses, which every stage still goes through —
 * so expansion can never introduce an ineligible profile.
 */
export type ExpansionStage = {
  /** 1-based; 0 is the member's own (strict) filters. */
  stage: number;
  label: string;
  filters: BrowseFilters;
  /** Whether the saved distance radius still applies at this stage. */
  useDistance: boolean;
};

const AGE_STEP = 3;
const AGE_FLOOR = 18;
const AGE_CEIL = 80;

/** Soft preferences cleared in the final stage (everything except age and hard rules). */
const SOFT_KEYS = [
  "country",
  "city",
  "marital",
  "practice",
  "relocate",
  "sect",
  "tribe",
  "salah",
  "appearance",
  "education",
  "dialect",
  "ancestral",
  "height",
  "occupation",
  "language",
  "dress",
  "interests",
  "goldOnly",
  "newMembers",
  "recentlyActive",
] as const satisfies readonly (keyof BrowseFilters)[];

function sameFilters(a: BrowseFilters, b: BrowseFilters, aDist: boolean, bDist: boolean) {
  if (aDist !== bDist) return false;
  return (Object.keys(a) as (keyof BrowseFilters)[]).every((k) => a[k] === b[k]);
}

export function expansionStages(strict: BrowseFilters): ExpansionStage[] {
  const stages: ExpansionStage[] = [];
  let current = { ...strict };
  let distance = strict.near;

  const push = (label: string, next: BrowseFilters, useDistance: boolean) => {
    if (sameFilters(current, next, distance, useDistance)) return;
    current = next;
    distance = useDistance;
    stages.push({ stage: stages.length + 1, label, filters: next, useDistance });
  };

  // 1. Distance first.
  if (strict.near) push("Outside your distance", { ...current, near: false }, false);

  // 2. A small age widening.
  push(
    "Just outside your age range",
    {
      ...current,
      ageMin: Math.max(AGE_FLOOR, current.ageMin - AGE_STEP),
      ageMax: Math.min(AGE_CEIL, current.ageMax + AGE_STEP),
    },
    distance
  );

  // 3. Remaining soft preferences.
  const cleared = { ...current };
  for (const k of SOFT_KEYS) {
    (cleared as Record<string, unknown>)[k] = DEFAULT_FILTERS[k];
  }
  push("Outside some of your preferences", cleared, false);

  return stages;
}

export function expansionStage(strict: BrowseFilters, stage: number): ExpansionStage | null {
  if (stage < 1) return null;
  return expansionStages(strict)[stage - 1] ?? null;
}

/** First stage number to continue with once strict results run out, or null if none. */
export function firstExpansionStage(strict: BrowseFilters): number | null {
  return expansionStages(strict).length > 0 ? 1 : null;
}
