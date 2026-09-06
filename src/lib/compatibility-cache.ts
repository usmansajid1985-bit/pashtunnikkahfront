import { attachHeuristicScores, scorePairWithGeminiDetailed, type RankableProfile } from "@/lib/ai-match";
import { ensureCompatibilityCacheSchema } from "@/lib/ensure-compatibility-cache";
import { hasGeminiKey } from "@/lib/gemini";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { compatScore, type CompatProfile } from "@/lib/requests-hub-shared";

/** Max new Gemini pair-scores per Browse request (cost guard). Browse uses 0 — cache/heuristic only. */
export const MAX_AI_COMPAT_COMPUTE_PER_REQUEST = 2;

/** Browse SSR/API: never block on Gemini; scores fill in when opening profiles or scrolling back. */
export const MAX_AI_COMPAT_COMPUTE_ON_BROWSE = 0;

/** Smart Matches hub: compute more per page load. */
export const MAX_SMART_MATCHES_COMPUTE = 5;

export type CachedCompat = {
  candidateUserId: string;
  heuristicScore: number;
  aiScore: number | null;
  finalScore: number;
  aiComputed: boolean;
  aiExplanation: string[] | null;
};

function blendScore(heuristic: number, ai: number) {
  return Math.round(Math.min(99, Math.max(32, ai * 0.7 + heuristic * 0.3)));
}

function parseExplanation(raw: unknown): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.map((r) => String(r).trim()).filter(Boolean).slice(0, 3);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((r) => String(r).trim()).filter(Boolean).slice(0, 3);
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function loadCompatibilityCache(
  viewerId: bigint,
  candidateUserIds: bigint[]
): Promise<Map<string, CachedCompat>> {
  if (candidateUserIds.length === 0) return new Map();
  await ensureCompatibilityCacheSchema();

  const wanted = new Set(candidateUserIds.map((id) => id.toString()));
  if (wanted.size === 0) return new Map();

  const rows = await prisma.$queryRaw<
    {
      candidate_user_id: bigint;
      heuristic_score: number;
      ai_score: number | null;
      final_score: number;
      ai_computed_at: Date | null;
      ai_explanation: unknown;
    }[]
  >`
    SELECT candidate_user_id, heuristic_score, ai_score, final_score, ai_computed_at, ai_explanation
    FROM compatibility_cache
    WHERE viewer_id = ${viewerId}
      AND candidate_user_id IN (${Prisma.join(candidateUserIds)})
  `.catch(() => [] as {
    candidate_user_id: bigint;
    heuristic_score: number;
    ai_score: number | null;
    final_score: number;
    ai_computed_at: Date | null;
    ai_explanation: unknown;
  }[]);

  return new Map(
    rows
      .filter((r) => wanted.has(r.candidate_user_id.toString()))
      .map((r) => [
        r.candidate_user_id.toString(),
        {
          candidateUserId: r.candidate_user_id.toString(),
          heuristicScore: r.heuristic_score,
          aiScore: r.ai_score,
          finalScore: r.final_score,
          aiComputed: r.ai_computed_at != null,
          aiExplanation: parseExplanation(r.ai_explanation),
        },
      ])
  );
}

async function upsertCompatibilityCache(opts: {
  viewerId: bigint;
  candidateUserId: bigint;
  heuristicScore: number;
  aiScore: number | null;
  finalScore: number;
  aiAttempted: boolean;
  aiExplanation?: string[] | null;
}) {
  await ensureCompatibilityCacheSchema();
  const now = new Date();
  const explanationJson = opts.aiExplanation?.length
    ? JSON.stringify(opts.aiExplanation)
    : null;

  await prisma.$executeRaw`
    INSERT INTO compatibility_cache (
      viewer_id, candidate_user_id, heuristic_score, ai_score, final_score,
      ai_computed_at, ai_explanation, created_at, updated_at
    )
    VALUES (
      ${opts.viewerId},
      ${opts.candidateUserId},
      ${opts.heuristicScore},
      ${opts.aiScore},
      ${opts.finalScore},
      ${opts.aiAttempted ? now : null},
      ${explanationJson}::jsonb,
      ${now},
      ${now}
    )
    ON CONFLICT (viewer_id, candidate_user_id)
    DO UPDATE SET
      heuristic_score = EXCLUDED.heuristic_score,
      ai_score = CASE
        WHEN compatibility_cache.ai_computed_at IS NOT NULL THEN compatibility_cache.ai_score
        ELSE EXCLUDED.ai_score
      END,
      final_score = CASE
        WHEN compatibility_cache.ai_computed_at IS NOT NULL THEN compatibility_cache.final_score
        WHEN EXCLUDED.ai_score IS NOT NULL THEN EXCLUDED.final_score
        ELSE EXCLUDED.heuristic_score
      END,
      ai_explanation = CASE
        WHEN compatibility_cache.ai_computed_at IS NOT NULL THEN compatibility_cache.ai_explanation
        ELSE EXCLUDED.ai_explanation
      END,
      ai_computed_at = COALESCE(compatibility_cache.ai_computed_at, EXCLUDED.ai_computed_at),
      updated_at = ${now}
  `.catch(() => undefined);
}

export type ComputeCompatResult = {
  finalScore: number;
  reasons: string[];
};

/**
 * One-time Gemini score for a viewer ↔ candidate pair. Never called again once cached.
 */
