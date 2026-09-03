import { prisma } from "@/lib/prisma";
import type { ProfileExtras } from "@/lib/profile";

/** Effective chat path after match (niqab uses its sub-mode). */
export type CommMode = "standard" | "wali_oversight" | "wali_only";

export type StoredCommMode = CommMode | "niqab" | "";

export function parseTraits(traits: string | null | undefined): ProfileExtras {
  if (!traits) return {};
  try {
    return JSON.parse(traits) as ProfileExtras;
  } catch {
    return {};
  }
}

export function effectiveCommMode(
  communicationMode?: string | null,
  niqabSubMode?: string | null
): CommMode {
  const mode = (communicationMode || "standard").toLowerCase();
  if (mode === "wali_only") return "wali_only";
  if (mode === "wali_oversight") return "wali_oversight";
  if (mode === "niqab") {
    const sub = (niqabSubMode || "standard").toLowerCase();
    if (sub === "wali_only") return "wali_only";
    if (sub === "wali_oversight") return "wali_oversight";
    return "standard";
  }
  return "standard";
}

export function allowsPrivateChat(mode: CommMode) {
  return mode !== "wali_only";
}

export function allowsPhotoShare(mode: CommMode) {
  return mode !== "wali_only";
}

/** Snapshot female member's mode onto a match (future mode changes won't affect this match). */
export async function resolveModeForMatch(senderId: bigint, receiverId: bigint): Promise<CommMode> {
  const profiles = await prisma.profiles.findMany({
    where: { user_id: { in: [senderId, receiverId] } },
    select: { user_id: true, gender: true, traits: true, phone: true, phone_country_code: true },
  });

  const female = profiles.find((p) => (p.gender || "").toLowerCase().startsWith("f"));
  if (!female) {
    // default if gender unclear
    const any = profiles[0];
    const extras = parseTraits(any?.traits);
    return effectiveCommMode(extras.communicationMode, extras.niqabSubMode);
  }
  const extras = parseTraits(female.traits);
  return effectiveCommMode(extras.communicationMode, extras.niqabSubMode);
}

export async function loadWaliContact(femaleUserId: bigint) {
  const profile = await prisma.profiles.findUnique({
    where: { user_id: femaleUserId },
    select: {
      id: true,
      phone: true,
      phone_country_code: true,
      full_name: true,
      profile_code: true,
    },
  });
  if (!profile) return null;

  const guardian = await prisma.profile_guardians.findUnique({
    where: { profile_id: profile.id },
  });

  const contact =
    guardian?.contact ||
    [profile.phone_country_code, profile.phone].filter(Boolean).join(" ").trim() ||
    null;

  return {
    name: guardian?.name || "Wali / guardian",
    contact,
    email: guardian?.email || null,
    notes: guardian?.notes || null,
    profileCode: profile.profile_code,
  };
}

export function femaleUserIdOfMatch(
  senderId: bigint,
  receiverId: bigint,
  genders: { userId: bigint; gender: string | null }[]
) {
  const senderG = genders.find((g) => g.userId === senderId)?.gender || "";
  const receiverG = genders.find((g) => g.userId === receiverId)?.gender || "";
  if (senderG.toLowerCase().startsWith("f")) return senderId;
  if (receiverG.toLowerCase().startsWith("f")) return receiverId;
  return null;
}

/**
 * Should the peer's photo be unblurred for the viewer?
 * - Own profile: based on photo_status (handled elsewhere)
 * - Browse / unmatched: always blurred
 * - Matched + photo_shared + mode allows share: visible
 */
export function peerPhotoVisible(opts: {
  matched: boolean;
  photoShared: boolean;
  mode: CommMode | string | null;
}) {
  if (!opts.matched) return false;
  const mode = effectiveCommMode(opts.mode, null);
  if (!allowsPhotoShare(mode)) return false;
  return Boolean(opts.photoShared);
}
