"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProfileView } from "@/lib/profile";
import {
  ANCESTRAL_REGIONS,
  COUNTRIES,
  HEIGHTS,
  MEN_APPEARANCE,
  WOMEN_APPEARANCE,
  LANGUAGES_ORDERED,
} from "@/lib/signup";
import { ChoiceGrid, ChoiceTile, I } from "@/components/signup/choice-tile";
import { RELOCATION_OPTIONS, normalizeRelocation } from "@/lib/relocation";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { WaliAccessManager } from "@/components/profile/wali-access-manager";
import { GuardianContactManager } from "@/components/profile/guardian-contact-manager";
import { PhotoGallery } from "@/components/profile/photo-gallery";

const field =
  "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10";

function optionsWithCurrent(options: string[], current: string) {
  if (!current) return options;
  if (options.includes(current)) return options;
  return [current, ...options];
}

const EDUCATION = ["GCSEs", "A Levels", "Diploma", "Bachelor's", "Master's", "PhD", "Islamic Studies", "Other"];
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
    tribe: initial.tribe || "",
    ancestralRegion: initial.ancestralRegion || "",
    relocation: initial.relocation || "",
    religiousPractice: initial.religiousPractice || "",
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
    aboutMe: initial.aboutMe || "",
    lookingFor: initial.lookingFor || "",
    isHidden: initial.isHidden,
  });

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save.");
          return;
        }
        setSaved(true);
        router.refresh();
      } catch {
        setError("Network error.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <div className="hidden lg:block">
        <BrowseAppNav profileCode={initial.profileCode} active="profile" unreadCount={unreadCount} />
      </div>

      {/* Mobile header */}
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

      <form
        onSubmit={onSubmit}
        className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 pb-28 lg:pb-12"
      >
        {/* Desktop tabs */}
        <div className="hidden lg:flex lg:col-span-2 items-center justify-between mb-2">
          <div className="flex gap-8 text-[15px]">
            <Link href="/profile" className="pb-2 font-medium text-ink-700/50 hover:text-ink-900">
              Preview
            </Link>
            <span className="pb-2 font-bold text-ink-950 border-b-[3px] border-rose-600">Edit</span>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>

        <PhotoGallery initialPhotos={photos} />

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
              <label className="block text-xs font-semibold mb-1">City</label>
              <input className={field} value={form.city} onChange={(e) => patch("city", e.target.value)} />
            </div>
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
          <label className="block text-xs font-semibold">Tribe</label>
          <input className={field} value={form.tribe} onChange={(e) => patch("tribe", e.target.value)} />
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
                "Strictly Practising",
                "Actively Practising",
                "Occasionally Practising",
                "Does Not Practise",
              ] as const
            ).map((v, i) => (
              <ChoiceTile
                key={v}
                label={v}
                tone={(["mint", "sky", "peach", "sand"] as const)[i]}
                icon={I.moon}
                selected={form.religiousPractice === v}
                onClick={() => patch("religiousPractice", v)}
              />
            ))}
          </ChoiceGrid>
          <label className="block text-xs font-semibold">Islamic background</label>
          <input
            className={field}
            value={form.islamicBackground}
            onChange={(e) => patch("islamicBackground", e.target.value)}
            placeholder="e.g. Sunni — Hanafi"
          />
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Appearance</h2>
          {isSister ? (
            <ChoiceGrid count={5}>
              {WOMEN_APPEARANCE.map((v, i) => {
                const on = form.appearance.includes(v);
                return (
                  <ChoiceTile
                    key={v}
                    label={v}
                    multi
                    tone={(["sand", "peach", "rose", "lilac", "mint"] as const)[i]}
                    icon={I.hijab}
                    selected={on}
                    onClick={() =>
                      patch(
                        "appearance",
                        on ? form.appearance.filter((x) => x !== v) : [...form.appearance, v]
                      )
                    }
                  />
                );
              })}
            </ChoiceGrid>
          ) : (
            <ChoiceGrid count={5}>
              {MEN_APPEARANCE.map((v, i) => (
                <ChoiceTile
                  key={v}
                  label={v}
                  tone={(["sand", "peach", "sky", "lilac", "mint"] as const)[i]}
                  icon={I.beard}
                  selected={form.appearance[0] === v}
                  onClick={() => patch("appearance", [v])}
                />
              ))}
            </ChoiceGrid>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Family</h2>
          <ChoiceGrid count={2}>
            <ChoiceTile
              label="Have Children"
              tone="sky"
              icon={I.baby}
              selected={form.hasChildren === "Have Children"}
              onClick={() => patch("hasChildren", "Have Children")}
            />
            <ChoiceTile
              label="No Children"
              tone="sand"
              icon={I.babyOff}
              selected={form.hasChildren === "No Children"}
              onClick={() => patch("hasChildren", "No Children")}
            />
          </ChoiceGrid>
          <p className="text-xs font-semibold">Willing to have children</p>
          <ChoiceGrid count={2}>
            {(
              [
                { v: "Insha'Allah if Allah Wills", label: "Yes, Insha'Allah", icon: I.moon, tone: "mint" as const },
                { v: "No", label: "No", icon: I.x, tone: "peach" as const },
              ] as const
            ).map((o) => (
              <ChoiceTile
                key={o.v}
                label={o.label}
                hint={o.v === "Insha'Allah if Allah Wills" ? "– if Allah wills" : undefined}
                tone={o.tone}
                icon={o.icon}
                selected={
                  form.willingChildren === o.v ||
                  (o.v === "Insha'Allah if Allah Wills" && form.willingChildren === "Yes")
                }
                onClick={() => patch("willingChildren", o.v)}
              />
            ))}
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
                    patch(
                      "languages",
                      on ? form.languages.filter((l) => l !== lang) : [...form.languages, lang]
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    on ? "bg-rose-600 text-white border-rose-600" : "bg-white border-[#ece7e6]"
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3">
          <h2 className="font-bold text-ink-950">Career</h2>
          <label className="block text-xs font-semibold">Employment</label>
          <ChoiceGrid count={5}>
            {EMPLOYMENT.map((o) => (
              <ChoiceTile
                key={o.v}
                label={o.v}
                tone={o.tone}
                icon={o.icon}
                selected={form.employment === o.v}
                onClick={() => patch("employment", o.v)}
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
          <label className="block text-xs font-semibold">Profession</label>
          <input className={field} value={form.occupation} onChange={(e) => patch("occupation", e.target.value)} />
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
                icon={i === 0 ? I.ban : I.clock}
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
                icon={i === 0 ? I.ban : I.clock}
                selected={form.vaping === v}
                onClick={() => patch("vaping", v)}
              />
            ))}
          </ChoiceGrid>
        </section>

        <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-3 lg:col-span-2">
          <h2 className="font-bold text-ink-950">About & looking for</h2>
          <textarea
            className={`${field} min-h-[120px]`}
            value={form.aboutMe}
            onChange={(e) => patch("aboutMe", e.target.value)}
            placeholder="About you"
          />
          <textarea
            className={`${field} min-h-[120px]`}
            value={form.lookingFor}
            onChange={(e) => patch("lookingFor", e.target.value)}
            placeholder="What you're looking for"
          />
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
              onChange={(e) => patch("isHidden", e.target.checked)}
            />
          </label>
        </section>

        {isSister ? <GuardianContactManager /> : null}
        {isSister ? <WaliAccessManager /> : null}

        {error ? (
          <p className="lg:col-span-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>
        ) : null}
        {saved ? (
          <p className="lg:col-span-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            Saved. Changes may need review before going live.
          </p>
        ) : null}

        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#faf8f7] via-[#faf8f7] to-transparent pt-4 pb-5 lg:hidden">
          <div className="max-w-lg mx-auto px-4">
            <button
              type="submit"
              disabled={pending}
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
