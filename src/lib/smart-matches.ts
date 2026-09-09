import { after } from "next/server";
import { DEFAULT_FILTERS, buildProfileWhere } from "@/lib/browse-filters";
import { BROWSE_PROFILE_SELECT, rankBrowseProfiles } from "@/lib/browse-rank";
import {
  MAX_SMART_MATCHES_COMPUTE,
  resolveSmartMatchBatch,
  toCompatProfile,
} from "@/lib/compatibility-cache";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/blocking";

export const SMART_MATCHES_POOL = 50;
export const SMART_MATCHES_SHOW = 12;

export type SmartMatchItem = {
  id: string;
  userId: string;
  profileCode: string | null;
  age: number | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  aboutMe: string | null;
  avatarSeed: number;
  photoUrl: string | null;
  online: boolean;
  lastSeenLabel: string;
  score: number;
  reasons: string[];
};

export async function loadSmartMatches(viewerId: bigint): Promise<{
  isGold: boolean;
  items: SmartMatchItem[];
} | null> {
  const [meUser, me] = await Promise.all([
    prisma.users.findUnique({ where: { id: viewerId }, select: { plan: true } }),
    prisma.profiles.findUnique({
      where: { user_id: viewerId },
      select: {
        gender: true,
        country: true,
        city: true,
        age: true,
        marital_status: true,
        religious_practice: true,
        religious_methodology: true,
        tribe: true,
        education: true,
        dialect: true,
        ancestral_village: true,
        willing_to_relocate: true,
      },
    }),
  ]);

  if (!me) return null;
  const isGold = (meUser?.plan ?? "").toLowerCase() === "gold";
  if (!isGold) return { isGold: false, items: [] };

  const where = buildProfileWhere(DEFAULT_FILTERS, {
    excludeUserId: viewerId,
    excludeUserIds: await blockedUserIds(viewerId),
    viewerGender: me.gender,
    isGold: true,
  });

  const profiles = await prisma.profiles.findMany({
    where,
    orderBy: { users: { last_seen_at: "desc" } },
    take: SMART_MATCHES_POOL,
    select: BROWSE_PROFILE_SELECT,
  });

  const ranked = await rankBrowseProfiles(viewerId, profiles);
  const pool = ranked.slice(0, SMART_MATCHES_POOL);
  const byId = new Map(profiles.map((p) => [p.id.toString(), p]));

  const peers = pool.map((card) => {
    const row = byId.get(card.id);
    return {
      id: card.id,
      userId: card.userId,
      country: row?.country ?? card.country,
      city: row?.city ?? card.city,
      marital_status: row?.marital_status ?? null,
      religious_practice: row?.religious_practice ?? null,
      ancestral_village: row?.ancestral_village ?? null,
      age: card.age,
      tribe: row?.tribe ?? null,
      education: row?.education ?? null,
      religious_methodology: row?.religious_methodology ?? null,
      dialect: row?.dialect ?? null,
      willing_to_relocate: row?.willing_to_relocate ?? null,
      about_me: card.aboutMe,
      occupation: card.occupation,
    };
  });

  // Render path never blocks on Gemini — show cached AI scores + heuristic for the
  // rest. Missing pair scores are computed after the response is flushed and are
  // ready on the next visit (they cache permanently once computed).
  const compatMe = toCompatProfile(me);
  const scores = await resolveSmartMatchBatch(viewerId, compatMe, peers, 0);

  after(async () => {
    try {
      await resolveSmartMatchBatch(viewerId, compatMe, peers, MAX_SMART_MATCHES_COMPUTE);
    } catch {
      // best-effort cache warming
    }
  });

  const items: SmartMatchItem[] = pool
    .map((card) => {
      const compat = scores.get(card.userId);
      return {
        id: card.id,
        userId: card.userId,
        profileCode: card.profileCode,
        age: card.age,
        country: card.country,
        city: card.city,
        occupation: card.occupation,
        aboutMe: card.aboutMe,
        avatarSeed: card.avatarSeed,
        photoUrl: card.photoUrl,
        online: card.online,
        lastSeenLabel: card.lastSeenLabel,
        score: compat?.score ?? card.matchScore ?? 0,
        reasons: compat?.reasons ?? [],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, SMART_MATCHES_SHOW);

  return { isGold: true, items };
}
