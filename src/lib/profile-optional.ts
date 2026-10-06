/**
 * Optional "about you" extras that are filled in on Edit Profile only — never asked in signup:
 * Pashto dialect, a description of Islamic practice, interests and personality traits.
 * Shared by the form, the API (which only accepts values from these lists) and the profile view.
 */

export const PASHTO_DIALECTS = ["Kha", "Sha"] as const;

export const MAX_INTERESTS = 15;
export const ISLAMIC_PRACTICE_MAX = 1500;

export type Choice = { label: string; icon: string };

export const INTERESTS: Choice[] = [
  { label: "Quran reader", icon: "📖" },
  { label: "Masjid goer", icon: "🕌" },
  { label: "Islamic lectures", icon: "📚" },
  { label: "Islamic history", icon: "🏛️" },
  { label: "Deen & spirituality", icon: "🌙" },
  { label: "Dua & dhikr", icon: "🤲" },
  { label: "Attan", icon: "💃" },
  { label: "Pashto poetry", icon: "🪶" },
  { label: "Pashtun history", icon: "⛰️" },
  { label: "Hujra culture", icon: "🏠" },
  { label: "Chai gatherings", icon: "🍵" },
  { label: "Gym / fitness", icon: "🏋️" },
  { label: "Boxing", icon: "🥊" },
  { label: "MMA", icon: "🥋" },
  { label: "Wrestling", icon: "🤼" },
  { label: "Cricket", icon: "🏏" },
  { label: "Tennis", icon: "🎾" },
  { label: "Padel", icon: "🏓" },
  { label: "Badminton", icon: "🏸" },
  { label: "Hiking", icon: "🥾" },
  { label: "Camping", icon: "⛺" },
  { label: "Mountain lover", icon: "🏔️" },
  { label: "Nature lover", icon: "🌿" },
  { label: "Beaches", icon: "🏖️" },
  { label: "Coffee", icon: "☕" },
  { label: "Matcha", icon: "🍵" },
  { label: "Cooking", icon: "🍲" },
  { label: "Baking", icon: "🧁" },
  { label: "Gardening", icon: "🪴" },
  { label: "Crochet", icon: "🧶" },
  { label: "Sewing", icon: "🧵" },
  { label: "Reading", icon: "📘" },
  { label: "Writing", icon: "✍️" },
  { label: "Puzzles", icon: "🧩" },
  { label: "Painting", icon: "🎨" },
  { label: "Calligraphy", icon: "🖋️" },
  { label: "Tappay & folk music", icon: "🎵" },
  { label: "Gaming", icon: "🎮" },
  { label: "TV shows", icon: "📺" },
  { label: "Movies", icon: "🎬" },
  { label: "Technology", icon: "💻" },
  { label: "Museums", icon: "🖼️" },
  { label: "Animals", icon: "🐾" },
  { label: "Volunteering", icon: "🤝" },
];

/** Pashtunwali-flavoured values. */
export const PASHTUN_TRAITS: Choice[] = [
  { label: "Hospitable – Melmastia", icon: "🏠" },
  { label: "Keeps their word", icon: "🤝" },
  { label: "Family-centred", icon: "👨‍👩‍👧" },
  { label: "Respects elders", icon: "🧓" },
  { label: "Loyal", icon: "🛡️" },
  { label: "Community-minded", icon: "👥" },
  { label: "Values mashwara", icon: "💬" },
  { label: "Straight-talking", icon: "🗣️" },
  { label: "Generous", icon: "🎁" },
  { label: "Proud of their roots", icon: "⛰️" },
  { label: "Values modesty", icon: "🧕" },
  { label: "Principled / honour-minded", icon: "⚖️" },
  { label: "Protective of family", icon: "🛡️" },
  { label: "Traditional but open-minded", icon: "🌿" },
  { label: "Connected to ancestral homeland", icon: "🌍" },
  { label: "Wears kamees partug", icon: "👕" },
];

export const PERSONALITY_TRAITS: Choice[] = [
  { label: "Kind", icon: "❤️" },
  { label: "Loving", icon: "🥰" },
  { label: "Patient", icon: "🪷" },
  { label: "Calm", icon: "🌊" },
  { label: "Humorous", icon: "😄" },
  { label: "Honest", icon: "✅" },
  { label: "Ambitious", icon: "📈" },
  { label: "Hardworking", icon: "💼" },
  { label: "Good communicator", icon: "💬" },
  { label: "Good listener", icon: "🎧" },
  { label: "Thoughtful", icon: "🌱" },
  { label: "Easy-going", icon: "☀️" },
  { label: "Confident", icon: "👤" },
  { label: "Optimistic", icon: "⭐" },
  { label: "Adventurous", icon: "🧭" },
  { label: "Creative", icon: "🎨" },
  { label: "Independent", icon: "🏔️" },
];

const ALL_TRAITS = [...PASHTUN_TRAITS, ...PERSONALITY_TRAITS];

export function iconFor(label: string): string {
  return [...INTERESTS, ...ALL_TRAITS].find((c) => c.label === label)?.icon ?? "•";
}

/** Keep only known labels, de-duplicated, in the order given (capped when `max` is set). */
function pick(values: unknown, allowed: Choice[], max?: number): string[] {
  if (!Array.isArray(values)) return [];
  const known = new Set(allowed.map((c) => c.label));
  const out = [...new Set(values.filter((v): v is string => typeof v === "string" && known.has(v)))];
  return max ? out.slice(0, max) : out;
}

export const cleanInterests = (values: unknown) => pick(values, INTERESTS, MAX_INTERESTS);
export const cleanPersonality = (values: unknown) => pick(values, ALL_TRAITS);

export function isPashtoDialect(value: unknown): value is (typeof PASHTO_DIALECTS)[number] {
  return (PASHTO_DIALECTS as readonly unknown[]).includes(value);
}
