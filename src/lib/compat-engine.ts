/**
 * B26/B27/B28: deterministic, two-way compatibility breakdown.
 *
 * Every line comes only from what the two members actually entered — profile facts AND each
 * side's stated preferences, checked in both directions. Nothing is guessed: if either side
 * hasn't said something, it goes under "Not enough information" instead of being counted as a
 * match. Same inputs → same output, so the breakdown never changes unless a profile does.
 * No percentages, and no claims about anyone's character or the success of a marriage.
 */

export type CompatSide = {
  code: string;
  gender: string | null;
  age: number | null;
  maritalStatus: string | null;
  hasChildren: string | null;
  wantsChildren: string | null;
  agePrefFrom: number | null;
  agePrefTo: number | null;
  acceptWidow: string | null;
  considerDivorcee: string | null;
  openTo: string | null;
  country: string | null;
  city: string | null;
  willingToRelocate: string | null;
  religiousPractice: string | null;
  religiousMethodology: string | null;
  salah: string | null;
  education: string | null;
  educationPref: string | null;
  tribe: string | null;
  ancestralRegion: string | null;
  smoking: string | null;
  vaping: string | null;
  languages: string[];
  occupation: string | null;
  interests: string | null;
  livingArrangements: string | null;
  /** Written sections — read by the AI layer, not the rule checks. */
  aboutMe: string | null;
  lookingFor: string | null;
};

export type CompatStatus = "aligned" | "discuss" | "unknown";
export type CompatItem = { topic: string; status: CompatStatus; text: string };
export type CompatBreakdown = {
  aligned: CompatItem[];
  discuss: CompatItem[];
  unknown: CompatItem[];
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const has = (v: string | null | undefined) => {
  const n = norm(v);
  return n !== "" && n !== "prefer not to say" && n !== "—";
};
const yes = (v: string | null | undefined) => /^(yes|y|true|open|inshallah|insha)/.test(norm(v));
const no = (v: string | null | undefined) => /^(no|n|false|none)\b/.test(norm(v));
const openList = (v: string | null) =>
  norm(v)
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean);

function pushItem(b: CompatBreakdown, item: CompatItem) {
  b[item.status === "aligned" ? "aligned" : item.status === "discuss" ? "discuss" : "unknown"].push(item);
}

/* ---------------- Age: each side's age against the OTHER side's stated range ---------------- */
function ageFits(age: number | null, from: number | null, to: number | null): boolean | null {
  if (age == null || (from == null && to == null)) return null;
  return (from == null || age >= from) && (to == null || age <= to);
}
function rangeLabel(from: number | null, to: number | null) {
  if (from != null && to != null) return `${from}–${to}`;
  if (from != null) return `${from}+`;
  return `up to ${to}`;
}

function ageCheck(me: CompatSide, them: CompatSide): CompatItem {
  const theyFitMine = ageFits(them.age, me.agePrefFrom, me.agePrefTo);
  const iFitTheirs = ageFits(me.age, them.agePrefFrom, them.agePrefTo);
  const topic = "Age preferences";
  if (theyFitMine === null && iFitTheirs === null) {
    return { topic, status: "unknown", text: "Neither of you has set an age range." };
  }
  const problems: string[] = [];
  if (theyFitMine === false) {
    problems.push(`${them.code} (${them.age}) is outside the ${rangeLabel(me.agePrefFrom, me.agePrefTo)} range you set`);
  }
  if (iFitTheirs === false) {
    problems.push(`you (${me.age}) are outside the ${rangeLabel(them.agePrefFrom, them.agePrefTo)} range ${them.code} set`);
  }
  if (problems.length) {
    return { topic, status: "discuss", text: `${capitalise(problems.join("; and "))}.` };
  }
  if (theyFitMine && iFitTheirs) {
    return { topic, status: "aligned", text: "You each fall within the age range the other has set." };
  }
  // One side matches, the other hasn't set a range — don't claim full alignment.
  return theyFitMine
    ? { topic, status: "unknown", text: `${them.code} is within your age range, but hasn't set an age range themselves.` }
    : { topic, status: "unknown", text: `You're within ${them.code}'s age range, but you haven't set one yourself.` };
}

