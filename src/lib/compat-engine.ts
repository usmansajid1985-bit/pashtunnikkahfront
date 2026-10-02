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
    else if (mine.open === null) unknown.push(`${them.code} is ${mine.needed} — you haven't said whether you'd consider this`);
  }
  if (theirs.needed) {
    if (theirs.open === false) discuss.push(`you're ${theirs.needed}, and ${them.code}'s preferences say they're not considering this`);
    else if (theirs.open === null) unknown.push(`you're ${theirs.needed} — ${them.code} hasn't said whether they'd consider this`);
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
      text: `Similar levels of practice — you: ${me.religiousPractice!.toLowerCase()}, ${them.code}: ${them.religiousPractice!.toLowerCase()}.`,
    };
  }
  return {
    topic,
    status: "discuss",
    text: `Different levels of practice — you: ${me.religiousPractice!.toLowerCase()}, ${them.code}: ${them.religiousPractice!.toLowerCase()}. Worth talking about what each of you expects.`,
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
    text: `Different backgrounds — you: ${me.religiousMethodology}, ${them.code}: ${them.religiousMethodology}.`,
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
      text: a === b ? `You both pray ${salahShort(me.salah!)}.` : `Similar prayer habits — you: ${salahShort(me.salah!)}, ${them.code}: ${salahShort(them.salah!)}.`,
    };
  }
  return {
    topic,
    status: "discuss",
    text: `Different prayer habits — you: ${salahShort(me.salah!)}, ${them.code}: ${salahShort(them.salah!)}.`,
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
  return { topic, status: "unknown", text: "Education or education preferences are missing from one of your profiles." };
}

/* ------------------------------- Location & relocation ------------------------------- */
function locationCheck(me: CompatSide, them: CompatSide): CompatItem {
  const topic = "Location";
  if (!has(me.country) || !has(them.country)) {
    return { topic, status: "unknown", text: "One of you hasn't shared where you live." };
  }
  if (norm(me.country) === norm(them.country)) {
    if (has(me.city) && norm(me.city) === norm(them.city)) {
      return { topic, status: "aligned", text: `You both live in ${them.city}.` };
    }
    return { topic, status: "aligned", text: `You both live in ${them.country}.` };
  }
  const iMove = norm(me.willingToRelocate);
  const theyMove = norm(them.willingToRelocate);
  if (iMove === "yes" || theyMove === "yes") {
    return {
      topic,
      status: "aligned",
      text: `You live in different countries, and ${iMove === "yes" && theyMove === "yes" ? "you're both" : iMove === "yes" ? "you're" : `${them.code} is`} open to relocating.`,
    };
  }
  if (iMove === "maybe" || theyMove === "maybe") {
    return { topic, status: "discuss", text: "You live in different countries and relocation is a 'maybe' — worth discussing where you'd live." };
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
  const sameTribe = has(me.tribe) && norm(me.tribe) === norm(them.tribe);
  const sameRegion = has(me.ancestralRegion) && norm(me.ancestralRegion) === norm(them.ancestralRegion);
  if (sameTribe && sameRegion) return { topic, status: "aligned", text: `Same tribe (${them.tribe}) and ancestral region (${them.ancestralRegion}).` };
  if (sameTribe) return { topic, status: "aligned", text: `Same tribe: ${them.tribe}.` };
  if (sameRegion) return { topic, status: "aligned", text: `Same ancestral region: ${them.ancestralRegion}.` };
  // A different tribe/region isn't a concern in itself — don't list it as one.
  return null;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
    educationCheck(me, them),
    heritageCheck(me, them),
  ];
  for (const item of items) if (item) pushItem(b, item);
  return b;
}

/** Bump when the rules or wording change, so cached AI summaries are rewritten from the new text. */
export const COMPAT_ENGINE_VERSION = 2;

/** Stable fingerprint of everything the breakdown depends on — the AI summary is regenerated
 * only when this changes (B28). */
export function compatFingerprint(me: CompatSide, them: CompatSide) {
  const pick = (s: CompatSide) =>
    [
      s.age, s.maritalStatus, s.hasChildren, s.wantsChildren, s.agePrefFrom, s.agePrefTo, s.acceptWidow,
      s.considerDivorcee, s.openTo, s.country, s.city, s.willingToRelocate, s.religiousPractice,
      s.religiousMethodology, s.salah, s.education, s.educationPref, s.tribe, s.ancestralRegion,
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
};

export function compatSideFromProfile(p: ProfileRowLike, code?: string): CompatSide {
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
  };
}

/** Plain-language label for cards/lists (no percentages — B27). */
export function compatLabel(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score >= 80) return "Strong compatibility";
  if (score >= 65) return "Good compatibility";
  return null;
}
