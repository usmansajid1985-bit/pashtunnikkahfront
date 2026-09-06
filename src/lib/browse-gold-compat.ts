import type { RankableProfile } from "@/lib/ai-match";
import type { BrowseCardDTO } from "@/lib/browse-rank";
import {
  type CachedCompat,
  resolveGoldMatchScores,
  toCompatProfile,
  MAX_AI_COMPAT_COMPUTE_ON_BROWSE,
} from "@/lib/compatibility-cache";

type MeRow = Parameters<typeof toCompatProfile>[0];
type ProfileRow = {
  id: bigint;
  user_id: bigint;
  country: string | null;
  city: string | null;
  marital_status: string | null;
  religious_practice: string | null;
  ancestral_village: string | null;
  tribe: string | null;
  education: string | null;
  religious_methodology: string | null;
  dialect: string | null;
  willing_to_relocate: string | null;
  about_me: string | null;
  occupation: string | null;
};

/** Attach Gold compatibility % from cache + at most 2 new one-time Gemini scores. */
export async function applyGoldCompatToBrowseItems(
  viewerId: bigint,
  me: MeRow,
  items: BrowseCardDTO[],
  profiles: ProfileRow[],
  preloadedCache?: Map<string, CachedCompat>
): Promise<BrowseCardDTO[]> {
  const byId = new Map(profiles.map((p) => [p.id.toString(), p]));
  const peers: (RankableProfile & { userId: string })[] = items.map((p) => {
    const row = byId.get(p.id);
    return {
      id: p.id,
      userId: p.userId,
      country: row?.country ?? p.country,
      city: row?.city ?? p.city,
      marital_status: row?.marital_status ?? null,
      religious_practice: row?.religious_practice ?? null,
      ancestral_village: row?.ancestral_village ?? null,
      age: p.age,
      tribe: row?.tribe ?? null,
      education: row?.education ?? null,
      religious_methodology: row?.religious_methodology ?? null,
      dialect: row?.dialect ?? null,
      willing_to_relocate: row?.willing_to_relocate ?? null,
      about_me: p.aboutMe,
      occupation: p.occupation,
    };
  });

  const { scores: scoreMap, cache } = await resolveGoldMatchScores(
    viewerId,
    toCompatProfile(me),
    peers,
    MAX_AI_COMPAT_COMPUTE_ON_BROWSE,
    preloadedCache
  );
  return items.map((p) => ({
    ...p,
    matchScore: scoreMap.get(p.id),
    matchReasons: cache.get(p.userId)?.aiExplanation ?? undefined,
  }));
}
