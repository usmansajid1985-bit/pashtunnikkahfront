/** Client-safe browse types + helpers (no Prisma / Node deps). */

export const BROWSE_PAGE_SIZE = 24;

export type BrowseSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/** Same as `first`, but trims — whitespace-only text filters must read as blank (PN-BROWSE-005). */
function firstTrimmed(v: string | string[] | undefined): string {
  return first(v).trim();
}

export type BrowseFilters = {
  ageMin: number;
  ageMax: number;
  country: string;
  city: string;
  marital: string;
  sect: string;
  practice: string;
  tribe: string;
  relocate: string;
  salah: string;
  appearance: string;
  education: string;
  dialect: string;
  ancestral: string;
  height: string;
  occupation: string;
  language: string;
  dress: string;
  interests: string;
  goldOnly: boolean;
  newMembers: boolean;
  recentlyActive: boolean;
  near: boolean;
  sort: "newest" | "recently_active" | "age_asc" | "age_desc";
  page: number;
};

export const DEFAULT_FILTERS: BrowseFilters = {
  ageMin: 18,
  ageMax: 60,
  country: "",
  city: "",
  marital: "",
  sect: "",
  practice: "",
  tribe: "",
  relocate: "",
  salah: "",
  appearance: "",
  education: "",
  dialect: "",
  ancestral: "",
  height: "",
  occupation: "",
  language: "",
  dress: "",
  interests: "",
  goldOnly: false,
  newMembers: false,
  recentlyActive: false,
  near: false,
  sort: "newest",
  page: 1,
};

/**
 * Filters that only apply for Gold members. Free tier keeps: age, country, marital status,
 * religious practice, relocation preference (and gender, which is always opposite-of-viewer).
 * `buildProfileWhere` already ignores these for non-Gold callers — this list lets the UI lock
 * the controls and the active-filter count exclude them, so a Basic user never sees a filter
 * that looks applied but isn't (PN-BROWSE-002).
 */
export const GOLD_ONLY_FILTER_KEYS = [
  "city",
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
  "near",
] as const satisfies readonly (keyof BrowseFilters)[];

/** Blank every Gold-only field so a non-Gold view can't show or submit them. */
export function stripGoldFilters(f: BrowseFilters): BrowseFilters {
  return {
    ...f,
    city: "",
    sect: "",
    tribe: "",
    salah: "",
    appearance: "",
    education: "",
    dialect: "",
    ancestral: "",
    height: "",
    occupation: "",
    language: "",
    dress: "",
    interests: "",
    goldOnly: false,
    newMembers: false,
    recentlyActive: false,
    near: false,
  };
}

export function parseBrowseFilters(sp: BrowseSearchParams): BrowseFilters {
  const ageMin = Math.min(80, Math.max(18, Number(first(sp.ageMin)) || 18));
  const ageMax = Math.min(80, Math.max(ageMin, Number(first(sp.ageMax)) || 60));
  const sortRaw = first(sp.sort);
  const sort =
    sortRaw === "recently_active" || sortRaw === "age_asc" || sortRaw === "age_desc"
      ? sortRaw
      : "newest";

  return {
    ageMin,
    ageMax,
    country: firstTrimmed(sp.country),
    city: firstTrimmed(sp.city),
    marital: firstTrimmed(sp.marital),
    sect: firstTrimmed(sp.sect),
    practice: firstTrimmed(sp.practice),
    tribe: firstTrimmed(sp.tribe),
    relocate: firstTrimmed(sp.relocate),
    salah: firstTrimmed(sp.salah),
    appearance: firstTrimmed(sp.appearance),
    education: firstTrimmed(sp.education),
    dialect: firstTrimmed(sp.dialect),
    ancestral: firstTrimmed(sp.ancestral),
    height: firstTrimmed(sp.height),
    occupation: firstTrimmed(sp.occupation),
    language: firstTrimmed(sp.language),
    dress: firstTrimmed(sp.dress),
    interests: firstTrimmed(sp.interests),
    goldOnly: first(sp.goldOnly) === "1",
    newMembers: first(sp.newMembers) === "1",
    recentlyActive: first(sp.recentlyActive) === "1",
    near: first(sp.near) === "1",
    sort,
    page: Math.max(1, Number(first(sp.page)) || 1),
  };
}

