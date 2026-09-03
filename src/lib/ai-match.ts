import { geminiJson } from "@/lib/gemini";
import { compatScore, type CompatProfile } from "@/lib/requests-hub-shared";

export type RankableProfile = CompatProfile & {
  id: string;
  about_me?: string | null;
  occupation?: string | null;
};

type RankResult = { id: string; score: number };

export function attachHeuristicScores<T extends RankableProfile>(me: CompatProfile | null, peers: T[]) {
  return peers.map((p) => ({ ...p, matchScore: compatScore(me, p) }));
}

/** Single pair — small Gemini call (~500–900 tokens). Used once per viewer/candidate, then cached. */
export async function scorePairWithGeminiDetailed(
  me: CompatProfile,
  peer: RankableProfile
): Promise<{ score: number | null; reasons: string[] }> {
  const result = await geminiJson<{ score?: number; reasons?: string[] }>({
    timeoutMs: 3500,
    system:
      'You score one Pashtun Nikah (Islamic matrimony) match for compatibility 32–99. Prefer shared country/city, faith practice, tribe, education, similar age, sincere about-me overlap. Never use appearance or photos. Return JSON only: {"score": number, "reasons": ["2-3 short bullet strings explaining why they match"]}.',
    user: JSON.stringify({
      seeker: {
        age: me.age,
        country: me.country,
        city: me.city,
        marital_status: me.marital_status,
        religious_practice: me.religious_practice,
        religious_methodology: me.religious_methodology,
        tribe: me.tribe,
        education: me.education,
        dialect: me.dialect,
        ancestral_village: me.ancestral_village,
        relocate: me.willing_to_relocate,
      },
      candidate: {
        age: peer.age,
        country: peer.country,
        city: peer.city,
        marital_status: peer.marital_status,
        religious_practice: peer.religious_practice,
        religious_methodology: peer.religious_methodology,
        tribe: peer.tribe,
        education: peer.education,
        dialect: peer.dialect,
        ancestral_village: peer.ancestral_village,
        occupation: peer.occupation,
        about: (peer.about_me || "").slice(0, 220),
      },
    }),
  });
  const score = result?.score;
  const reasons = Array.isArray(result?.reasons)
    ? result!.reasons!.map((r) => String(r).trim()).filter(Boolean).slice(0, 3)
    : [];
  return {
    score: score != null && Number.isFinite(Number(score)) ? Number(score) : null,
    reasons,
  };
}

export async function scorePairWithGemini(
  me: CompatProfile,
  peer: RankableProfile
): Promise<number | null> {
  const { score } = await scorePairWithGeminiDetailed(me, peer);
  return score;
}

/** @deprecated Prefer resolveGoldMatchScores (cached one-time pair scores). */
export async function rankMatchesWithGemini<T extends RankableProfile>(
  me: CompatProfile | null,
  peers: T[]
): Promise<(T & { matchScore: number })[]> {
  const withHeuristic = attachHeuristicScores(me, peers);
  if (!me || peers.length < 2) return withHeuristic;

  const ranked = await geminiJson<{ rankings?: RankResult[] }>({
    timeoutMs: 2500,
    system:
      'You rank Pashtun Nikah (Islamic matrimony) profiles for compatibility. Prefer shared country/city, faith practice, tribe, education, similar age, and sincere about-me overlap. Never use appearance or photos. Return JSON only: {"rankings":[{"id":"string","score":0-100}]} with every candidate id.',
    user: JSON.stringify({
      seeker: {
        age: me.age,
        country: me.country,
        city: me.city,
        marital_status: me.marital_status,
        religious_practice: me.religious_practice,
        religious_methodology: me.religious_methodology,
        tribe: me.tribe,
        education: me.education,
        dialect: me.dialect,
        ancestral_village: me.ancestral_village,
        relocate: me.willing_to_relocate,
      },
      candidates: peers.map((p) => ({
        id: p.id,
        age: p.age,
        country: p.country,
        city: p.city,
        marital_status: p.marital_status,
        religious_practice: p.religious_practice,
        religious_methodology: p.religious_methodology,
        tribe: p.tribe,
        education: p.education,
        dialect: p.dialect,
        ancestral_village: p.ancestral_village,
        occupation: p.occupation,
        about: (p.about_me || "").slice(0, 220),
      })),
    }),
  });

  const map = new Map((ranked?.rankings || []).map((r) => [String(r.id), Number(r.score)]));
  if (map.size === 0) return withHeuristic;

  return withHeuristic
    .map((p) => {
      const ai = map.get(p.id);
      const matchScore =
        ai != null && Number.isFinite(ai)
          ? Math.round(Math.min(99, Math.max(32, ai * 0.7 + p.matchScore * 0.3)))
          : p.matchScore;
      return { ...p, matchScore };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function applyMatchScores<T extends { id: { toString(): string } }>(
  profiles: T[],
  ranked: { id: string; matchScore: number }[],
  reorder: boolean
) {
  const score = new Map(ranked.map((r) => [r.id, r.matchScore]));
  const list = reorder
    ? [...profiles].sort((a, b) => (score.get(b.id.toString()) ?? 0) - (score.get(a.id.toString()) ?? 0))
    : profiles;
  return list.map((p) => ({ profile: p, matchScore: score.get(p.id.toString()) }));
}
