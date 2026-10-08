import { checkPassword } from "@/lib/password-strength";
import { isTribeChoice } from "@/lib/tribes";

export type SignupGender = "Brother" | "Sister";

export type SignupData = {
  gender: SignupGender | "";
  fullName: string;
  maritalStatus: string;
  dob: string;
  height: string;
  country: string;
  city: string;
  /** R04: true only once the city was picked from the real-place list. */
  cityConfirmed?: boolean;
  /** Google place id of the picked city — lets the server confirm it without re-searching. */
  cityPlaceId?: string;
  ancestralRegion: string;
  relocation: string;
  languages: string[];
  /** Standard tribe name from the Confederacy → Tribe selector, or "Unsure". */
  tribe: string;
  openTo: string[];
  hasChildren: string;
  willingChildren: string;
  religiousPractice: string;
  /** How regularly they pray (B08 filter + profile). */
  salah?: string;
  appearance: string[]; // men: 1, women: multi
  education: string;
  employment: string;
  occupation: string;
  smoking: string;
  vaping: string;
  about: string;
  lookingFor: string;
  photos: string[]; // up to 3 cropped data-URLs
  mainPhotoIndex: number;
  communicationMode: string;
  /** How well they speak Pashto — only asked when Pashto is among `languages`. */
  pashtoLevel: string;
  /** Dial code, e.g. "+44" — what is stored on the profile. */
  phoneCountry: string;
  /** ISO country picked for that dial code (US and Canada share +1). */
  phoneIso: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const emptySignupData = (): SignupData => ({
  gender: "",
  fullName: "",
  maritalStatus: "",
  dob: "",
  height: "",
  country: "",
  city: "",
  ancestralRegion: "",
  relocation: "",
  languages: [],
  tribe: "",
  openTo: [],
  hasChildren: "",
  willingChildren: "",
  religiousPractice: "",
  appearance: [],
  education: "",
  employment: "",
  occupation: "",
  smoking: "",
  vaping: "",
  about: "",
  lookingFor: "",
  photos: [],
  mainPhotoIndex: 0,
  communicationMode: "",
  pashtoLevel: "",
  phoneCountry: "+44",
  phoneIso: "GB",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
});

export type StepId =
  | "gender"
  | "name"
  | "marital"
  | "dob"
  | "height"
  | "location"
  | "roots"
  | "languages"
  | "tribe"
  | "openTo"
  | "family"
  | "faith"
  | "appearance"
  | "career"
  | "lifestyle"
  | "about"
  | "lookingFor"
  | "photo"
  | "commMode"
  | "phone"
  | "account"
  | "done";

export type StepDef = {
  id: StepId;
  title: string;
  subtitle?: string;
};

export function getSignupSteps(gender: SignupGender | ""): StepDef[] {
  const base: StepDef[] = [
    { id: "gender", title: "What's your gender?", subtitle: "This shapes your journey on Pashtun Nikah." },
    { id: "name", title: "What's your full name?", subtitle: "Enter your first and last name." },
    { id: "marital", title: "What is your marital status?" },
    { id: "dob", title: "What is your date of birth?", subtitle: "You must be 18 or over to use Pashtun Nikah." },
    { id: "height", title: "What's your height?" },
    { id: "location", title: "Where do you currently live?" },
    {
      id: "roots",
      title: "Where are your roots?",
      subtitle: "Ancestral region and whether you'd relocate.",
    },
    {
      id: "languages",
      title: "Which languages do you speak?",
      subtitle: "Select all that apply. If you speak Pashto, tell us your level too.",
    },
    {
      id: "tribe",
      title: "What is your tribe?",
      subtitle: "Open a confederacy to find your tribe, or search for it. Choose Unsure if you don't know.",
    },
    { id: "openTo", title: "Who are you open to?", subtitle: "Select all that apply." },
    { id: "family", title: "About children", subtitle: "Tell us about your current situation and future family plans." },
    { id: "faith", title: "How would you describe your practice?", subtitle: "Choose the option that best reflects your current practice." },
    {
      id: "appearance",
      title: gender === "Sister" ? "How do you usually dress?" : "What's your appearance?",
      subtitle:
        gender === "Sister" ? "Select what best describes you." : "Choose the option that best describes you.",
    },
    { id: "career", title: "Education & career", subtitle: "Highest qualification and employment." },
    { id: "lifestyle", title: "Health & lifestyle", subtitle: "Smoking and vaping habits." },
    {
      id: "about",
      title: "Tell us about yourself",
      subtitle: "This is the first thing people see. Be genuine.",
    },
    {
      id: "lookingFor",
      title: "What are you looking for in a spouse?",
      subtitle: "Be honest — this helps families find the right match.",
    },
    {
      id: "photo",
      title: "Add a genuine profile photo",
      subtitle: "Every photo is manually reviewed before approval.",
    },
  ];

  if (gender === "Sister") {
    base.push({
      id: "commMode",
      title: "How would you like to communicate?",
      subtitle: "Only one Communication Mode can be active.",
    });
  }

  base.push(
    {
      id: "phone",
      title: "What's your phone number?",
      subtitle: "Kept private — used only for account security.",
    },
    {
      id: "account",
      title: "Create your login",
      subtitle: "You'll use this email and password to sign in.",
    },
    {
      id: "done",
      title: "You're all set!",
      subtitle:
        "Your profile has been submitted for review. Our team usually verifies within 24 hours.",
    }
  );

  return base;
}

/** Marital histories a member can say they're open to — at least one is required. */
export const OPEN_TO_OPTIONS = ["Never married", "Divorced", "Annulled", "Widowed"] as const;

/** Keeps only current options, carrying over the old "Divorcees" label. */
export function normalizeOpenTo(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const mapped = values.map((v) => (v === "Divorcees" ? "Divorced" : v));
  return OPEN_TO_OPTIONS.filter((o) => mapped.includes(o));
}

export const LANGUAGES_ORDERED = [
  "Pashto",
  "English",
  "Hindko",
  "Urdu",
  "Punjabi",
  "Pothwari",
  "Arabic",
  "Spanish",
  "French",
  "Portuguese",
  "Dari",
  "Farsi",
  "German",
  "Italian",
  "Dutch",
  "Swedish",
  "Norwegian",
  "Turkish",
  "Somali",
  "Bengali",
  "Hindi",
  "Malay",
  "Indonesian",
  "Chinese",
  "Other",
] as const;

/** Highest qualification — signup, Edit Profile and the Browse filter all offer these. */
export const EDUCATION_OPTIONS = ["GCSEs", "A Levels", "Diploma", "Bachelor's", "Master's", "PhD", "Islamic Studies", "Other"] as const;

export const ANCESTRAL_REGIONS = [
  // Pakhtunkhwa (user-facing label — never "KP", see signup-wizard "Select region" option)
  "Peshawar",
  "Mardan",
  "Swat",
  "Swabi",
  "Nowshera",
  "Charsadda",
  "Kohat",
  "Bannu",
  "Dera Ismail Khan",
  "Abbottabad",
  "Mansehra",
  "Dir",
  "Chitral",
  "Buner",
  "Malakand",
  "Karak",
  "Hangu",
  "Lakki Marwat",
  "Tank",
  "Shangla",
  "Upper Dir",
  "Lower Dir",
  "Bajaur",
  "Mohmand",
  "Khyber",
  "Orakzai",
  "Kurram",
  "North Waziristan",
  "South Waziristan",
  "Attock",
  "Quetta",
  // Afghanistan
  "Kabul",
  "Kandahar",
  "Jalalabad",
  "Nangarhar",
  "Paktia",
  "Paktika",
  "Khost",
  "Ghazni",
  "Wardak",
  "Logar",
  "Helmand",
  "Herat",
  "Balkh",
  "Kunduz",
  "Baghlan",
  "Laghman",
  "Kunar",
  "Nuristan",
  "Other / Mixed",
] as const;

// Canonical country list lives in `@/lib/country`. Re-exported here in the `{flag, name}`
// shape the signup / profile forms already consume.
export { COUNTRIES } from "@/lib/country";

export const HEIGHTS = Array.from({ length: 44 }, (_, i) => {
  const totalIn = 56 + i;
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  const cm = Math.round(totalIn * 2.54);
  return `${ft}'${inch}" (${cm} cm)`;
});

export const MEN_APPEARANCE = [
  "Clean Shaven",
  "Stubble",
  "Short Beard",
  "Medium Beard",
  "Long Beard",
] as const;

// Sister appearance is two questions stored together in `appearance`: one head covering plus
// one or more dress styles. Values are comma-joined in the DB, so none may contain a comma.
export const WOMEN_HEAD_COVERING = [
  { v: "Does Not Wear Hijab", label: "Modest, no hijab", hint: "Modest clothing, no head covering" },
  { v: "Wears Hijab", label: "Wears hijab", hint: "Covers hair, wears hijab" },
  { v: "Wears Niqab", label: "Wears niqab", hint: "Covers face, wears niqab" },
] as const;

export const WOMEN_DRESS_STYLE = [
  { v: "Kamees Partug", label: "Kamees Partug", hint: "Traditional Pashtun dress" },
  { v: "Abaya / Jilbab", label: "Abaya / Jilbab", hint: "Loose, full-length dress" },
  { v: "Western Modest", label: "Western modest", hint: "Modest western clothing" },
  { v: "Traditional & Western Mix", label: "Mix of traditional & western", hint: "Both styles" },
] as const;

export const WOMEN_APPEARANCE = [...WOMEN_HEAD_COVERING, ...WOMEN_DRESS_STYLE].map((o) => o.v);

const inList = (list: readonly { v: string }[], values: string[]) =>
  values.filter((x) => list.some((o) => o.v === x));

/** Answers to "How well do you speak Pashto?" — shown only to members who select Pashto. */
export const PASHTO_LEVELS = ["None", "Basic", "Conversational", "Fluent"] as const;

export function isPashtoLevel(value: unknown): value is (typeof PASHTO_LEVELS)[number] {
  return (PASHTO_LEVELS as readonly unknown[]).includes(value);
}

/** Sister's chosen head covering (first valid one) and dress styles, ignoring retired values. */
export function splitWomenAppearance(values: string[]) {
  return {
    head: inList(WOMEN_HEAD_COVERING, values)[0] ?? "",
    dress: inList(WOMEN_DRESS_STYLE, values),
  };
}

// Niqab Mode and Wali-Only Mode were removed entirely (QA item 12) — only these two remain.
export const COMM_MODES = [
  {
    id: "standard",
    title: "Standard Conversation",
    blurb: "Private chat after matching. You control when to share or hide your photo.",
  },
  {
    id: "wali_oversight",
    title: "Wali Oversight",
    blurb: "Direct chat with wali oversight and optional notifications.",
  },
] as const;

/**
 * A word only counts when it reads like one: at least 2 letters, mostly letters, not a single
 * repeated character ("dddd") and no run of 3+ identical letters ("aaaah"). Single letters,
 * dashes, punctuation, numbers, symbols and emojis never count.
 */
function isMeaningfulWord(token: string): boolean {
  const letters = token.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return false;
  if (letters.length * 2 < [...token].length) return false;
  const lower = letters.join("").toLowerCase();
  if (new Set(lower).size === 1) return false;
  if (/(\p{L})\1\1/u.test(lower)) return false;
  return true;
}

/** The words of a text that count towards the minimum, lower-cased and trimmed of punctuation. */
export function meaningfulWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter(isMeaningfulWord)
    .map((w) => w.toLowerCase());
}

