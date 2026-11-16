/**
 * One canonical profile-completeness calculation, shared by the "N profile details left to add"
 * banner on Overview, Browse and Profile. Each field maps to a friendly label and the Edit-profile
 * section that fills it, so "Complete my profile →" / each item can deep-link to the right place.
 *
 * Every field is optional on the input so any page can pass whatever slice of the profile row it
 * already loaded.
 */
export type CompletionField = {
  key: string;
  label: string;
  /** Edit-profile section hash the field lives under. */
  section: string;
  filled: boolean;
};

type ProfileLike = {
  about_me?: string | null;
  height?: string | null;
  height_cm?: number | null;
  city?: string | null;
  occupation?: string | null;
  education?: string | null;
  tribe?: string | null;
  religious_practice?: string | null;
  appearance?: string | null;
  ancestral_village?: string | null;
  dialect?: string | null;
  interests?: string | null;
} | null | undefined;

const has = (v: unknown) => Boolean(v && String(v).trim());

/**
 * Only fields the caller actually loaded are counted — an unselected Prisma column comes back
 * `undefined` and is skipped, so a page passing a partial profile row doesn't inflate the
 * "missing" list. (A loaded-but-empty column is `null`/"" and counts as missing.)
 */
export function profileCompletionFields(p: ProfileLike): CompletionField[] {
  if (!p) return [];
  const present = (k: string) => k in p;
  const all: (CompletionField & { known: boolean })[] = [
    { key: "about_me", label: "About me", section: "about", filled: has(p.about_me), known: present("about_me") },
    {
      key: "height",
      label: "Height",
      section: "personal",
      filled: has(p.height) || Boolean(p.height_cm),
      known: present("height") || present("height_cm"),
    },
    { key: "city", label: "City", section: "personal", filled: has(p.city), known: present("city") },
    { key: "occupation", label: "Occupation", section: "personal", filled: has(p.occupation), known: present("occupation") },
    { key: "education", label: "Education", section: "personal", filled: has(p.education), known: present("education") },
    { key: "tribe", label: "Tribe", section: "heritage", filled: has(p.tribe), known: present("tribe") },
    { key: "religious_practice", label: "Islamic practice", section: "faith", filled: has(p.religious_practice), known: present("religious_practice") },
    { key: "appearance", label: "Appearance", section: "personal", filled: has(p.appearance), known: present("appearance") },
    { key: "ancestral_village", label: "Ancestral region", section: "heritage", filled: has(p.ancestral_village), known: present("ancestral_village") },
    { key: "dialect", label: "Pashto dialect", section: "heritage", filled: has(p.dialect), known: present("dialect") },
    { key: "interests", label: "Interests", section: "about", filled: has(p.interests), known: present("interests") },
  ];
  return all.filter((f) => f.known).map(({ known: _known, ...f }) => f);
}

export type ProfileCompletion = {
  percent: number;
  missing: CompletionField[];
  /** Link that opens Edit profile at the first missing section (or the editor if none). */
  completeHref: string;
};

export function profileCompletion(p: ProfileLike): ProfileCompletion {
  const fields = profileCompletionFields(p);
  if (fields.length === 0) return { percent: 100, missing: [], completeHref: "/profile/edit" };
  const filled = fields.filter((f) => f.filled).length;
  const percent = Math.round((filled / fields.length) * 100);
  const missing = fields.filter((f) => !f.filled);
  const first = missing[0];
  return {
    percent,
    missing,
    completeHref: first ? `/profile/edit#${first.section}` : "/profile/edit",
  };
}

/** Natural-language list: ["A","B","C"] → "A, B and C". */
export function listAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