export async function computeCompatibilityOnce(
  viewerId: bigint,
  me: CompatProfile,
  peer: RankableProfile & { userId: string },
  preloaded?: CachedCompat | null
): Promise<ComputeCompatResult> {
  const candidateUserId = BigInt(peer.userId);
  const existing =
    preloaded !== undefined
      ? preloaded
      : (await loadCompatibilityCache(viewerId, [candidateUserId])).get(peer.userId);
  if (existing?.aiComputed) {
    return {
      finalScore: existing.finalScore,
      reasons: existing.aiExplanation ?? [],
    };
  }

  const heuristic = compatScore(me, peer);
  let aiScore: number | null = null;
  let reasons: string[] = [];
  let finalScore = heuristic;

  if (hasGeminiKey()) {
    const ai = await scorePairWithGeminiDetailed(me, peer);
    if (ai.score != null && Number.isFinite(ai.score)) {
      aiScore = Math.round(Math.min(99, Math.max(32, ai.score)));
      reasons = ai.reasons;
      finalScore = blendScore(heuristic, aiScore);
    }
  }

  await upsertCompatibilityCache({
    viewerId,
    candidateUserId,
    heuristicScore: heuristic,
    aiScore,
    finalScore,
    aiAttempted: true,
    aiExplanation: reasons,
  });

  return { finalScore, reasons };
}

export async function getCachedCompatDetail(viewerId: bigint, candidateUserId: bigint) {
  const cache = await loadCompatibilityCache(viewerId, [candidateUserId]);
  const row = cache.get(candidateUserId.toString());
  if (!row) return null;
  return {
    score: row.finalScore,
    reasons: row.aiExplanation ?? [],
    aiComputed: row.aiComputed,
  };
}

/**
 * Gold Browse: use cached AI score when present; heuristic until first compute;
 * compute at most MAX_AI_COMPAT_COMPUTE_PER_REQUEST new pairs per request.
 */
export async function resolveGoldMatchScores(
  viewerId: bigint,
  me: CompatProfile,
  peers: (RankableProfile & { userId: string })[],
  maxCompute = MAX_AI_COMPAT_COMPUTE_PER_REQUEST,
  preloadedCache?: Map<string, CachedCompat>
): Promise<{ scores: Map<string, number>; cache: Map<string, CachedCompat> }> {
  const heuristicScored = attachHeuristicScores(me, peers);
  const candidateIds = peers.map((p) => BigInt(p.userId));
  const cache =
    preloadedCache ?? (await loadCompatibilityCache(viewerId, candidateIds));

  const scores = new Map<string, number>();
  const toCompute: (RankableProfile & { userId: string; matchScore: number })[] = [];

  for (const p of heuristicScored) {
    const cached = cache.get(p.userId);
    if (cached?.aiComputed) {
      scores.set(p.id, cached.finalScore);
      continue;
    }
    scores.set(p.id, p.matchScore);
    if (!cached?.aiComputed) toCompute.push(p);
  }

  // Compute the allowed slice in parallel — these are independent one-time
  // Gemini calls; running them sequentially made Gold Browse block for seconds.
  await Promise.all(
    toCompute.slice(0, Math.max(0, maxCompute)).map(async (p) => {
      const { finalScore } = await computeCompatibilityOnce(
        viewerId,
        me,
        p,
        cache.get(p.userId) ?? null
      );
      scores.set(p.id, finalScore);
    })
  );

  return { scores, cache };
}

/**
 * Smart Matches: resolve scores + reasons for a batch; compute up to maxCompute new pairs.
 */
export async function resolveSmartMatchBatch(
  viewerId: bigint,
  me: CompatProfile,
  peers: (RankableProfile & { userId: string })[],
  maxCompute = MAX_SMART_MATCHES_COMPUTE
): Promise<Map<string, { score: number; reasons: string[] }>> {
  const heuristicScored = attachHeuristicScores(me, peers);
  const candidateIds = peers.map((p) => BigInt(p.userId));
  const cache = await loadCompatibilityCache(viewerId, candidateIds);
  const out = new Map<string, { score: number; reasons: string[] }>();
  const toCompute: (RankableProfile & { userId: string; matchScore: number })[] = [];

  for (const p of heuristicScored) {
    const cached = cache.get(p.userId);
    if (cached?.aiComputed) {
      out.set(p.userId, {
        score: cached.finalScore,
        reasons: cached.aiExplanation ?? [],
      });
      continue;
    }
    out.set(p.userId, { score: p.matchScore, reasons: [] });
    toCompute.push(p);
  }

  // Parallel one-time computes for the allowed slice (see resolveGoldMatchScores).
  await Promise.all(
    toCompute.slice(0, Math.max(0, maxCompute)).map(async (p) => {
      const result = await computeCompatibilityOnce(
        viewerId,
        me,
        p,
        cache.get(p.userId) ?? null
      );
      out.set(p.userId, { score: result.finalScore, reasons: result.reasons });
    })
  );

  return out;
}

export function toCompatProfile(me: {
  country: string | null;
  city: string | null;
  marital_status: string | null;
  religious_practice: string | null;
  religious_methodology: string | null;
  tribe: string | null;
  education: string | null;
  dialect: string | null;
  ancestral_village: string | null;
  willing_to_relocate: string | null;
  age: number | null;
}): CompatProfile {
  return {
    country: me.country,
    city: me.city,
    marital_status: me.marital_status,
    religious_practice: me.religious_practice,
    ancestral_village: me.ancestral_village,
    age: me.age,
    tribe: me.tribe,
    education: me.education,
    religious_methodology: me.religious_methodology,
    dialect: me.dialect,
    willing_to_relocate: me.willing_to_relocate,
  };
}
