"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProfileView } from "@/lib/profile";
import {
  ANCESTRAL_REGIONS,
  COUNTRIES,
  EDUCATION_OPTIONS,
  HEIGHTS,
  MEN_APPEARANCE,
  WOMEN_DRESS_STYLE,
  WOMEN_HEAD_COVERING,
  splitWomenAppearance,
  LANGUAGES_ORDERED,
  PASHTO_LEVELS,
  SALAH_OPTIONS,
  occupationPrompt,
  textQualityIssue,
  wordCount,
} from "@/lib/signup";
import { BeardTile, ChoiceGrid, ChoiceSection, ChoiceTile, DressTile, I, LIFESTYLE_ICONS } from "@/components/signup/choice-tile";
import { RELOCATION_OPTIONS, normalizeRelocation } from "@/lib/relocation";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { WaliAccessManager } from "@/components/profile/wali-access-manager";
import { GuardianContactManager } from "@/components/profile/guardian-contact-manager";
import { PhotoGallery } from "@/components/profile/photo-gallery";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { PashtoLevelQuestion } from "@/components/signup/pashto-level-question";
import {
  INTERESTS,
  ISLAMIC_PRACTICE_MAX,
  MAX_INTERESTS,
  PASHTO_DIALECTS,
  PASHTUN_TRAITS,
  PERSONALITY_TRAITS,
  cleanInterests,
  type Choice,
} from "@/lib/profile-optional";
import { CityPicker } from "@/components/location/city-picker";
import { cityInvalidMessage } from "@/lib/country";
import { TribePicker } from "@/components/tribe/tribe-picker";
import { matchTribe } from "@/lib/tribes";

const field =
  "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10";

/**
 * Meaningful-word counter for About / Looking for, plus the quality note once it's been edited
 * (an untouched older text never blocks saving other fields).
 */
function TextHint({ text, initial }: { text: string; initial: string }) {
  const edited = text.trim() !== initial.trim();
  const issue = edited ? textQualityIssue(text) : null;
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <p className="text-rose-700">{issue}</p>
      <p className="shrink-0 text-ink-700/50">{wordCount(text)} / 30 meaningful words</p>
    </div>
  );
}

/** About / Looking for were changed and don't meet the requirement yet — Save stays disabled. */
function textBlocksSave(form: { aboutMe: string; lookingFor: string }, initial: { aboutMe?: string | null; lookingFor?: string | null }) {
  return (
    [
      [form.aboutMe, initial.aboutMe || ""],
      [form.lookingFor, initial.lookingFor || ""],
    ] as const
  ).some(([value, before]) => value.trim() !== before.trim() && textQualityIssue(value) !== null);
}