/* --------------- Marital history: is each side open to the other's circumstances --------------- */
type Openness = true | false | null;
function opennessTo(viewer: CompatSide, other: CompatSide): { needed: string | null; open: Openness } {
  const status = norm(other.maritalStatus);
  const list = openList(viewer.openTo);
  if (status.startsWith("divorc") || status.startsWith("annul")) {
    // "Annulled" is its own option now; the old "Divorcees" option covered both.
    const prefix = status.startsWith("annul") ? "annul" : "divorc";
    if (list.some((x) => x.startsWith(prefix) || x === "divorcees")) return { needed: "divorced", open: true };
    if (yes(viewer.considerDivorcee)) return { needed: "divorced", open: true };
    if (no(viewer.considerDivorcee)) return { needed: "divorced", open: false };
    return { needed: "divorced", open: null };
  }
  if (status.startsWith("widow")) {
    if (list.some((x) => x.startsWith("widow"))) return { needed: "widowed", open: true };
    if (yes(viewer.acceptWidow)) return { needed: "widowed", open: true };
    if (no(viewer.acceptWidow)) return { needed: "widowed", open: false };
    return { needed: "widowed", open: null };
  }
  if (status.includes("polygam")) {
    if (list.some((x) => x.includes("polygam"))) return { needed: "open to polygamy", open: true };
    return { needed: "open to polygamy", open: null };
  }
  return { needed: null, open: true }; // never married — nothing to check
}

function maritalCheck(me: CompatSide, them: CompatSide): CompatItem | null {
  const topic = "Marital history";
  const mine = opennessTo(me, them); // am I open to their history?
  const theirs = opennessTo(them, me); // are they open to mine?
  if (!mine.needed && !theirs.needed) {
    if (!has(me.maritalStatus) || !has(them.maritalStatus)) {
      return { topic, status: "unknown", text: "Marital status is missing from one of your profiles." };
    }
    return null; // both never married — nothing worth listing
  }
  const discuss: string[] = [];
  const unknown: string[] = [];
  if (mine.needed) {
    if (mine.open === false) discuss.push(`${them.code} is ${mine.needed}, and your preferences say you're not considering this`);
    else if (mine.open === null) unknown.push(`${them.code} is ${mine.needed}, and you haven't said whether you'd consider this`);
  }
  if (theirs.needed) {
    if (theirs.open === false) discuss.push(`you're ${theirs.needed}, and ${them.code}'s preferences say they're not considering this`);
    else if (theirs.open === null) unknown.push(`you're ${theirs.needed}, and ${them.code} hasn't said whether they'd consider this`);
  }
  if (discuss.length) return { topic, status: "discuss", text: `${capitalise(discuss.join("; and "))}.` };
  if (unknown.length) return { topic, status: "unknown", text: `${capitalise(unknown.join("; and "))}.` };
  // Say exactly which side's openness was checked — never imply both when only one applied.
  const ok: string[] = [];
  if (mine.needed) ok.push(`${them.code} is ${mine.needed} and you've said you'd consider this`);
  if (theirs.needed) ok.push(`you're ${theirs.needed} and ${them.code} has said they'd consider this`);
  return { topic, status: "aligned", text: `${capitalise(ok.join("; and "))}.` };
}

/* ------------------------------------ Faith ------------------------------------ */
const PRACTICE_ORDER = ["does not", "occasionally", "improving", "moderately", "actively", "strictly"];
function practiceRank(v: string | null) {
  const n = norm(v);
  const i = PRACTICE_ORDER.findIndex((p) => n.startsWith(p));
  return i >= 0 ? i : null;
}
function practiceCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Religious practice";
  const a = practiceRank(me.religiousPractice);
  const b = practiceRank(them.religiousPractice);
  if (a === null || b === null) {
    return { topic, status: "unknown", text: "One of you hasn't described your level of religious practice." };
  }
  if (a === b) {
    return { topic, status: "aligned", text: `You both describe yourselves as ${me.religiousPractice!.toLowerCase()}.` };
  }
  if (Math.abs(a - b) === 1) {
    return {
      topic,
      status: "aligned",
      text: `Similar levels of practice. You: ${me.religiousPractice!.toLowerCase()}; ${them.code}: ${them.religiousPractice!.toLowerCase()}.`,
    };
  }
  return {
    topic,
    status: "discuss",
    text: `Different levels of practice. You: ${me.religiousPractice!.toLowerCase()}; ${them.code}: ${them.religiousPractice!.toLowerCase()}. Worth talking about what each of you expects.`,
  };
}

function methodologyCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Islamic background";
  if (!has(me.religiousMethodology) || !has(them.religiousMethodology)) {
    return { topic, status: "unknown", text: "One of you hasn't shared your Islamic background." };
  }
  const a = norm(me.religiousMethodology);
  const b = norm(them.religiousMethodology);
  if (a === b || a.startsWith(b) || b.startsWith(a)) {
    return { topic, status: "aligned", text: `Shared background: ${them.religiousMethodology}.` };
  }
  return {
    topic,
    status: "discuss",
    text: `Different backgrounds. You: ${me.religiousMethodology}; ${them.code}: ${them.religiousMethodology}.`,
  };
}

const SALAH_ORDER = ["never", "rarely", "sometimes", "regularly", "almost always", "consistently"];
function salahRank(v: string | null) {
  const n = norm(v);
  const i = SALAH_ORDER.findIndex((p) => n.startsWith(p));
  return i >= 0 ? i : null;
}
function salahShort(v: string) {
  return v.split("–")[0].split(" - ")[0].trim().toLowerCase();
}
function salahCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Salah";
  const a = salahRank(me.salah);
  const b = salahRank(them.salah);
  if (a === null || b === null) {
    return { topic, status: "unknown", text: "One of you hasn't shared how regularly you pray." };
  }
  if (Math.abs(a - b) <= 1) {
    return {
      topic,
      status: "aligned",
      text: a === b ? `You both pray ${salahShort(me.salah!)}.` : `Similar prayer habits. You: ${salahShort(me.salah!)}; ${them.code}: ${salahShort(them.salah!)}.`,
    };
  }
  return {
    topic,
    status: "discuss",
    text: `Different prayer habits. You: ${salahShort(me.salah!)}; ${them.code}: ${salahShort(them.salah!)}.`,
  };
}

/* ---------------------------- Education: two-way preference ---------------------------- */
function eduLevel(v: string | null): number | null {
  const n = norm(v);
  if (!n || n === "other") return null;
  if (n.startsWith("phd") || n.includes("doctor")) return 4;
  if (n.startsWith("master")) return 3;
  if (n.startsWith("bachelor")) return 2;
  return 1; // school, college, A-levels, diploma, vocational
}
function eduPrefLevel(v: string | null): number | null {
  const n = norm(v);
  if (!n) return null;
  if (n.startsWith("master")) return 3;
  if (n.startsWith("bachelor")) return 2;
  return 1; // "Secondary School+" — any
}
function educationCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Education";
  const myPref = eduPrefLevel(me.educationPref);
  const theirPref = eduPrefLevel(them.educationPref);
  const myLevel = eduLevel(me.education);
  const theirLevel = eduLevel(them.education);
  const theyMeetMine = myPref == null || theirLevel == null ? null : theirLevel >= myPref;
  const iMeetTheirs = theirPref == null || myLevel == null ? null : myLevel >= theirPref;
  if (theyMeetMine === false || iMeetTheirs === false) {
    const bits: string[] = [];
    if (theyMeetMine === false) bits.push(`you'd prefer ${me.educationPref!.toLowerCase()}, and ${them.code} has ${them.education}`);
    if (iMeetTheirs === false) bits.push(`${them.code} would prefer ${them.educationPref!.toLowerCase()}, and you have ${me.education}`);
    return { topic, status: "discuss", text: `${capitalise(bits.join("; and "))}.` };
  }
  if (theyMeetMine && iMeetTheirs) {
    return { topic, status: "aligned", text: "You each meet the education preference the other has set." };
  }
  // Be precise about what's missing: a stated preference is not the same as the level itself.
  if (myPref == null && theirPref == null && myLevel != null && theirLevel != null) {
    return { topic, status: "unknown", text: "Neither of you has stated an education preference, so there's nothing to check against yet." };
  }
  return { topic, status: "unknown", text: "An education level or education preference is missing from one of your profiles." };
}

