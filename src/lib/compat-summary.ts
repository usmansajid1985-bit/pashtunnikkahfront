import { prisma } from "@/lib/prisma";
import { geminiJson, hasGeminiKey } from "@/lib/gemini";
import type { CompatBreakdown } from "@/lib/compat-engine";

let ensured = false;
async function ensureSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS compat_summaries (
      viewer_id BIGINT NOT NULL,
      candidate_user_id BIGINT NOT NULL,
      fingerprint TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (viewer_id, candidate_user_id)
    )
  `);
  ensured = true;
}

/** Cached summary for this exact pair + profile data, or null (then generate it after the page). */
export async function cachedCompatSummary(
  viewerId: bigint,
  candidateUserId: bigint,
  fingerprint: string
): Promise<string | null> {
  try {
    await ensureSchema();
    const rows = await prisma.$queryRaw<{ summary: string; fingerprint: string }[]>`
      SELECT summary, fingerprint FROM compat_summaries
      WHERE viewer_id = ${viewerId} AND candidate_user_id = ${candidateUserId}
      LIMIT 1
    `;
    return rows[0] && rows[0].fingerprint === fingerprint ? rows[0].summary : null;
  } catch {
    return null;
  }
}

/** Words the summary must never use — it describes shared information, not people (B29). */
const UNSAFE = /\b(perfect|ideal|soulmate|guarantee|guaranteed|trustworthy|honest|pious|good person|definitely|destined|meant to be|successful marriage|will be happy)\b/i;

/**
 * B29: a short, careful summary written ONLY from the rule-based findings. Stored per pair and
 * profile fingerprint; if the model fails or produces unsafe wording nothing is stored, so the
 * next open simply tries again (the breakdown itself never depends on this).
 */
export async function generateCompatSummary(opts: {
  viewerId: bigint;
  candidateUserId: bigint;
  fingerprint: string;
  peerCode: string;
  breakdown: CompatBreakdown;
}): Promise<string | null> {
  if (!hasGeminiKey()) return null;
  const { aligned, discuss, unknown } = opts.breakdown;
  if (aligned.length + discuss.length === 0) return null; // nothing real to summarise
  const result = await geminiJson<{ summary?: string }>({
    timeoutMs: 9000,
    system: [
      "You write a 1–2 sentence compatibility note for a Muslim matrimony app (Pashtun Nikah).",
      "Use ONLY the findings provided. Do not add facts, guesses or assumptions.",
      "Address the reader as 'you' and refer to the other member only by their profile ID.",
      "Describe how the two profiles' SHARED INFORMATION lines up — never say someone is suitable, trustworthy, religious, a good person, or that a marriage will succeed.",
      "Mention one or two aligned areas and, if present, one area worth discussing. Calm, neutral tone. No percentages or scores.",
      'Return JSON only: {"summary": string}.',
    ].join(" "),
    user: JSON.stringify({
      otherMember: opts.peerCode,
      aligned: aligned.map((i) => i.text),
      worthDiscussing: discuss.map((i) => i.text),
      notEnoughInformation: unknown.map((i) => i.topic),
    }),
  });
  const summary = result?.summary?.replace(/\s+/g, " ").trim();
  if (!summary || summary.length < 20 || summary.length > 420 || UNSAFE.test(summary) || /\d+\s*%/.test(summary)) {
    return null;
  }
  try {
    await ensureSchema();
    await prisma.$executeRaw`
      INSERT INTO compat_summaries (viewer_id, candidate_user_id, fingerprint, summary, created_at)
      VALUES (${opts.viewerId}, ${opts.candidateUserId}, ${opts.fingerprint}, ${summary}, NOW())
      ON CONFLICT (viewer_id, candidate_user_id)
      DO UPDATE SET fingerprint = EXCLUDED.fingerprint, summary = EXCLUDED.summary, created_at = NOW()
    `;
  } catch {
    /* next open retries */
  }
  return summary;
}