/** Multi-select chips for the optional interests / personality lists. */
function ChipPicker({
  choices,
  selected,
  max,
  onChange,
}: {
  choices: Choice[];
  selected: string[];
  max?: number;
  onChange: (next: string[]) => void;
}) {
  const full = max != null && selected.length >= max;
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((c) => {
        const on = selected.includes(c.label);
        return (
          <button
            key={c.label}
            type="button"
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onChange(on ? selected.filter((x) => x !== c.label) : [...selected, c.label])}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
              on ? "border-rose-600 bg-rose-50 text-rose-800" : "border-[#ece7e6] bg-white text-ink-900 hover:border-rose-200"
            }`}
          >
            <span aria-hidden>{c.icon}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** P10: comparable form state — Pause saves instantly on its own, so it never counts as unsaved. */
function snapshot(f: object) {
  return JSON.stringify({ ...f, isHidden: undefined });
}

function optionsWithCurrent(options: string[], current: string) {
  if (!current) return options;
  if (options.includes(current)) return options;
  return [current, ...options];
}

const EDUCATION: string[] = [...EDUCATION_OPTIONS];
const MARITAL = ["Never Married", "Divorced", "Annulled", "Widowed"];
const EMPLOYMENT = [
  { v: "Employed", tone: "sky" as const, icon: I.briefcase },
  { v: "Self-employed", tone: "lilac" as const, icon: I.laptop },
  { v: "Student", tone: "mint" as const, icon: I.grad },
  { v: "Homemaker", tone: "peach" as const, icon: I.home },
  { v: "Unemployed", tone: "sand" as const, icon: I.search },
];

export function ProfileEditForm({
  initial,
  unreadCount = 0,
  photos = [],
  hideMobileHeader = false,
}: {
  initial: ProfileView;
  unreadCount?: number;
  photos?: {
    id: string;
    url: string;
    isMain: boolean;
    status: "pending" | "approved" | "rejected";
    sortOrder: number;
  }[];
  /** true when embedded inside the Preview/Edit swipe shell, which owns the mobile header. */
  hideMobileHeader?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isSister = (initial.gender || "").toLowerCase() === "female";

  const [form, setForm] = useState({
    fullName: initial.fullName,
    height: initial.height || "",
    city: initial.city || "",
    country: (() => {
      const raw = initial.country || "";
      const match = COUNTRIES.find(
        (c) => raw === `${c.flag} ${c.name}` || raw === c.name || raw.endsWith(c.name)
      );
      return match ? `${match.flag} ${match.name}` : raw;
    })(),
    maritalStatus: initial.maritalStatus || "",
    tribe: matchTribe(initial.tribe) ?? "",
    ancestralRegion: initial.ancestralRegion || "",
    relocation: initial.relocation || "",
    religiousPractice: initial.religiousPractice || "",
    salah: initial.salah || "",
    islamicBackground: initial.islamicBackground || "",
    appearance: initial.appearance,
    hasChildren: initial.hasChildren || "",
    willingChildren: initial.willingChildren || "",
    education: initial.education || "",
    employment: initial.employment || "",
    occupation: initial.occupation || "",
    smoking: initial.smoking || "",
    vaping: initial.vaping || "",
    languages: initial.languages,
    dialect: PASHTO_DIALECTS.find((d) => d.toLowerCase() === (initial.dialect || "").toLowerCase()) ?? "",
    islamicPractice: initial.islamicPractice || "",
    interests: cleanInterests(initial.interests),
    personality: initial.personality,
    pashtoLevel: PASHTO_LEVELS.find((l) => l.toLowerCase() === (initial.pashto || "").toLowerCase()) ?? "",
    aboutMe: initial.aboutMe || "",
    lookingFor: initial.lookingFor || "",
    isHidden: initial.isHidden,
  });

  const [pauseSaving, setPauseSaving] = useState(false);
  /** R04: a city edited here must be re-picked from the list before saving. */
  const [cityConfirmed, setCityConfirmed] = useState(true);
  const [cityPlaceId, setCityPlaceId] = useState<string | null>(null);

  // P10: what's on screen vs. what was last saved. Pause saves instantly, so it never counts.
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(form));
  const dirty = useMemo(() => snapshot(form) !== savedSnapshot, [form, savedSnapshot]);
  const { dialog: leaveDialog } = useLeaveGuard(dirty);

  /** Pause saves on its own, immediately — it isn't part of the big Save (F01). */
  async function togglePause(paused: boolean) {
    const previous = form.isHidden;
    setForm((f) => ({ ...f, isHidden: paused }));
    setPauseSaving(true);
    try {
      const res = await fetch("/api/profile/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setForm((f) => ({ ...f, isHidden: previous }));
      setError("Could not update Pause. Please try again.");
    } finally {
      setPauseSaving(false);
    }
  }

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cityConfirmed) {
      setError(cityInvalidMessage(form.country));
      return;
    }
    for (const [value, before, label] of [
      [form.aboutMe, initial.aboutMe || "", "About Me"],
      [form.lookingFor, initial.lookingFor || "", "What you're looking for"],
    ] as const) {
      const issue = value.trim() !== before.trim() ? textQualityIssue(value) : null;
      if (issue) {
        setError(`${label}: ${issue}`);
        return;
      }
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, cityPlaceId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save.");
          return;
        }
        setSaved(true);
        setSavedSnapshot(snapshot(form));
        router.refresh();
      } catch {
        setError("Network error.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      {leaveDialog}
      <div className="hidden lg:block">
        <BrowseAppNav profileCode={initial.profileCode} active="profile" unreadCount={unreadCount} />
      </div>

      {/* Mobile header */}
      {hideMobileHeader ? null : (
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/8 lg:hidden">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/profile" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div className="flex gap-8 text-[15px]">
            <Link href="/profile" className="pb-2.5 font-medium text-ink-700/50">
              Preview
            </Link>
            <span className="pb-2.5 font-bold text-ink-950 border-b-[3px] border-ink-950">Edit</span>
          </div>
          <span className="w-10" />
        </div>
      </header>
      )}

      <form
        onSubmit={onSubmit}
        className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 pb-[calc(7rem+var(--pn-bottom-nav-h))] lg:pb-12"
      >
        {/* Desktop tabs + Save — stays pinned to the top while scrolling */}
        <div className="hidden lg:flex lg:col-span-2 items-center justify-between gap-4 mb-2 lg:sticky lg:top-0 lg:z-20 lg:-mx-8 lg:px-8 lg:py-3 bg-[#faf8f7]/95 backdrop-blur border-b border-ink-900/8">
          <div className="flex gap-8 text-[15px]">
            <Link href="/profile" className="pb-2 font-medium text-ink-700/50 hover:text-ink-900">
              Preview
            </Link>
            <span className="pb-2 font-bold text-ink-950 border-b-[3px] border-rose-600">Edit</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {saved && !error ? (
              <p className="text-sm font-medium text-emerald-700" aria-live="polite">
                Your profile has been updated
              </p>
            ) : null}
            {error ? (
              <p className="text-sm font-medium text-rose-700 max-w-xs text-right" aria-live="polite">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || textBlocksSave(form, initial)}
              className="px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <PhotoGallery initialPhotos={photos} />

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3 lg:col-span-2">
          <h2 className="font-bold text-ink-950">About me &amp; looking for</h2>
          <label htmlFor="edit-about-me" className="block text-xs font-semibold">About me</label>
          <textarea
            id="edit-about-me"
            className={`${field} min-h-[120px]`}
            value={form.aboutMe}
            onChange={(e) => patch("aboutMe", e.target.value)}
            placeholder="About you"
          />
          <TextHint text={form.aboutMe} initial={initial.aboutMe || ""} />
          <label htmlFor="edit-looking-for" className="block text-xs font-semibold">What I&apos;m looking for</label>
          <textarea
            id="edit-looking-for"
            className={`${field} min-h-[120px]`}
            value={form.lookingFor}
            onChange={(e) => patch("lookingFor", e.target.value)}
            placeholder="What you're looking for"
          />
          <TextHint text={form.lookingFor} initial={initial.lookingFor || ""} />
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Basics</h2>
          <label className="block text-xs font-semibold">Full name</label>
          <input className={field} value={form.fullName} onChange={(e) => patch("fullName", e.target.value)} />
          <label className="block text-xs font-semibold">Height</label>
          <select className={field} value={form.height} onChange={(e) => patch("height", e.target.value)}>
            <option value="">Select height</option>
            {optionsWithCurrent(HEIGHTS, form.height).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Country</label>
              <select className={field} value={form.country} onChange={(e) => patch("country", e.target.value)}>
                <option value="">Select country</option>
                {optionsWithCurrent(
                  COUNTRIES.map((c) => `${c.flag} ${c.name}`),
                  form.country
                ).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">City / town</label>
              <CityPicker
                className={field}
                value={form.city}
                country={form.country}
                initiallyConfirmed
                onChange={(city, confirmed, placeId) => {
                  patch("city", city);
                  setCityConfirmed(confirmed);
                  setCityPlaceId(placeId ?? null);
                }}
              />
            </div>
          </div>
          <label className="block text-xs font-semibold">Marital status</label>
          <select className={field} value={form.maritalStatus} onChange={(e) => patch("maritalStatus", e.target.value)}>
            <option value="">Select</option>
            {optionsWithCurrent(MARITAL, form.maritalStatus).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Roots & relocation</h2>
          <label className="block text-xs font-semibold">Ancestral region</label>
          <select
            className={field}
            value={form.ancestralRegion}
            onChange={(e) => patch("ancestralRegion", e.target.value)}
          >
            <option value="">Select</option>
            {ANCESTRAL_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className="text-xs font-semibold pt-1">Relocation</p>
          <ChoiceGrid count={3}>
            {RELOCATION_OPTIONS.map((o) => (
              <ChoiceTile
                key={o.value}
                label={o.label}
                tone={o.value === "yes" ? "mint" : "sand"}
                icon={o.value === "no" ? I.mapOff : I.mapPin}
                selected={normalizeRelocation(form.relocation) === o.value}
                onClick={() => patch("relocation", o.label)}
              />
            ))}
          </ChoiceGrid>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Faith</h2>
          <ChoiceGrid count={4}>
            {(
              [
                { v: "Strictly Practising", tone: "mint" as const, icon: I.practiceStrict },
                { v: "Actively Practising", tone: "sky" as const, icon: I.practiceActive },
                { v: "Occasionally Practising", tone: "peach" as const, icon: I.practiceOccasional },
                { v: "Does Not Practise", tone: "rose" as const, icon: I.practiceNone },
              ] as const
            ).map((o) => (
              <ChoiceTile
                key={o.v}
                label={o.v}
                tone={o.tone}
                icon={o.icon}
                showCheck
                selected={form.religiousPractice === o.v}
                onClick={() => patch("religiousPractice", o.v)}
              />
            ))}
          </ChoiceGrid>
          <label className="block text-xs font-semibold">How regularly do you pray?</label>
          <select className={field} value={form.salah} onChange={(e) => patch("salah", e.target.value)}>
            <option value="">Select…</option>
            {optionsWithCurrent([...SALAH_OPTIONS], form.salah).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <label className="block text-xs font-semibold">Islamic background</label>
          <input
            className={field}
            value={form.islamicBackground}
            onChange={(e) => patch("islamicBackground", e.target.value)}
            placeholder="e.g. Sunni — Hanafi"
          />
          <label htmlFor="edit-islamic-practice" className="block text-xs font-semibold">
            Describe your Islamic practice <span className="font-normal text-ink-700/55">(optional)</span>
          </label>
          <textarea
            id="edit-islamic-practice"
            className={`${field} min-h-[110px]`}
            maxLength={ISLAMIC_PRACTICE_MAX}
            value={form.islamicPractice}
            onChange={(e) => patch("islamicPractice", e.target.value)}
            placeholder="Describe your Islamic practice and how you incorporate Islam into your daily life…"
          />
          <p className="text-right text-xs text-ink-700/50">{wordCount(form.islamicPractice)} words</p>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Appearance</h2>
          {isSister ? (
            (() => {
              const { head, dress } = splitWomenAppearance(form.appearance);
              return (
                <>
                  <ChoiceSection title="Head covering" rule="Select one option" />
                  <div className="dress-grid">
                    {WOMEN_HEAD_COVERING.map((o) => (
                      <DressTile
                        key={o.v}
                        value={o.v}
                        label={o.label}
                        hint={o.hint}
                        selected={head === o.v}
                        onClick={() => patch("appearance", [o.v, ...dress])}
                      />
                    ))}
                  </div>
                  <div className="pt-3">
                    <ChoiceSection title="Dress style" rule="Select one or more options" />
                  </div>
                  <div className="dress-grid dress-grid-4">
                    {WOMEN_DRESS_STYLE.map((o) => {
                      const on = dress.includes(o.v);
                      return (
                        <DressTile
                          key={o.v}
                          value={o.v}
                          label={o.label}
                          hint={o.hint}
                          selected={on}
                          onClick={() =>
                            patch("appearance", [
                              ...(head ? [head] : []),
                              ...(on ? dress.filter((x) => x !== o.v) : [...dress, o.v]),
                            ])
                          }
                        />
                      );
                    })}
                  </div>
                </>
              );
            })()
          ) : (
            <ChoiceGrid count={5}>
              {MEN_APPEARANCE.map((v) => (
                <BeardTile
                  key={v}
                  label={v}
                  selected={form.appearance[0] === v}
                  onClick={() => patch("appearance", [v])}
                />
              ))}
            </ChoiceGrid>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Family</h2>
          <p className="text-xs font-semibold">Do you have children?</p>
          <ChoiceGrid count={2}>
            <ChoiceTile
              label="Yes, I have children"
              tone="sky"
              icon={I.baby}
              showCheck
              selected={form.hasChildren === "Have Children"}
              onClick={() => patch("hasChildren", "Have Children")}
            />
            <ChoiceTile
              label="No, I don't"
              tone="sand"
              icon={I.babyOff}
              showCheck
              selected={form.hasChildren === "No Children"}
              onClick={() => patch("hasChildren", "No Children")}
            />
          </ChoiceGrid>
          <p className="text-xs font-semibold">Do you want to have children?</p>
          <ChoiceGrid count={2}>
            <ChoiceTile
              label="Yes, Insha'Allah"
              hint="If Allah wills"
              tone="mint"
              icon={I.babySparkle}
              showCheck
              selected={form.willingChildren === "Insha'Allah if Allah Wills" || form.willingChildren === "Yes"}
              onClick={() => patch("willingChildren", "Insha'Allah if Allah Wills")}
            />
            <ChoiceTile
              label="No"
              tone="peach"
              icon={I.babyNo}
              showCheck
              selected={form.willingChildren === "No"}
              onClick={() => patch("willingChildren", "No")}
            />
          </ChoiceGrid>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Languages</h2>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES_ORDERED.map((lang) => {
              const on = form.languages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() =>
{
                    patch(
                      "languages",
                      on ? form.languages.filter((l) => l !== lang) : [...form.languages, lang]
                    );
                    if (lang === "Pashto" && on) {
                      patch("pashtoLevel", "");
                      patch("dialect", "");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    on ? "bg-rose-600 text-white border-rose-600" : "bg-white border-[#ece7e6]"
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
          {form.languages.includes("Pashto") ? (
            <>
              <PashtoLevelQuestion compact value={form.pashtoLevel} onChange={(v) => patch("pashtoLevel", v)} />
              <label htmlFor="edit-dialect" className="block pt-2 text-xs font-semibold">
                Which Pashto dialect do you speak? <span className="font-normal text-ink-700/55">(optional)</span>
              </label>
              <select
                id="edit-dialect"
                className={field}
                value={form.dialect}
                onChange={(e) => patch("dialect", e.target.value as typeof form.dialect)}
              >
                <option value="">Select a dialect</option>
                {PASHTO_DIALECTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Tribe</h2>
          <p className="text-xs font-semibold">What is your tribe?</p>
          <TribePicker selected={form.tribe ? [form.tribe] : []} onChange={([tribe]) => patch("tribe", tribe ?? "")} />
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Career</h2>
          <p className="text-xs font-semibold">Employment status</p>
          <ChoiceGrid count={5}>
            {EMPLOYMENT.map((o) => (
              <ChoiceTile
                key={o.v}
                label={o.v}
                tone={o.tone}
                icon={o.icon}
                selected={form.employment === o.v}
                onClick={() => {
                  patch("employment", o.v);
                  if (!occupationPrompt(o.v)) patch("occupation", "");
                }}
              />
            ))}
          </ChoiceGrid>
          <label className="block text-xs font-semibold">Education</label>
          <select className={field} value={form.education} onChange={(e) => patch("education", e.target.value)}>
            <option value="">Select</option>
            {optionsWithCurrent(EDUCATION, form.education).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {(() => {
            // Follows the employment choice, as in signup; hidden for Homemaker / Unemployed.
            const prompt = form.employment ? occupationPrompt(form.employment) : { label: "Profession", placeholder: "" };
            if (!prompt) return null;
            return (
              <>
                <label className="block text-xs font-semibold">{prompt.label}</label>
                <input
                  className={field}
                  placeholder={prompt.placeholder}
                  maxLength={100}
                  value={form.occupation}
                  onChange={(e) => patch("occupation", e.target.value)}
                />
              </>
            );
          })()}
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Health & lifestyle</h2>
          <p className="text-xs font-semibold">Smoking</p>
          <ChoiceGrid count={3}>
            {(["Never", "Occasionally", "Regularly"] as const).map((v, i) => (
              <ChoiceTile
                key={v}
                label={v}
                tone={(["mint", "peach", "rose"] as const)[i]}
                icon={LIFESTYLE_ICONS.smoking[i]}
                showCheck
                selected={form.smoking === v}
                onClick={() => patch("smoking", v)}
              />
            ))}
          </ChoiceGrid>
          <p className="text-xs font-semibold">Vaping</p>
          <ChoiceGrid count={3}>
            {(["Never", "Occasionally", "Regularly"] as const).map((v, i) => (
              <ChoiceTile
                key={v}
                label={v}
                tone={(["mint", "peach", "rose"] as const)[i]}
                icon={LIFESTYLE_ICONS.vaping[i]}
                showCheck
                selected={form.vaping === v}
                onClick={() => patch("vaping", v)}
              />
            ))}
          </ChoiceGrid>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink-950">
                Interests <span className="text-xs font-normal text-ink-700/55">(optional)</span>
              </h2>
              <p className="text-xs text-ink-700/60">Pick up to {MAX_INTERESTS} hobbies, activities and topics you enjoy.</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-rose-700 tabular-nums" aria-live="polite">
              {form.interests.length}/{MAX_INTERESTS} selected
            </p>
          </div>
          <ChipPicker
            choices={INTERESTS}
            selected={form.interests}
            max={MAX_INTERESTS}
            onChange={(next) => patch("interests", next)}
          />
          <p className="text-xs text-ink-700/55">Your interests help others get to know you at a glance.</p>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3 lg:col-span-2">
          <h2 className="font-bold text-ink-950">
            Personality traits <span className="text-xs font-normal text-ink-700/55">(optional)</span>
          </h2>
          <p className="text-xs font-semibold text-ink-900">Pashtun values</p>
          <ChipPicker choices={PASHTUN_TRAITS} selected={form.personality} onChange={(next) => patch("personality", next)} />
          <p className="pt-2 text-xs font-semibold text-ink-900">Other personality traits</p>
          <p className="text-xs text-ink-700/60">Choose the qualities that describe you best.</p>
          <ChipPicker choices={PERSONALITY_TRAITS} selected={form.personality} onChange={(next) => patch("personality", next)} />
          <p className="text-xs text-ink-700/55">Your traits help us show you more compatible matches.</p>
        </section>

        <section id="visibility" className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3 lg:col-span-2">
          <h2 className="font-bold text-ink-950">Visibility</h2>
          <label id="pause" className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="block font-semibold text-sm">Pause profile</span>
              <span className="block text-xs text-ink-700/60">Hide from Browse temporarily</span>
            </span>
            <input
              type="checkbox"
              className="accent-rose-600 w-5 h-5"
              checked={form.isHidden}
              disabled={pauseSaving}
              onChange={(e) => void togglePause(e.target.checked)}
            />
          </label>
          <p className="text-xs text-ink-700/55" aria-live="polite">
            {pauseSaving
              ? "Saving…"
              : form.isHidden
                ? "Paused — you're hidden from Browse. Existing matches and chats still work."
                : "Active — you appear in Browse."}
          </p>
        </section>

        {isSister ? <GuardianContactManager /> : null}
        {isSister ? <WaliAccessManager /> : null}

        <div className="fixed bottom-[var(--pn-bottom-nav-h)] inset-x-0 bg-gradient-to-t from-[#faf8f7] via-[#faf8f7] to-transparent pt-4 pb-5 lg:hidden">
          <div className="max-w-lg mx-auto px-4">
            {saved && !error ? (
              <p className="mb-2 text-center text-sm font-medium text-emerald-700" aria-live="polite">
                Your profile has been updated
              </p>
            ) : null}
            {error ? (
              <p className="mb-2 text-center text-sm font-medium text-rose-700" aria-live="polite">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || textBlocksSave(form, initial)}
              className="w-full py-3.5 rounded-2xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