/* ------------------------------- Location & relocation ------------------------------- */
function locationCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Location";
  if (!has(me.country) || !has(them.country)) {
    return { topic, status: "unknown", text: "One of you hasn't shared where you live." };
  }
  const iMove = norm(me.willingToRelocate);
  const theyMove = norm(them.willingToRelocate);
  if (norm(me.country) === norm(them.country)) {
    if (has(me.city) && norm(me.city) === norm(them.city)) {
      return { topic, status: "aligned", text: `You both live in ${them.city}.` };
    }
    // Same country, different cities: sharing a country doesn't settle where you'd live, so this is
    // a practical thing to discuss rather than a plain "you both live in X".
    if (has(me.city) && has(them.city)) {
      if (iMove === "no" && theyMove === "yes") {
        return { topic, status: "discuss", text: `You live in ${me.city} and ${them.code} lives in ${them.city}. You're not planning to move and ${them.code} is open to relocating, so it's worth confirming whether settling in ${me.city} would work.` };
      }
      if (iMove === "yes" && theyMove === "no") {
        return { topic, status: "discuss", text: `You live in ${me.city} and ${them.code} lives in ${them.city}. ${them.code} isn't planning to move and you're open to relocating, so it's worth confirming whether settling in ${them.city} would work.` };
      }
      if (iMove === "no" && theyMove === "no") {
        return { topic, status: "discuss", text: `You live in ${me.city} (and aren't planning to move) and ${them.code} lives in ${them.city} (and isn't either), so it's worth discussing where you'd settle.` };
      }
      return { topic, status: "discuss", text: `You live in ${me.city} and ${them.code} lives in ${them.city}. You share a country, but it's worth clarifying which area you'd settle in.` };
    }
    return { topic, status: "aligned", text: `You both live in ${them.country}.` };
  }
  if (iMove === "yes" || theyMove === "yes") {
    return {
      topic,
      status: "aligned",
      text: `You live in different countries, and ${iMove === "yes" && theyMove === "yes" ? "you're both" : iMove === "yes" ? "you're" : `${them.code} is`} open to relocating.`,
    };
  }
  if (iMove === "maybe" || theyMove === "maybe") {
    return { topic, status: "discuss", text: "You live in different countries and relocation is a 'maybe', so it's worth discussing where you'd live." };
  }
  if (iMove === "no" && theyMove === "no") {
    return { topic, status: "discuss", text: "You live in different countries and neither of you is planning to relocate." };
  }
  return { topic, status: "unknown", text: "You live in different countries, and relocation plans are missing." };
}

/* ------------------------------------ Children ------------------------------------ */
function childrenCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Children";
  if (!has(me.wantsChildren) || !has(them.wantsChildren)) {
    return { topic, status: "unknown", text: "One of you hasn't said whether you'd like children." };
  }
  const a = no(me.wantsChildren) ? "no" : "yes";
  const b = no(them.wantsChildren) ? "no" : "yes";
  if (a === b) {
    return {
      topic,
      status: "aligned",
      text: a === "yes" ? "You're both hoping for children, in sha Allah." : "Neither of you is looking to have children.",
    };
  }
  return { topic, status: "discuss", text: "You've given different answers about wanting children." };
}

/* ------------------------------------ Heritage ------------------------------------ */
function heritageCheck(me: CompatSide, them: CompatSide): CompatItem | null {
  const topic = "Heritage";
  // Two members who both answered "Unsure" don't share a tribe.
  const sameTribe = has(me.tribe) && norm(me.tribe) !== "unsure" && norm(me.tribe) === norm(them.tribe);
  const sameRegion = has(me.ancestralRegion) && norm(me.ancestralRegion) === norm(them.ancestralRegion);
  if (sameTribe && sameRegion) return { topic, status: "aligned", text: `Same tribe (${them.tribe}) and ancestral region (${them.ancestralRegion}).` };
  if (sameTribe) return { topic, status: "aligned", text: `Same tribe: ${them.tribe}.` };
  if (sameRegion) return { topic, status: "aligned", text: `Same ancestral region: ${them.ancestralRegion}.` };
  // A different tribe/region isn't a concern in itself — don't list it as one.
  return null;
}

