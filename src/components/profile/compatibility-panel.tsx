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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.5l1.6 4.9 4.9 1.6-4.9 1.6L12 15.5l-1.6-4.9L5.5 9l4.9-1.6L12 2.5Z" />
    <path d="M18.5 14l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8.8-2.4Z" opacity="0.7" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-3.9A7.5 7.5 0 1 1 21 11.5Z" />
  </svg>
);

const QuestionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

/* ─────────────────────── headline / theme helpers ─────────────────────── */

/** A topic → short theme word, for the headline ("…compatible in faith and location"). */
const THEME_OF: Record<string, string> = {
  "Religious practice": "faith",
  "Islamic background": "faith",
  Salah: "faith",
  "Born Muslim": "faith",
  Location: "location",
  "Living arrangements": "future plans",
  Relocation: "future plans",
  Children: "family plans",
  "Marital history": "marital background",
  Education: "education",
  Tribe: "background",
  Languages: "language",
  "Pashto dialect": "language",
  "Age preferences": "age",
};

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function themesOf(items: CompatItem[], max = 2): string {
  const seen: string[] = [];
  for (const it of items) {
    const t = THEME_OF[it.topic];
    if (t && !seen.includes(t)) seen.push(t);
    if (seen.length >= max) break;
  }
  return joinWords(seen);
}

function headlineFor(breakdown: CompatBreakdown, code: string): string {
  const aligned = breakdown.aligned.length;
  const discuss = breakdown.discuss.length;
  const themes = themesOf(breakdown.aligned);
  if (aligned >= 1) {
    const intensity = aligned >= 2 ? "highly compatible" : "compatible";
    return themes
      ? `You and ${code} are ${intensity} in ${themes}.`
      : `You and ${code} are ${intensity}.`;
  }
  if (discuss >= 1) return `You and ${code} have a few things worth discussing.`;
  return `You and ${code} haven't shared enough to compare yet.`;
}

function introFor(breakdown: CompatBreakdown, summary: string | null): string {
  if (summary) return summary;
  const themes = themesOf(breakdown.aligned);
  if (themes) {
    return `Your profiles suggest you share important priorities around ${themes}. There are still a few areas worth exploring to understand each other better.`;
  }
  return "There are a few areas worth exploring to understand each other better.";
}

/* ───────────────────────────── section ───────────────────────────── */

function Section({
  icon,
  iconTone,
  title,
  items,
  emptyNote,
}: {
  icon: React.ReactNode;
  iconTone: string;
  title: string;
  items: CompatItem[];
  emptyNote?: string;
}) {
  if (items.length === 0 && !emptyNote) return null;
  return (
    <div className="flex gap-3.5">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold text-ink-950">{title}</h3>
        {items.length ? (
          <div className="mt-1.5 space-y-2">
            {items.map((it) => (
              <p key={it.topic} className="text-[13.5px] leading-relaxed text-ink-700/80">
                <span className="font-semibold text-ink-900">{it.topic}.</span> {it.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-700/60">{emptyNote}</p>
        )}
      </div>
    </div>
  );
}

/**
 * B27: AI Compatibility for Gold members — the two-way breakdown (Aligned / Worth discussing / Not
 * enough information) from both members' real profile and preference data, shown as "Match Insights"
 * with a headline, an intro and an expandable full view. No percentages.
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
  const { breakdown } = compat;
  const unknown = breakdown.unknown;
  const unknownThemes = joinWords(
    [...new Set(unknown.map((u) => u.topic))].slice(0, 3)
  );

  return (
    <section className={`rounded-2xl border border-ink-900/8 bg-white ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#e12d72]">
          <Sparkle />
          <span className="text-[15px] font-bold text-ink-950">Match Insights</span>
        </div>
        <span className="rounded-full bg-gradient-to-r from-amber-100 to-rose-100 px-3 py-1 text-[12px] font-bold text-amber-800">
          Gold
        </span>
      </div>

      <h2 className="mt-3 text-[20px] font-bold leading-snug text-ink-950">
        {headlineFor(breakdown, peerCode)}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-700/70">
        {introFor(breakdown, compat.summary)}
      </p>

      <div className="mt-5 space-y-5">
        <Section
          icon={<CheckIcon />}
          iconTone="bg-emerald-50 text-emerald-600"
          title="Where you align"
          items={breakdown.aligned}
          emptyNote="Nothing clearly aligned yet from what you've both shared."
        />
        <Section
          icon={<ChatIcon />}
          iconTone="bg-amber-50 text-amber-600"
          title="Worth discussing"
          items={breakdown.discuss}
          emptyNote="No differences found in what you've both shared."
        />

        {unknown.length ? (
          <div className="flex gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900/[0.05] text-ink-700/60" aria-hidden>
              <QuestionIcon />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-ink-950">Not enough information</h3>
              {open ? (
                <div className="mt-1.5 space-y-2">
                  {unknown.map((it) => (
                    <p key={it.topic} className="text-[13.5px] leading-relaxed text-ink-700/80">
                      <span className="font-semibold text-ink-900">{it.topic}.</span> {it.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-700/55">
                  {unknownThemes} {unknown.length === 1 ? "needs" : "need"} clarification
                  {unknown.length > 3 ? `, plus ${unknown.length - 3} more` : ""}.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {open ? (
        <p className="mt-5 text-[11.5px] leading-snug text-ink-700/55">
          Based only on what you&apos;ve both shared on Pashtun Nikah, checked both ways. It isn&apos;t a judgement
          of anyone&apos;s character — take time to get to know each other and involve your families.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-ink-900/12 py-2.5 text-[14px] font-semibold text-ink-950 hover:bg-ink-900/[0.03]"
      >
        {open ? "Hide full insights" : "View full insights"}
        <Chevron open={open} />
      </button>
    </section>
  );
}