/** Meaningful words only — what the About Me / Looking For counters show. */
export function wordCount(text: string) {
  return meaningfulWords(text).length;
}

/** Salah answers — the same wording existing profiles already use, so the Salah filter keeps working. */
export const SALAH_OPTIONS = [
  "Consistently – I pray my 5 daily prayers without fail (unless missed due to legitimate Shar'i excuses e.g., menstrual cycle, missed alarm by accident)",
  "Almost always – I stay on top of my 5 daily prayers but have the occasional slip-up",
  "Regularly – I catch most of my prayers, though I might sometimes miss Fajr if I'm exhausted",
  "Sometimes – I pray on and off, usually when I find the time or when my iman is high",
  "Rarely – Mostly just Jumu'ah, Eid Salah, or during the holy month of Ramadan",
  "Never / One-offs – I do not pray consistently, or only on very isolated occasions",
] as const;

/** Short label for a Salah answer (text before the dash). */
export function salahShortLabel(v: string) {
  return v.split("–")[0].trim();
}

/** Everyday English words — genuine writing always contains plenty of these; keyboard-mash doesn't. */
const COMMON_WORDS = new Set(
  (
    "i me my myself we our us you your he him his she her they them their it its a an the and or but if so " +
    "because as of at by for with about to from in on into up out over after before than then there here " +
    "this that these those am is are was were be been being have has had do does did can could will would " +
    "should may might must not no yes very just also too more most much many some any all each every both " +
    "few other such only own same who whom which what when where why how family families life love like " +
    "looking look someone person people partner wife husband marriage married nikah deen islam islamic " +
    "muslim allah god faith pray prayer religious practising practicing value values kind caring honest " +
    "respect respectful good great well work working job study studying student time home live living " +
    "enjoy enjoys enjoying friends friend children kids parents mother father brother sister brothers " +
    "sisters want wants hope hoping believe important someone who share sharing love loves together " +
    "future inshallah insha alhamdulillah mashallah pashtun culture traditions tradition simple humble " +
    "calm down-to-earth easy going outgoing family-oriented also really lot things thing new day days year " +
    "years travel travelling reading cooking sports gym walks nature"
  ).split(/\s+/)
);