/* ------------------------------- Lifestyle: smoking & vaping ------------------------------- */
// Stored values are "Never" / "Occasionally" / "Regularly".
const usesHabit = (v: string | null) => {
  const n = norm(v);
  return n === "occasionally" || n === "regularly" || n === "socially" || n === "yes";
};
function habitDescription(side: CompatSide): string {
  const parts: string[] = [];
  if (usesHabit(side.smoking)) parts.push("smokes");
  if (usesHabit(side.vaping)) parts.push("vapes");
  return parts.length ? parts.join(" and ") : "does neither";
}
function lifestyleCheck(me: CompatSide, them: CompatSide): CompatItem | null {
  const topic = "Lifestyle";
  const haveAny = (has(me.smoking) || has(me.vaping)) && (has(them.smoking) || has(them.vaping));
  if (!haveAny) return null; // keep the result focused — don't add an "unknown" line for this
  const meUses = usesHabit(me.smoking) || usesHabit(me.vaping);
  const themUses = usesHabit(them.smoking) || usesHabit(them.vaping);
  if (meUses === themUses) {
    if (!meUses) return { topic, status: "aligned", text: "Neither of you smokes or vapes." };
    return { topic, status: "aligned", text: `You both ${habitDescription(me)}.` };
  }
  if (meUses) {
    return { topic, status: "discuss", text: `You ${habitDescription(me)} and ${them.code} does not. Worth checking how each of you feels about this.` };
  }
  return { topic, status: "discuss", text: `${them.code} ${habitDescription(them)} and you do not. Worth checking how each of you feels about this.` };
}

/* ------------------------------- Languages (shared only) ------------------------------- */
function languagesCheck(me: CompatSide, them: CompatSide): CompatItem | null {
  const topic = "Languages";
  const theirs = new Set(them.languages.map((l) => norm(l)).filter(Boolean));
  const shared = me.languages.filter((l) => theirs.has(norm(l)));
  if (shared.length === 0) return null; // speaking different languages isn't a concern in itself
  return { topic, status: "aligned", text: `You both speak ${joinList(shared)}.` };
}

