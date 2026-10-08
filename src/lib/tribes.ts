/**
 * The one tribe structure used everywhere (signup, Edit Profile, Browse filters, profile pills):
 * Confederacy → Tribe. A profile stores the tribe's standard name in `profiles.tribe`; the
 * confederacy (and its colour) always comes from this list, so it can never disagree with it.
 * Client-safe — no Prisma / Node deps.
 */

export type TribeTone = {
  /** Pastel fill — confederacy bar and tribe pill. */
  bg: string;
  border: string;
  text: string;
};

export type Confederacy = {
  id: string;
  label: string;
  tone: TribeTone;
  tribes: readonly string[];
};

export const CONFEDERACIES: readonly Confederacy[] = [
  {
    id: "sarbani",
    label: "Sarbani",
    tone: { bg: "#e2f5e0", border: "#c3e6bf", text: "#1b7a30" },
    tribes: ["Yusufzai", "Mohmand", "Shinwari", "Khalil", "Tareen", "Daudzai", "Chamkani", "Tarkalani", "Barech", "Sherani"],
  },
  {
    id: "bettani",
    label: "Bettani",
    tone: { bg: "#fdf1cf", border: "#f4dfa0", text: "#8a5a00" },
    tribes: ["Bettani", "Niazi", "Lodi", "Marwat", "Babar", "Gandapur", "Kundi"],
  },
  {
    id: "ghurghusht",
    label: "Ghurghusht",
    tone: { bg: "#f2e3d6", border: "#e3cbb6", text: "#7a4a21" },
    tribes: ["Kakar", "Mandokhel", "Musakhel", "Panri", "Safi", "Jadoon"],
  },
  {
    id: "ghilji",
    label: "Ghilji / Ghilzai",
    tone: { bg: "#ebe1fb", border: "#d6c5f4", text: "#5b2bb5" },
    tribes: ["Hotak", "Sulaiman Khel", "Kharoti", "Ali Khel", "Nasar", "Taraki"],
  },
  {
    id: "durrani",
    label: "Durrani / Abdali",
    tone: { bg: "#dcecfb", border: "#bcd9f4", text: "#1c5fa8" },
    tribes: ["Barakzai", "Popalzai", "Alikozai", "Achakzai", "Alizai", "Ishaqzai", "Noorzai", "Makozai", "Khogani", "Mastizai"],
  },
  {
    id: "karlani",
    label: "Karlani",
    tone: { bg: "#fde0e0", border: "#f6c2c2", text: "#b3202a" },
    tribes: ["Afridi", "Khattak", "Wazir", "Mehsud", "Orakzai", "Bangash", "Mangal", "Zadran", "Muqbil", "Zazi", "Khogyani", "Wardak", "Turi"],
  },
];

/** Selectable on its own (no confederacy) by members who don't know their tribe. */
export const UNSURE_TRIBE = "Unsure";

export const NEUTRAL_TRIBE_TONE: TribeTone = { bg: "#f4f2f1", border: "#e6e1df", text: "#3d3539" };

