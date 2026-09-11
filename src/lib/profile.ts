import type { profiles, users } from "@/generated/prisma/client";
import { relocationLabel } from "@/lib/relocation";
import { displayHeight } from "@/lib/height";

export type ProfileExtras = {
  smoking?: string;
  vaping?: string;
  employment?: string;
  communicationMode?: string;
  openTo?: string[];
  languages?: string[];
  hasPhoto?: boolean;
};

export type ProfileView = {
  id: string;
  userId: string;
  profileCode: string;
  fullName: string;
  displayLabel: string;
  gender: string | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  build: string | null;
  city: string | null;
  country: string | null;
  maritalStatus: string | null;
  tribe: string | null;
  ethnicity: string | null;
  ancestralRegion: string | null;
  relocation: string | null;
  pashto: string | null;
  dialect: string | null;
  languages: string[];
  religiousPractice: string | null;
  islamicBackground: string | null;
  salah: string | null;
  bornMuslim: string | null;
  appearance: string[];
  hasChildren: string | null;
  willingChildren: string | null;
  education: string | null;
  occupation: string | null;
  employment: string | null;
  smoking: string | null;
  vaping: string | null;
  aboutMe: string | null;
  lookingFor: string | null;
  openTo: string[];
  interests: string[];
  photoStatus: string | null;
  photoUrl: string | null;
  communicationMode: string | null;
  status: string;
  isHidden: boolean;
  plan: string;
  hideGoldBadge: boolean;
  credits: number;
  email: string;
  phone: string | null;
  verified: boolean;
  completeness: number;
  checklist: { label: string; done: boolean; action?: "edit" | "review" }[];
  culturalVerified: boolean;
  avatarSeed: number;
};

function parseExtras(traits: string | null | undefined): ProfileExtras {
  if (!traits) return {};
  try {
    return JSON.parse(traits) as ProfileExtras;
  } catch {
    return {};
  }
}

function splitChips(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mapProfileView(
  profile: profiles,
  user: Pick<
    users,
    | "email"
    | "plan"
    | "requests_remaining"
    | "email_verified"
    | "cultural_verified"
    | "display_name"
  > & { hide_gold_badge?: boolean }
): ProfileView {
  const extras = parseExtras(profile.traits);
  const languages =
    extras.languages?.length
      ? extras.languages
      : splitChips(profile.home_language);

  const appearance = splitChips(profile.appearance);
  const openTo = extras.openTo?.length
    ? extras.openTo
    : splitChips(profile.open_to);
  const interests = splitChips(profile.interests);

  // Profile completeness = fields the member can finish in Edit.
  // Cultural verification is a separate admin/trust check — it must NOT block 100%.
  const checklist: ProfileView["checklist"] = [
    { label: "Basic account created", done: true, action: "edit" },
    {
      label: "Marriage preferences added",
      done: Boolean(profile.partner_preferences || profile.open_to || openTo.length),
      action: "edit",
    },
    {
      label: "Education & occupation",
      done: Boolean(profile.education && (profile.occupation || extras.employment)),
      action: "edit",
    },
    { label: "Religious practice", done: Boolean(profile.religious_practice), action: "edit" },
    {
      label: "Children & relocation details",
      done: Boolean(
        (profile.has_children || profile.wants_children) &&
          (profile.willing_to_relocate || profile.relocate || profile.ancestral_village)
      ),
      action: "edit",
    },
    {
      label: "Profile photo uploaded",
      done: Boolean(profile.photo_url || profile.photo_status || extras.hasPhoto),
      action: "edit",
    },
    {
      label: "About section",
      done: Boolean(profile.about_me && profile.about_me.trim().length >= 40),
      action: "edit",
    },
    {
      label: "Cultural verification",
      // PN's approval workflow is the cultural check — an approved profile is verified,
      // even if the standalone cultural_verified flag was never toggled in admin.
      done: Boolean(user.cultural_verified || profile.status === "approved"),
      action: "review",
    },
  ];

  const fillable = checklist.filter((c) => c.action !== "review");
  const doneCount = fillable.filter((c) => c.done).length;
  const completeness = Math.round((doneCount / fillable.length) * 100);

  const code = profile.profile_code || "Member";
  const name = profile.full_name || user.display_name || code;

  return {
    id: profile.id.toString(),
    userId: profile.user_id.toString(),
    profileCode: code,
    fullName: name,
    displayLabel: name,
    gender: profile.gender,
    age: profile.age,
    height: displayHeight(profile.height_cm, profile.height),
    weight: profile.weight,
    build: profile.build,
    city: profile.city,
    country: profile.country,
    maritalStatus: profile.marital_status,
    tribe: profile.tribe,
    ethnicity: profile.ethnicity,
    ancestralRegion: profile.ancestral_village,
    relocation: relocationLabel(profile.willing_to_relocate || profile.relocate),
    pashto: profile.pashto_level || profile.pashto_speaker,
    dialect: profile.dialect,
    languages,
    religiousPractice: profile.religious_practice,
    islamicBackground: profile.religious_methodology,
    salah: profile.salah_pattern,
    bornMuslim: profile.born_muslim || profile.practicing_since,
    appearance,
    hasChildren: profile.has_children,
    willingChildren: profile.wants_children,
    education: profile.education,
    occupation: profile.occupation,
    employment: extras.employment || null,
    smoking: extras.smoking || null,
    vaping: extras.vaping || null,
    aboutMe: profile.about_me,
    lookingFor: profile.partner_preferences,
    openTo,
    interests,
    photoStatus: profile.photo_status,
    photoUrl: profile.photo_url || null,
    communicationMode: extras.communicationMode || null,
    status: profile.status,
    isHidden: profile.is_hidden,
    plan: (user.plan || "basic").toLowerCase(),
    hideGoldBadge: Boolean(user.hide_gold_badge),
    credits: user.requests_remaining ?? 0,
    email: user.email,
    phone: profile.phone,
    verified: Boolean(user.email_verified || user.cultural_verified || profile.status === "approved"),
    culturalVerified: Boolean(user.cultural_verified || profile.status === "approved"),
    completeness,
    checklist,
    avatarSeed: Number(profile.id % 70n),
  };
}

export function statusLabel(status: string) {
  switch (status) {
    case "approved":
      return "Profile Approved";
    case "pending":
      return "Awaiting approval";
    case "rejected":
      return "Needs changes";
    case "suspended":
      return "Suspended";
    default:
      return status;
  }
}