/* ------------------------------- Interests (shared only) ------------------------------- */
function interestsCheck(me: CompatSide, them: CompatSide): CompatItem | null {
  const topic = "Interests";
  const theirs = new Set(openList(them.interests));
  const shared = openList(me.interests).filter((x) => theirs.has(x));
  if (shared.length < 2) return null; // one shared hobby is thin; different hobbies aren't a concern
  return { topic, status: "aligned", text: `You share a few interests, including ${joinList(shared.slice(0, 3))}.` };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** How prominent a topic is: the most consequential marriage considerations come first, so when we
 * cap "Where you align" / "Worth discussing" at three, the important findings are the ones kept. */
const TOPIC_PRIORITY: Record<string, number> = {
  "Marital history": 100,
  "Religious practice": 92,
  "Islamic background": 88,
  Children: 86,
  Salah: 80,
  Location: 74,
  Lifestyle: 68,
  "Age preferences": 55,
  Education: 50,
  Heritage: 30,
  Languages: 22,
  Interests: 16,
};
const byPriority = (a: CompatItem, b: CompatItem) =>
  (TOPIC_PRIORITY[b.topic] ?? 0) - (TOPIC_PRIORITY[a.topic] ?? 0);

export function buildCompatBreakdown(me: CompatSide, them: CompatSide): CompatBreakdown {
  const b: CompatBreakdown = { aligned: [], discuss: [], unknown: [] };
  const items = [
    ageCheck(me, them),
    maritalCheck(me, them),
    practiceCheck(me, them),
    salahCheck(me, them),
    methodologyCheck(me, them),
    childrenCheck(me, them),
    locationCheck(me, them),
    lifestyleCheck(me, them),
    educationCheck(me, them),
    heritageCheck(me, them),
    languagesCheck(me, them),
    interestsCheck(me, them),
  ];
  for (const item of items) if (item) pushItem(b, item);
  // Keep it focused and surface the most important findings first: up to three key alignments and
  // three discussion points, ordered by how much they matter. "Not enough information" is left whole
  // (the UI condenses it) so nothing missing is silently dropped.
  b.aligned = b.aligned.sort(byPriority).slice(0, 3);
  b.discuss = b.discuss.sort(byPriority).slice(0, 3);
  b.unknown = b.unknown.sort(byPriority);
  return b;
}

/** Bump when the rules or wording change, so cached AI summaries are rewritten from the new text. */
export const COMPAT_ENGINE_VERSION = 3;

/** Stable fingerprint of everything the breakdown depends on — the AI summary is regenerated
 * only when this changes (B28). */
export function compatFingerprint(me: CompatSide, them: CompatSide) {
  const pick = (s: CompatSide) =>
    [
      s.age, s.maritalStatus, s.hasChildren, s.wantsChildren, s.agePrefFrom, s.agePrefTo, s.acceptWidow,
      s.considerDivorcee, s.openTo, s.country, s.city, s.willingToRelocate, s.religiousPractice,
      s.religiousMethodology, s.salah, s.education, s.educationPref, s.tribe, s.ancestralRegion,
      s.smoking, s.vaping, s.languages.join(","), s.occupation, s.interests, s.livingArrangements,
      s.aboutMe, s.lookingFor,
    ].map((v) => (v == null ? "" : String(v).trim().toLowerCase()));
  const raw = JSON.stringify([COMPAT_ENGINE_VERSION, pick(me), pick(them)]);
  // djb2 — small, stable, no crypto needed (this is a cache key, not a secret).
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

type ProfileRowLike = {
  profile_code?: string | null;
  gender?: string | null;
  age?: number | null;
  marital_status?: string | null;
  has_children?: string | null;
  wants_children?: string | null;
  age_pref_from?: number | null;
  age_pref_to?: number | null;
  accept_widow?: string | null;
  consider_divorcee?: string | null;
  open_to?: string | null;
  country?: string | null;
  city?: string | null;
  willing_to_relocate?: string | null;
  relocate?: string | null;
  religious_practice?: string | null;
  religious_methodology?: string | null;
  salah_pattern?: string | null;
  education?: string | null;
  education_pref?: string | null;
  tribe?: string | null;
  ancestral_village?: string | null;
  traits?: string | null;
  occupation?: string | null;
  interests?: string | null;
  living_arrangements?: string | null;
  home_language?: string | null;
  about_me?: string | null;
  partner_preferences?: string | null;
};

/** Smoking / vaping / languages live in the `traits` JSON blob (see lib/profile parseExtras). */
function parseExtrasLite(raw?: string | null): { smoking?: string; vaping?: string; languages?: string[] } {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as { smoking?: string; vaping?: string; languages?: unknown };
    return {
      smoking: typeof j.smoking === "string" ? j.smoking : undefined,
      vaping: typeof j.vaping === "string" ? j.vaping : undefined,
      languages: Array.isArray(j.languages) ? (j.languages.filter((l) => typeof l === "string") as string[]) : undefined,
    };
  } catch {
    return {};
  }
}

export function compatSideFromProfile(p: ProfileRowLike, code?: string): CompatSide {
  const extras = parseExtrasLite(p.traits);
  return {
    code: code ?? p.profile_code ?? "They",
    gender: p.gender ?? null,
    age: p.age ?? null,
    maritalStatus: p.marital_status ?? null,
    hasChildren: p.has_children ?? null,
    wantsChildren: p.wants_children ?? null,
    agePrefFrom: p.age_pref_from ?? null,
    agePrefTo: p.age_pref_to ?? null,
    acceptWidow: p.accept_widow ?? null,
    considerDivorcee: p.consider_divorcee ?? null,
    openTo: p.open_to ?? null,
    country: p.country ?? null,
    city: p.city ?? null,
    willingToRelocate: p.willing_to_relocate ?? p.relocate ?? null,
    religiousPractice: p.religious_practice ?? null,
    religiousMethodology: p.religious_methodology ?? null,
    salah: p.salah_pattern ?? null,
    education: p.education ?? null,
    educationPref: p.education_pref ?? null,
    tribe: p.tribe ?? null,
    ancestralRegion: p.ancestral_village ?? null,
    smoking: extras.smoking ?? null,
    vaping: extras.vaping ?? null,
    languages: extras.languages ?? (p.home_language ? [p.home_language] : []),
    occupation: p.occupation ?? null,
    interests: p.interests ?? null,
    livingArrangements: p.living_arrangements ?? null,
    aboutMe: p.about_me ?? null,
    lookingFor: p.partner_preferences ?? null,
  };
}

/** Plain-language label for cards/lists (no percentages — B27). */
export function compatLabel(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score >= 80) return "Strong compatibility";
  if (score >= 65) return "Good compatibility";
  return null;
}