/** Common V1 / everyday spellings of a listed tribe. Keys are letters only, lower-case. */
const SPELLINGS: Record<string, string[]> = {
  Yusufzai: ["Yousafzai", "Yousufzai", "Yousafzi", "Yusafzai", "Yousefzai", "Yusufzay", "Usufzai", "Yusafzay", "Yousafzay"],
  Mohmand: ["Momand", "Mohmmand"],
  Shinwari: ["Shinwarai", "Shenwari"],
  Tareen: ["Tarin", "Tarean"],
  Tarkalani: ["Tarkani", "Tarklani", "Tarkanri"],
  Barech: ["Baraich", "Barechi"],
  Sherani: ["Shirani", "Sheerani"],
  Bettani: ["Bhittani", "Bitani", "Baitani", "Batani"],
  Niazi: ["Niazai", "Niyazi"],
  Lodi: ["Lodhi"],
  Gandapur: ["Gandapoor"],
  Kakar: ["Kakarr"],
  Mandokhel: ["Mando Khel", "Mandukhel"],
  Musakhel: ["Musa Khel", "Moosakhel"],
  Panri: ["Panni", "Parni"],
  Jadoon: ["Jadun", "Gadoon", "Gadun"],
  Hotak: ["Hotaki", "Hottak"],
  "Sulaiman Khel": ["Suleman Khel", "Suleiman Khel", "Sulemankhel", "Sulaimankhail", "Suleman Khail"],
  Kharoti: ["Kharotai", "Kharotay"],
  "Ali Khel": ["Alikhail", "Ali Khail"],
  Nasar: ["Nasir", "Naser"],
  Taraki: ["Tarakai", "Tarakay"],
  Barakzai: ["Barakzay", "Barekzai"],
  Popalzai: ["Popalzay", "Popolzai"],
  Alikozai: ["Alkozai", "Alokozai", "Alakozai", "Alekozai", "Alikozay"],
  Achakzai: ["Achakzay", "Achekzai"],
  Alizai: ["Alizay"],
  Ishaqzai: ["Ishakzai", "Eshaqzai", "Ishaqzay"],
  Noorzai: ["Nurzai", "Noorzay"],
  Afridi: ["Apridi", "Afridai", "Afreedi"],
  Khattak: ["Khatak", "Khattack"],
  Wazir: ["Waziri", "Wazeer"],
  Mehsud: ["Mahsud", "Mehsood", "Mahsood", "Masood", "Masud"],
  Orakzai: ["Orakzay", "Wrakzai", "Aurakzai"],
  Bangash: ["Bangakh", "Bangesh"],
  Zadran: ["Jadran", "Dzadran"],
  Muqbil: ["Muqbal", "Moqbil"],
  Zazi: ["Zazai", "Jaji", "Dzadzi", "Zazay"],
  Wardak: ["Wardag"],
  Turi: ["Tori"],
  [UNSURE_TRIBE]: ["Not sure", "Dont know", "Do not know", "Unknown"],
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const BY_NAME = new Map<string, { name: string; confederacy: Confederacy | null }>();
/** Standard names and known spellings → standard name. */
const BY_SPELLING = new Map<string, string>();
for (const c of CONFEDERACIES) {
  for (const name of c.tribes) BY_NAME.set(key(name), { name, confederacy: c });
}
BY_NAME.set(key(UNSURE_TRIBE), { name: UNSURE_TRIBE, confederacy: null });
for (const { name } of BY_NAME.values()) BY_SPELLING.set(key(name), name);
for (const [name, list] of Object.entries(SPELLINGS)) {
  for (const s of list) if (!BY_SPELLING.has(key(s))) BY_SPELLING.set(key(s), name);
}

/** The listed tribe (standard name + confederacy) for a stored value, or null if it isn't one. */
export function findTribe(value: string | null | undefined) {
  return BY_NAME.get(key(value ?? "")) ?? null;
}

/** True for a value the selector can produce: a listed tribe or "Unsure". */
export function isTribeChoice(value: string | null | undefined): boolean {
  return findTribe(value) !== null;
}

/** Standard name for a selector value ("yusufzai" → "Yusufzai"), or null. */
export function standardTribe(value: string | null | undefined): string | null {
  return findTribe(value)?.name ?? null;
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Match free text from V1 to a listed tribe — only when it's confident: the standard name, a
 * known spelling, or one letter away from exactly one tribe. Anything else (two tribes equally
 * close, an unlisted tribe, several tribes typed together) returns null — never a guess.
 */
export function matchTribe(raw: string | null | undefined): string | null {
  const k = key(raw ?? "");
  if (!k) return null;
  const exact = BY_SPELLING.get(k);
  if (exact) return exact;
  if (k.length < 5) return null;
  const close = new Set<string>();
  for (const [spelling, name] of BY_SPELLING) {
    if (name !== UNSURE_TRIBE && withinOneEdit(k, spelling)) close.add(name);
  }
  return close.size === 1 ? [...close][0] : null;
}

/** Colours for a tribe pill: the confederacy's pastel, neutral for anything unlisted. */
export function tribeTone(value: string | null | undefined): TribeTone {
  return findTribe(matchTribe(value))?.confederacy?.tone ?? NEUTRAL_TRIBE_TONE;
}

/**
 * What to show on a profile: the standard name when the stored value is (or confidently matches)
 * a listed tribe, the stored text otherwise, and nothing for "Unsure" / blank.
 */
export function tribeLabel(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const name = matchTribe(raw) ?? raw;
  return name === UNSURE_TRIBE ? null : name;
}

/** Every stored spelling that means this tribe — lets a filter also find not-yet-confirmed V1 rows. */
export function tribeSpellings(name: string): string[] {
  const standard = standardTribe(name);
  if (!standard) return [];
  return [standard, ...(SPELLINGS[standard] ?? [])];
}

/** Browse filter value ⇄ list. The filter is a comma-separated list of standard names. */
export function parseTribeList(value: string | null | undefined): string[] {
  const out: string[] = [];
  for (const part of (value ?? "").split(",")) {
    const name = standardTribe(part);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export function formatTribeList(names: string[]): string {
  return parseTribeList(names.join(",")).join(",");
}
