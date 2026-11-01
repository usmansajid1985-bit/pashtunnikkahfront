"use client";

import { useState } from "react";
import type { CompatBreakdown, CompatItem } from "@/lib/compat-engine";

export type ViewerCompat = {
  breakdown: CompatBreakdown;
  /** Optional AI-written note, built only from the breakdown below. */
  summary: string | null;
};

/* ───────────────────────────── icons ───────────────────────────── */

const Sparkle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.5l1.5 4.6 4.6 1.5-4.6 1.5L12 14.7l-1.5-4.6L5.9 8.6l4.6-1.5L12 2.5Z" />
    <path d="M18.6 14.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" opacity="0.7" />
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

const ChatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-3.9A7.5 7.5 0 1 1 21 11.5Z" />
  </svg>
);

const QuestionIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.4 2.4 0 0 1 4.6.9c0 1.6-2.2 2-2.2 3.4" />
    <path d="M12 17.1h.01" />
  </svg>
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ─────────────────── summary + questions helpers (no claims) ─────────────────── */

/**
 * A short, factual summary — the strongest shared point and the main thing to clarify. No
 * compatibility score and no predictive claim (we can't know if a marriage will work out).
 * The aligned/discuss lines are already complete sentences ("You both live in…"), so we use them
 * as written rather than restating the subject.
 */
function summaryFor(breakdown: CompatBreakdown, code: string): string {
  const aligned = breakdown.aligned[0];
  const clarify = breakdown.discuss[0] ?? breakdown.unknown[0];
  const parts: string[] = [];
  if (aligned) parts.push(aligned.text.replace(/\s*$/, ""));
  if (clarify) {
    const verb = breakdown.discuss[0] ? "worth talking through" : "still to clarify";
    parts.push(`The main area ${verb} is ${clarify.topic.toLowerCase()}.`);
  }
  if (parts.length === 0) {
    return `You and ${code} haven't both shared enough yet for a useful comparison.`;
  }
  return parts.join(" ");
}

/** A natural, respectful question for an unresolved topic. */
const QUESTION_FOR: Record<string, string> = {
  Location: "Would you be open to settling in each other's area after marriage?",
  Relocation: "Would you consider relocating after marriage, and to where?",
  "Living arrangements": "Where would you both ideally like to live after marriage?",
  Children: "How do you feel about having children, in sha Allah?",
  "Marital history": "How would you feel about the possibility of polygamy?",
  Salah: "How would you describe your prayer routine day to day?",
  "Religious practice": "What does practising your faith look like for you day to day?",
  "Islamic background": "Which school of thought do you follow, and how important is it to you?",
  Education: "What are your hopes around education for yourself and a future spouse?",
  "Age preferences": "Is there an age range that feels right to you for a spouse?",
  Smoking: "How do you feel about a future spouse who smokes or vapes?",
  Vaping: "How do you feel about a future spouse who smokes or vapes?",
  Lifestyle: "What lifestyle expectations matter most to you in married life?",
};

function questionsFrom(breakdown: CompatBreakdown): string[] {
  const topics = [...breakdown.discuss, ...breakdown.unknown].map((i) => i.topic);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const topic of topics) {
    const q = QUESTION_FOR[topic];
    if (q && !seen.has(q)) {
      seen.add(q);
      out.push(q);
    }
  }
  return out;
}

/* ───────────────────────────── finding rows ───────────────────────────── */

function Finding({ item }: { item: CompatItem }) {
  return (
    <p className="text-[13.5px] leading-relaxed text-ink-700/80">
      <span className="font-semibold text-ink-900">{item.topic}.</span> {item.text}
    </p>
  );
}