/**
 * About Me / Looking For quality check (signup + Edit Profile, client + server). Returns a
 * member-facing message, or null when the text is fine. Rejects too-short text, keyboard-mash
 * (almost no everyday words) and the same few words repeated.
 */
export function textQualityIssue(text: string, minWords = 30): string | null {
  const words = meaningfulWords(text);
  const n = words.length;
  if (n < minWords) return `Please write at least ${minWords} meaningful words (${n} so far).`;

  // The same word over and over: three times in a row, or one (non-everyday) word making up
  // too much of the text.
  for (let i = 2; i < words.length; i++) {
    if (words[i] === words[i - 1] && words[i] === words[i - 2]) {
      return "Please avoid repeating the same word — tell members a little more.";
    }
  }
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const cap = Math.max(3, Math.ceil(words.length * 0.1));
  for (const [w, c] of counts) {
    if (c > cap && !COMMON_WORDS.has(w)) {
      return "Please avoid repeating the same word — tell members a little more.";
    }
  }

  const common = words.filter((w) => COMMON_WORDS.has(w)).length;
  if (common / words.length < 0.25) {
    return "This doesn't look like real sentences yet — please describe yourself in your own words.";
  }
  const distinct = new Set(words).size;
  if (distinct / words.length < 0.35) return "Please avoid repeating the same words — tell members a little more.";
  return null;
}

