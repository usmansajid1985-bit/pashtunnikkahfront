export type SignupGender = "Brother" | "Sister";

export type SignupData = {
  gender: SignupGender | "";
  fullName: string;
  maritalStatus: string;
  dob: string;
  height: string;
  country: string;
  city: string;
  ancestralRegion: string;
  relocation: string;
  languages: string[];
  openTo: string[];
  hasChildren: string;
  willingChildren: string;
  religiousPractice: string;
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
  phoneCountry: string;
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
  phoneCountry: "+44",
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
      subtitle: "Pashto first — select all that apply.",
    },
    { id: "openTo", title: "Who are you open to?", subtitle: "Select all that apply." },
    { id: "family", title: "About children", subtitle: "Help families understand your situation." },
    { id: "faith", title: "How would you describe your practice?", subtitle: "Be honest — faith matters here." },
    {
      id: "appearance",
      title: gender === "Sister" ? "How do you dress / present?" : "What's your appearance?",
      subtitle: gender === "Sister" ? "You can select more than one." : "Choose one.",
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

export const WOMEN_APPEARANCE = [
  "Does Not Wear Hijab",
  "Modest",
  "Wears Hijab",
  "Wears Niqab",
  "Kamees Partug",
] as const;

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

export function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
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
      return Boolean(data.country && data.city.trim());
    case "roots":
      return Boolean(data.ancestralRegion && data.relocation);
    case "languages":
      return data.languages.length > 0;
    case "openTo":
      return true;
    case "family":
      return Boolean(data.hasChildren && data.willingChildren);
    case "faith":
      return Boolean(data.religiousPractice);
    case "appearance":
      return data.appearance.length > 0;
    case "career":
      return Boolean(data.education && data.employment);
    case "lifestyle":
      return Boolean(data.smoking && data.vaping);
    case "about":
      return wordCount(data.about) >= 30;
    case "lookingFor":
      return wordCount(data.lookingFor) >= 30;
    case "photo":
      return data.photos.length > 0;
    case "commMode":
      return Boolean(data.communicationMode);
    case "phone":
      return data.phone.replace(/\s/g, "").length >= 6;
    case "account":
      return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()) &&
        data.password.length >= 8 &&
        data.password === data.confirmPassword
      );
    case "done":
      return true;
    default:
      return false;
  }
}