function SectionHead({ icon, tone, title }: { icon: React.ReactNode; tone: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`} aria-hidden>
        {icon}
      </span>
      <h3 className="text-[15px] font-bold text-ink-950">{title}</h3>
    </div>
  );
}

/**
 * B27: Match Insights for Gold members — the two-way breakdown (Where you align / Worth discussing /
 * Not enough information) from both members' real profile and preference data, plus questions worth
 * asking. Shows a short preview that fades out, and expands in place to the full result. No
 * percentages and no claims about whether a marriage will work.
 */
export function CompatibilityPanel({
  compat,
  peerCode = "your match",
  compact = false,
}: {
  compat: ViewerCompat;
  peerCode?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [moreQuestions, setMoreQuestions] = useState(false);
  const { breakdown } = compat;
  const { aligned, discuss, unknown } = breakdown;

  const questions = questionsFrom(breakdown);
  const shownQuestions = moreQuestions ? questions : questions.slice(0, 3);

  return (
    <section className={`rounded-2xl border border-ink-900/8 bg-white ${compact ? "p-4" : "p-6"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#e12d72]">
          <Sparkle />
          <span className="text-[15px] font-bold text-ink-950">Match Insights</span>
        </div>
        <span className="rounded-full bg-gradient-to-r from-rose-200 to-amber-200 px-3 py-1 text-[11.5px] font-bold text-amber-900">
          Gold
        </span>
      </div>

      {/* Summary */}
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-800">
        {summaryFor(breakdown, peerCode)}
      </p>

      {/* Always visible: Where you align + Worth discussing */}
      <div className="mt-5 space-y-5">
        {aligned.length ? (
          <div>
            <SectionHead icon={<CheckIcon />} tone="bg-emerald-50 text-emerald-600" title="Where you align" />
            <div className="mt-2 space-y-2 pl-0">
              {aligned.map((it) => (
                <Finding key={it.topic} item={it} />
              ))}
            </div>
          </div>
        ) : null}

        {discuss.length ? (
          <div>
            <SectionHead icon={<ChatIcon />} tone="bg-amber-50 text-amber-600" title="Worth discussing" />
            <div className="mt-2 space-y-2">
              {discuss.map((it) => (
                <Finding key={it.topic} item={it} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Not enough information — heading stays readable; body fades out when collapsed */}
        {unknown.length ? (
          <div>
            <SectionHead icon={<QuestionIcon />} tone="bg-ink-900/[0.05] text-ink-700/60" title="Not enough information" />
            <div className="relative">
              <div className={open ? "mt-2 space-y-2" : "mt-2 space-y-2 max-h-[72px] overflow-hidden"}>
                {unknown.map((it) => (
                  <Finding key={it.topic} item={it} />
                ))}
              </div>
              {!open ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-white" />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Expanded-only: Questions worth asking + footer */}
        {open && questions.length ? (
          <div>
            <SectionHead icon={<ChatIcon />} tone="bg-rose-50 text-[#e12d72]" title="Questions worth asking" />
            <div className="mt-2.5 space-y-2.5">
              {shownQuestions.map((q) => (
                <div key={q} className="rounded-xl border border-ink-900/10 bg-[#faf8f7] px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-900">
                  {q}
                </div>
              ))}
            </div>
            {questions.length > 3 ? (
              <button
                type="button"
                onClick={() => setMoreQuestions((v) => !v)}
                className="mt-2.5 text-[12.5px] font-semibold text-[#e12d72] hover:underline"
              >
                {moreQuestions ? "Show fewer questions" : "Show more questions"}
              </button>
            ) : null}
          </div>
        ) : null}

        {open ? (
          <p className="text-[11.5px] leading-snug text-ink-700/55">
            Based only on what you&apos;ve both shared on Pashtun Nikah, checked both ways. It isn&apos;t a judgement
            of anyone&apos;s character, and it can&apos;t predict whether a marriage will work. Take time to get to
            know each other and involve your families.
          </p>
        ) : null}
      </div>

      {/* Expand / collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-ink-900/12 py-2.5 text-[14px] font-semibold text-ink-950 hover:bg-ink-900/[0.03]"
      >
        {open ? "Show less" : "View full insights"}
        <Chevron open={open} />
      </button>
    </section>
  );
}
