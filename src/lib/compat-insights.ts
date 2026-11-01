import { prisma } from "@/lib/prisma";
import { geminiJson, hasGeminiKey } from "@/lib/gemini";
import type { CompatBreakdown, CompatItem, CompatSide, CompatStatus } from "@/lib/compat-engine";

/** AI layer that reads the written sections (About Me, I'm Looking For) and turns them into extra
 * findings and personalised questions. The rule-based breakdown is the backbone; this adds nuance
 * the structured fields can't capture. Cached per pair + fingerprint, generated off the request
 * path, and never required (the breakdown stands on its own if the model is unavailable). */
export type CompatInsights = {
  summary: string | null;
  questions: string[];
  written: { status: CompatStatus; topic: string; text: string }[];
};

let ensured = false;
async function ensureSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS compat_insights (
      viewer_id BIGINT NOT NULL,
      candidate_user_id BIGINT NOT NULL,
      fingerprint TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (viewer_id, candidate_user_id)
    )
  `);
  ensured = true;
}

export async function cachedCompatInsights(
  viewerId: bigint,
  candidateUserId: bigint,
  fingerprint: string
): Promise<CompatInsights | null> {
  try {
    await ensureSchema();
    const rows = await prisma.$queryRaw<{ payload: string; fingerprint: string }[]>`
      SELECT payload, fingerprint FROM compat_insights
      WHERE viewer_id = ${viewerId} AND candidate_user_id = ${candidateUserId}
      LIMIT 1
    `;
    if (!rows[0] || rows[0].fingerprint !== fingerprint) return null;
    return JSON.parse(rows[0].payload) as CompatInsights;
  } catch {
    return null;
  }
}

/** Repeated text / placeholder answers / test biographies are not meaningful evidence, even at 100%
 * profile completeness. Strip anything too short or too repetitive before it reaches the model. */
function cleanWritten(raw: string | null): string {
  const s = (raw ?? "").trim();
  if (s.length < 25) return "";
  const words = s.toLowerCase().split(/\s+/);
  const unique = new Set(words);
  // "aaa aaa aaa", "test test", a single word repeated — not real content.
  if (unique.size <= 3 || unique.size / words.length < 0.4) return "";
  if (/\b(test|placeholder|lorem ipsum|asdf|qwerty)\b/i.test(s) && unique.size < 8) return "";
  return s.slice(0, 1200);
}

/** Never describe a person's character or predict a marriage — only how shared information lines up. */
const UNSAFE = /\b(perfect|ideal|soulmate|guarantee|guaranteed|trustworthy|honest|pious|good person|definitely|destined|meant to be|successful marriage|will be happy|highly compatible)\b/i;

function safeText(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const s = t.replace(/\s+/g, " ").replace(/\s*[—–]\s*/g, ", ").trim();
  if (s.length < 8 || s.length > 300 || UNSAFE.test(s) || /\d+\s*%/.test(s)) return null;
  return s;
}

const STATUSES: CompatStatus[] = ["aligned", "discuss", "unknown"];

export async function generateCompatInsights(opts: {
  viewerId: bigint;
  candidateUserId: bigint;
  fingerprint: string;
  me: CompatSide;
  them: CompatSide;
  breakdown: CompatBreakdown;
}): Promise<CompatInsights | null> {
  if (!hasGeminiKey()) return null;
  const { me, them, breakdown } = opts;
  const code = them.code;

  const result = await geminiJson<{
    summary?: string;
    questions?: unknown;
    written?: { status?: string; topic?: string; text?: string }[];
  }>({
    timeoutMs: 12000,
    system: [
      "You help two members of a Muslim matrimony app (Pashtun Nikah) understand where they align, what they should discuss, and what to ask next.",
      "You are given each member's structured facts, the rule-based findings already produced, their free-text 'About me' and 'Looking for' sections, and any stated marriage preferences (each marked Essential, Preferred or Flexible).",
      "A marriage preference marked Essential is a deliberate requirement: if the other member clearly does not meet it, that is a conflict worth discussing; if their position is unknown, say it needs clarifying. Preferred and Flexible preferences are softer. Do not treat these like disposable search filters.",
      "Read the written sections to find explicitly stated expectations about marriage, family, work and lifestyle. Distinguish a similarity, a difference, and a genuine preference conflict (a conflict is when one states a requirement the other does not meet).",
      "Do NOT repeat findings already covered by the rule-based list. Only add what the written text reveals. If something is not stated, it is unknown, never assumed.",
      "Ignore repeated text, placeholder answers and test biographies; treat personality descriptions as self-reported, not verified. Flag contradictions as needing clarification.",
      "Never say anyone is suitable, trustworthy, religious or a good person, never predict whether a marriage will succeed, never use percentages, and never say 'highly compatible'.",
      "Produce: (1) summary: ONE short factual sentence naming the strongest meaningful alignment and the main thing to clarify; (2) written: up to 3 findings from the written sections only, each {status: 'aligned'|'discuss'|'unknown', topic: 2-4 word label, text: one sentence saying what both shared and why it matters}; (3) questions: exactly 3 natural, respectful questions about unresolved topics (relocation, lifestyle, children, family involvement, work or study), never asking something the profiles already answer.",
      'Return JSON only: {"summary": string, "written": [{"status","topic","text"}], "questions": [string,string,string]}.',
    ].join(" "),
    user: JSON.stringify({
      otherMember: code,
      ruleFindings: {
        aligned: breakdown.aligned.map((i) => i.text),
        worthDiscussing: breakdown.discuss.map((i) => i.text),
        notEnoughInformation: breakdown.unknown.map((i) => i.topic),
      },
      you: { aboutMe: cleanWritten(me.aboutMe), lookingFor: cleanWritten(me.lookingFor), marriagePreferences: me.marriagePrefs ?? "" },
      [code]: { aboutMe: cleanWritten(them.aboutMe), lookingFor: cleanWritten(them.lookingFor), marriagePreferences: them.marriagePrefs ?? "" },
    }),
  });
  if (!result) return null;

  const summary = safeText(result.summary);
  const questions = Array.isArray(result.questions)
    ? (result.questions.map(safeText).filter(Boolean) as string[]).slice(0, 3)
    : [];
  const written = Array.isArray(result.written)
    ? result.written
        .map((w) => {
          const status = STATUSES.includes(w.status as CompatStatus) ? (w.status as CompatStatus) : null;
          const topic = safeText(w.topic);
          const text = safeText(w.text);
          return status && topic && text ? { status, topic, text } : null;
        })
        .filter(Boolean as unknown as (v: unknown) => v is CompatInsights["written"][number])
        .slice(0, 3)
    : [];

  const payload: CompatInsights = { summary, questions, written };
  try {
    await ensureSchema();
    await prisma.$executeRaw`
      INSERT INTO compat_insights (viewer_id, candidate_user_id, fingerprint, payload, created_at)
      VALUES (${opts.viewerId}, ${opts.candidateUserId}, ${opts.fingerprint}, ${JSON.stringify(payload)}, NOW())
      ON CONFLICT (viewer_id, candidate_user_id)
      DO UPDATE SET fingerprint = EXCLUDED.fingerprint, payload = EXCLUDED.payload, created_at = NOW()
    `;
  } catch {
    /* next open retries */
  }
  return payload;
}

/** Merge AI written-section findings into the rule-based breakdown, keeping conflicts visible and
 * each section capped at three. Pure — returns a new breakdown. */
export function mergeInsights(breakdown: CompatBreakdown, written: CompatInsights["written"]): CompatBreakdown {
  const toItem = (w: CompatInsights["written"][number]): CompatItem => ({ topic: w.topic, status: w.status, text: w.text });
  const aiAligned = written.filter((w) => w.status === "aligned").map(toItem);
  const aiDiscuss = written.filter((w) => w.status === "discuss").map(toItem);
  const aiUnknown = written.filter((w) => w.status === "unknown").map(toItem);
  return {
    // Written conflicts come first in "Worth discussing" so a stated deal-breaker stays visible.
    discuss: [...aiDiscuss, ...breakdown.discuss].slice(0, 3),
    aligned: [...breakdown.aligned, ...aiAligned].slice(0, 3),
    unknown: [...breakdown.unknown, ...aiUnknown],
  };
}