/** Count active filters excluding age defaults and sort/page. Gold-only filters are not
 * counted for a non-Gold viewer, since they don't actually apply. */
export function countActiveFilters(f: BrowseFilters, isGold = true): number {
  const goldOnly = new Set<string>(GOLD_ONLY_FILTER_KEYS);
  const counts = (k: keyof BrowseFilters) => isGold || !goldOnly.has(k);
  let n = 0;
  if (f.ageMin !== 18 || f.ageMax !== 60) n += 1;
  const keys: (keyof BrowseFilters)[] = [
    "country",
    "city",
    "marital",
    "sect",
    "practice",
    "tribe",
    "relocate",
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
  ];
  for (const k of keys) {
    if (!counts(k)) continue;
    const v = f[k];
    if (typeof v === "string" ? v.trim() !== "" : Boolean(v)) n += 1;
  }
  if (f.goldOnly && counts("goldOnly")) n += 1;
  if (f.newMembers && counts("newMembers")) n += 1;
  if (f.recentlyActive && counts("recentlyActive")) n += 1;
  if (f.near && counts("near")) n += 1;
  return n;
}

export function filtersToQuery(f: Partial<BrowseFilters>, extras: Record<string, string> = {}): string {
  const params = new URLSearchParams(extras);
  const set = (k: string, v: string | number | boolean | undefined) => {
    if (v === undefined || v === "" || v === false) return;
    if (typeof v === "string" && v.trim() === "") return;
    if (k === "ageMin" && v === 18) return;
    if (k === "ageMax" && v === 60) return;
    if (k === "sort" && v === "newest") return;
    if (k === "page" && v === 1) return;
    params.set(k, String(v === true ? "1" : v));
  };

  set("ageMin", f.ageMin);
  set("ageMax", f.ageMax);
  set("country", f.country);
  set("city", f.city);
  set("marital", f.marital);
  set("sect", f.sect);
  set("practice", f.practice);
  set("tribe", f.tribe);
  set("relocate", f.relocate);
  set("salah", f.salah);
  set("appearance", f.appearance);
  set("education", f.education);
  set("dialect", f.dialect);
  set("ancestral", f.ancestral);
  set("height", f.height);
  set("occupation", f.occupation);
  set("language", f.language);
  set("dress", f.dress);
  set("interests", f.interests);
  set("goldOnly", f.goldOnly);
  set("newMembers", f.newMembers);
  set("recentlyActive", f.recentlyActive);
  set("near", f.near);
  set("sort", f.sort);
  set("page", f.page);

  const q = params.toString();
  return q ? `?${q}` : "";
}

export function isFemaleGender(gender: string | null | undefined): boolean {
  const g = (gender || "").trim().toLowerCase();
  return g === "female" || g === "f" || g === "sister" || g.startsWith("f");
}

export function isMaleGender(gender: string | null | undefined): boolean {
  const g = (gender || "").trim().toLowerCase();
  return g === "male" || g === "m" || g === "brother" || g.startsWith("m");
}

/** Labels stored on profiles for the opposite sex of `gender`. */
export function oppositeGenderLabels(gender: string | null | undefined): string[] | null {
  if (isMaleGender(gender)) return ["Female", "Sister"];
  if (isFemaleGender(gender)) return ["Male", "Brother"];
  return null;
}

export function oppositeGender(gender: string | null | undefined): string | null {
  const labels = oppositeGenderLabels(gender);
  return labels?.[0] ?? null;
}

export const SALAH_OPTIONS = [
  { value: "Consistently", label: "Consistently – 5 daily" },
  { value: "Almost always", label: "Almost always" },
  { value: "Regularly", label: "Regularly" },
  { value: "Sometimes", label: "Sometimes" },
  { value: "Rarely", label: "Rarely / Jumu'ah" },
  { value: "Never", label: "Never / One-offs" },
] as const;