/**
 * The career question follows the employment choice: workers are asked what they do, students
 * what they study (both mandatory); homemakers and the unemployed are not asked at all.
 */
export function occupationPrompt(employment: string): { label: string; placeholder: string } | null {
  if (employment === "Employed" || employment === "Self-employed") {
    return { label: "What do you do?", placeholder: "e.g. Software engineer" };
  }
  if (employment === "Student") {
    return { label: "What are you studying?", placeholder: "e.g. Medicine" };
  }
  return null;
}

/** Null when fine, otherwise why the career answer can't be accepted. */
export function occupationIssue(employment: string, occupation: string): string | null {
  const prompt = occupationPrompt(employment);
  if (!prompt) return null;
  return occupation.trim().length >= 2 ? null : `Please answer "${prompt.label}"`;
}

export function calcAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function isStepValid(id: StepId, data: SignupData): boolean {
  switch (id) {
    case "gender":
      return data.gender === "Brother" || data.gender === "Sister";
    case "name":
      return data.fullName.trim().length >= 2;
    case "marital":
      return Boolean(data.maritalStatus);
    case "dob": {
      const age = calcAge(data.dob);
      return age != null && age >= 18;
    }
    case "height":
      return Boolean(data.height);
    case "location":
      return Boolean(data.country && data.city.trim() && data.cityConfirmed);
    case "roots":
      return Boolean(data.ancestralRegion && data.relocation);
    case "languages":
      // The Pashto level is only asked (and only required) when Pashto is one of the languages.
      return data.languages.length > 0 && (!data.languages.includes("Pashto") || isPashtoLevel(data.pashtoLevel));
    case "tribe":
      return isTribeChoice(data.tribe);
    case "openTo":
      return data.openTo.length > 0;
    case "family":
      return Boolean(data.hasChildren && data.willingChildren);
    case "faith":
      return Boolean(data.religiousPractice && data.salah);
    case "appearance": {
      if (data.gender !== "Sister") return data.appearance.length > 0;
      const { head, dress } = splitWomenAppearance(data.appearance);
      return Boolean(head) && dress.length > 0;
    }
    case "career":
      return Boolean(data.education && data.employment) && !occupationIssue(data.employment, data.occupation);
    case "lifestyle":
      return Boolean(data.smoking && data.vaping);
    case "about":
      return textQualityIssue(data.about) === null;
    case "lookingFor":
      return textQualityIssue(data.lookingFor) === null;
    case "photo":
      return data.photos.length > 0;
    case "commMode":
      return Boolean(data.communicationMode);
    case "phone":
      return data.phone.replace(/\s/g, "").length >= 6;
    case "account":
      return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) &&
        checkPassword(data.password, data.email).ok &&
        data.password === data.confirmPassword
      );
    case "done":
      return true;
    default:
      return false;
  }
}
