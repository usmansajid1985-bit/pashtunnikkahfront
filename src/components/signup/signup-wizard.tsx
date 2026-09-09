"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ANCESTRAL_REGIONS,
  COMM_MODES,
  COUNTRIES,
  HEIGHTS,
  LANGUAGES_ORDERED,
  MEN_APPEARANCE,
  calcAge,
  emptySignupData,
  getSignupSteps,
  isStepValid,
  wordCount,
  type SignupData,
} from "@/lib/signup";
import { ChoiceGrid, ChoiceTile, I } from "@/components/signup/choice-tile";
import { RELOCATION_OPTIONS, normalizeRelocation } from "@/lib/relocation";
import { PhotoCropModal } from "@/components/signup/photo-crop-modal";

const STORAGE_KEY = "pn_signup_draft_v1";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm font-medium border transition ${
        selected
          ? "bg-rose-600 text-white border-rose-600"
          : "bg-white text-ink-900 border-[#ece7e6] hover:border-rose-300"
      }`}
    >
      {children}
    </button>
  );
}

function ProgressRing({ value, size = 52 }: { value: number; size?: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#f1eeef" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="#aa1945"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
      <text x="26" y="28" textAnchor="middle" className="fill-ink-950" style={{ fontSize: 11, fontWeight: 700 }}>
        {Math.round(value)}%
      </text>
    </svg>
  );
}

export function SignupWizard() {
  const router = useRouter();
  const [data, setData] = useState<SignupData>(emptySignupData);
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const steps = useMemo(() => getSignupSteps(data.gender), [data.gender]);
  const step = steps[stepIndex] ?? steps[0];
  const total = steps.length;
  const left = Math.max(0, total - stepIndex - 1);
  const progress = ((stepIndex + 1) / total) * 100;
  const canNext = isStepValid(step.id, data);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: SignupData; stepIndex: number };
        if (parsed?.data) {
          setData({ ...emptySignupData(), ...parsed.data });
          setStepIndex(Math.max(0, parsed.stepIndex || 0));
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || step.id === "done") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, stepIndex }));
  }, [data, stepIndex, hydrated, step.id]);

  // Keep step index valid when sister/brother changes step list length
  useEffect(() => {
    if (stepIndex >= steps.length) setStepIndex(steps.length - 1);
  }, [steps.length, stepIndex]);

  function patch(partial: Partial<SignupData>) {
    setData((d) => ({ ...d, ...partial }));
    setError(null);
  }

  function go(delta: number) {
    const next = stepIndex + delta;
    if (next < 0 || next >= steps.length) return;
    setDir(delta > 0 ? 1 : -1);
    startTransition(() => setStepIndex(next));
  }

  async function submitAccount() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && (json.code === "EMAIL_EXISTS" || json.redirectTo)) {
          localStorage.removeItem(STORAGE_KEY);
          router.push(String(json.redirectTo || `/login?email=${encodeURIComponent(data.email.trim())}&existing=1`));
          return;
        }
        setError(json.error || "Signup failed.");
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      setDir(1);
      setStepIndex(steps.findIndex((s) => s.id === "done"));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onNext() {
    if (!canNext || submitting) return;
    if (step.id === "account") {
      await submitAccount();
      return;
    }
    go(1);
  }

  function onPhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Photo must be under 6MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  const age = calcAge(data.dob);

  return (
    <div className="signup-shell min-h-screen text-ink-900 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-ink-900/8 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpeg" alt="Pashtun Nikah" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-full border border-ink-900/15 text-ink-900 text-sm font-semibold hover:border-rose-300 transition"
          >
            Login
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-8 sm:py-12">
        {/* Trust strip */}
        <div className="mb-8 rounded-2xl border border-rose-100 bg-white/70 backdrop-blur px-4 py-3 text-center">
          <p className="text-xs sm:text-sm text-ink-700/80 leading-relaxed">
            Every profile is manually reviewed · Registration &amp; browsing are free · Gold includes 10 match
            tokens / month
          </p>
        </div>

        <div className="rounded-3xl bg-white shadow-[0_20px_60px_-30px_rgba(32,26,29,0.25)] border border-ink-900/6 p-5 sm:p-9">
        {/* Progress */}
        {step.id !== "done" ? (
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => go(-1)}
              className={`w-9 h-9 flex items-center justify-center rounded-full border border-ink-900/10 text-ink-700/60 hover:text-ink-900 hover:border-rose-300 transition ${
                stepIndex === 0 ? "invisible" : ""
              }`}
              aria-label="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-ink-900/8 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-medium text-ink-700/70">
                <span>
                  Step {stepIndex + 1} of {total}
                </span>
                <span className="text-rose-600">
                  {left === 0 ? "Last step" : `${left} left`}
                </span>
              </div>
            </div>

            <ProgressRing value={progress} />

            <Link
              href="/"
              className="w-9 h-9 flex items-center justify-center rounded-full border border-ink-900/10 text-ink-700/50 hover:text-ink-900"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </Link>
          </div>
        ) : null}

        <div
          key={step.id}
          className={`mt-8 signup-step ${dir > 0 ? "signup-in-right" : "signup-in-left"}`}
        >
          {step.id !== "done" ? (
            <>
              <h1 className="font-serif text-2xl sm:text-3xl font-medium text-ink-950 text-balance">
                {step.title}
              </h1>
              {step.subtitle ? (
                <p className="mt-2 text-sm text-ink-700/70 leading-relaxed">{step.subtitle}</p>
              ) : null}
            </>
          ) : null}

          <div className="mt-6 space-y-3">
            {step.id === "gender" && (
              <ChoiceGrid count={2}>
                <ChoiceTile
                  label="Brother"
                  hint="Male member"
                  tone="sky"
                  icon={I.brother}
                  selected={data.gender === "Brother"}
                  onClick={() => patch({ gender: "Brother", appearance: [], communicationMode: "" })}
                />
                <ChoiceTile
                  label="Sister"
                  hint="Female member"
                  tone="rose"
                  icon={I.sister}
                  selected={data.gender === "Sister"}
                  onClick={() => patch({ gender: "Sister", appearance: [] })}
                />
              </ChoiceGrid>
            )}

            {step.id === "name" && (
              <input
                className="field"
                placeholder="e.g. Ahmed Khan"
                value={data.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                autoFocus
              />
            )}

            {step.id === "marital" && (
              <ChoiceGrid count={4}>
                {(
                  [
                    { v: "Never Married", tone: "mint" as const, icon: I.ring },
                    { v: "Divorced", tone: "peach" as const, icon: I.split },
                    { v: "Annulled", tone: "sky" as const, icon: I.fileX },
                    { v: "Widowed", tone: "rose" as const, icon: I.flower },
                  ] as const
                ).map((o) => (
                  <ChoiceTile
                    key={o.v}
                    label={o.v}
                    tone={o.tone}
                    icon={o.icon}
                    selected={data.maritalStatus === o.v}
                    onClick={() => patch({ maritalStatus: o.v })}
                  />
                ))}
              </ChoiceGrid>
            )}

            {step.id === "dob" && (
              <>
                <input
                  type="date"
                  className="field"
                  value={data.dob}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                    .toISOString()
                    .slice(0, 10)}
                  onChange={(e) => patch({ dob: e.target.value })}
                />
                {data.dob ? (
                  <p
                    className={`text-sm font-semibold rounded-xl px-4 py-2.5 ${
                      age != null && age >= 18
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {age != null && age >= 18
                      ? `Age: ${age} years old`
                      : "You must be 18 or over to use Pashtun Nikah."}
                  </p>
                ) : null}
              </>
            )}

            {step.id === "height" && (
              <select
                className="field"
                value={data.height}
                onChange={(e) => patch({ height: e.target.value })}
              >
                <option value="">Select your height</option>
                {HEIGHTS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            )}

            {step.id === "location" && (
              <>
                <select
                  className="field"
                  value={data.country}
                  onChange={(e) => patch({ country: e.target.value })}
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.name} value={`${c.flag} ${c.name}`}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  placeholder="City (e.g. Birmingham)"
                  value={data.city}
                  onChange={(e) => patch({ city: e.target.value })}
                />
              </>
            )}

            {step.id === "roots" && (
              <>
                <label className="block text-xs font-semibold text-ink-900 mb-1.5">Ancestral region</label>
                <select
                  className="field"
                  value={data.ancestralRegion}
                  onChange={(e) => patch({ ancestralRegion: e.target.value })}
                >
                  <option value="">Select region (Pakhtunkhwa / Afghanistan)</option>
                  {ANCESTRAL_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="pt-3 text-xs font-semibold text-ink-900">Relocation plans</p>
                <ChoiceGrid count={3}>
                  {RELOCATION_OPTIONS.map((o) => (
                    <ChoiceTile
                      key={o.value}
                      label={o.label}
                      tone={o.value === "yes" ? "mint" : "sand"}
                      icon={o.value === "no" ? I.mapOff : I.mapPin}
                      selected={normalizeRelocation(data.relocation) === o.value}
                      onClick={() => patch({ relocation: o.label })}
                    />
                  ))}
                </ChoiceGrid>
              </>
            )}

            {step.id === "languages" && (
              <div className="flex flex-wrap gap-2">
                {LANGUAGES_ORDERED.map((lang) => {
                  const on = data.languages.includes(lang);
                  return (
                    <Chip
                      key={lang}
                      selected={on}
                      onClick={() =>
                        patch({
                          languages: on
                            ? data.languages.filter((l) => l !== lang)
                            : [...data.languages, lang],
                        })
                      }
                    >
                      {lang}
                    </Chip>
                  );
                })}
              </div>
            )}

            {step.id === "openTo" && (
              <>
                <ChoiceGrid count={5}>
                  {(
                    [
                      { v: "Divorcees", tone: "peach" as const, icon: I.split },
                      { v: "Widows", tone: "rose" as const, icon: I.flower },
                      { v: "Single parents", tone: "sky" as const, icon: I.parent },
                      { v: "Reverts", tone: "mint" as const, icon: I.spark },
                      // Polygamy is only a relevant openness for male members.
                      ...(data.gender === "Brother"
                        ? [{ v: "Polygamy", tone: "lilac" as const, icon: I.users }]
                        : []),
                    ] as const
                  ).map((item) => {
                    const on = data.openTo.includes(item.v);
                    return (
                      <ChoiceTile
                        key={item.v}
                        label={item.v}
                        tone={item.tone}
                        icon={item.icon}
                        multi
                        selected={on}
                        onClick={() =>
                          patch({
                            openTo: on
                              ? data.openTo.filter((x) => x !== item.v)
                              : [...data.openTo, item.v],
                          })
                        }
                      />
                    );
                  })}
                </ChoiceGrid>
                <p className="text-xs text-ink-700/50">Optional — you can continue without selecting any.</p>
              </>
            )}

            {step.id === "family" && (
              <>
                <p className="text-xs font-semibold text-ink-900">Do you have children?</p>
                <ChoiceGrid count={2}>
                  <ChoiceTile
                    label="Have Children"
                    tone="sky"
                    icon={I.baby}
                    selected={data.hasChildren === "Have Children"}
                    onClick={() => patch({ hasChildren: "Have Children" })}
                  />
                  <ChoiceTile
                    label="No Children"
                    tone="sand"
                    icon={I.babyOff}
                    selected={data.hasChildren === "No Children"}
                    onClick={() => patch({ hasChildren: "No Children" })}
                  />
                </ChoiceGrid>
                <p className="pt-3 text-xs font-semibold text-ink-900">Willing to have children?</p>
                <ChoiceGrid count={2}>
                  <ChoiceTile
                    label="Yes, Insha'Allah"
                    hint="if Allah wills"
                    tone="mint"
                    icon={I.moon}
                    selected={
                      data.willingChildren === "Insha'Allah if Allah Wills" ||
                      data.willingChildren === "Yes"
                    }
                    onClick={() => patch({ willingChildren: "Insha'Allah if Allah Wills" })}
                  />
                  <ChoiceTile
                    label="No"
                    tone="peach"
                    icon={I.x}
                    selected={data.willingChildren === "No"}
                    onClick={() => patch({ willingChildren: "No" })}
                  />
                </ChoiceGrid>
              </>
            )}

            {step.id === "faith" && (
              <ChoiceGrid count={4}>
                {(
                  [
                    { v: "Strictly Practising", tone: "mint" as const, icon: I.moon },
                    { v: "Actively Practising", tone: "sky" as const, icon: I.book },
                    { v: "Occasionally Practising", tone: "peach" as const, icon: I.clock },
                    { v: "Does Not Practise", tone: "sand" as const, icon: I.pause },
                  ] as const
                ).map((o) => (
                  <ChoiceTile
                    key={o.v}
                    label={o.v}
                    tone={o.tone}
                    icon={o.icon}
                    selected={data.religiousPractice === o.v}
                    onClick={() => patch({ religiousPractice: o.v })}
                  />
                ))}
              </ChoiceGrid>
            )}

            {step.id === "appearance" && data.gender === "Brother" && (
              <ChoiceGrid count={5}>
                {MEN_APPEARANCE.map((v, i) => (
                  <ChoiceTile
                    key={v}
                    label={v}
                    tone={(["sand", "peach", "sky", "lilac", "mint"] as const)[i]}
                    icon={I.beard}
                    selected={data.appearance[0] === v}
                    onClick={() => patch({ appearance: [v] })}
                  />
                ))}
              </ChoiceGrid>
            )}

            {step.id === "appearance" && data.gender === "Sister" && (
              <ChoiceGrid count={5}>
                {(
                  [
                    { v: "Does Not Wear Hijab", tone: "sand" as const, icon: I.modest },
                    { v: "Modest", tone: "peach" as const, icon: I.modest },
                    { v: "Wears Hijab", tone: "rose" as const, icon: I.hijab },
                    { v: "Wears Niqab", tone: "lilac" as const, icon: I.veil },
                    { v: "Kamees Partug", tone: "mint" as const, icon: I.spark },
                  ] as const
                ).map((o) => {
                  const on = data.appearance.includes(o.v);
                  return (
                    <ChoiceTile
                      key={o.v}
                      label={o.v}
                      tone={o.tone}
                      icon={o.icon}
                      multi
                      selected={on}
                      onClick={() =>
                        patch({
                          appearance: on
                            ? data.appearance.filter((x) => x !== o.v)
                            : [...data.appearance, o.v],
                        })
                      }
                    />
                  );
                })}
              </ChoiceGrid>
            )}

            {step.id === "career" && (
              <>
                <label className="block text-xs font-semibold text-ink-900 mb-1.5">Highest qualification</label>
                <select
                  className="field"
                  value={data.education}
                  onChange={(e) => patch({ education: e.target.value })}
                >
                  <option value="">Select education</option>
                  {[
                    "GCSEs",
                    "A Levels",
                    "Diploma",
                    "Bachelor's",
                    "Master's",
                    "PhD",
                    "Islamic Studies",
                    "Other",
                  ].map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <p className="pt-3 text-xs font-semibold text-ink-900">Employment status</p>
                <ChoiceGrid count={5}>
                  {(
                    [
                      { v: "Employed", tone: "sky" as const, icon: I.briefcase },
                      { v: "Self-employed", tone: "lilac" as const, icon: I.laptop },
                      { v: "Student", tone: "mint" as const, icon: I.grad },
                      { v: "Homemaker", tone: "peach" as const, icon: I.home },
                      { v: "Unemployed", tone: "sand" as const, icon: I.search },
                    ] as const
                  ).map((o) => (
                    <ChoiceTile
                      key={o.v}
                      label={o.v}
                      tone={o.tone}
                      icon={o.icon}
                      selected={data.employment === o.v}
                      onClick={() => patch({ employment: o.v })}
                    />
                  ))}
                </ChoiceGrid>
                <input
                  className="field mt-2"
                  placeholder="Profession / role (optional)"
                  value={data.occupation}
                  onChange={(e) => patch({ occupation: e.target.value })}
                />
              </>
            )}

            {step.id === "lifestyle" && (
              <>
                <p className="text-xs font-semibold text-ink-900">Smoking</p>
                <ChoiceGrid count={3}>
                  {(
                    [
                      { v: "Never", tone: "mint" as const, icon: I.ban },
                      { v: "Occasionally", tone: "peach" as const, icon: I.clock },
                      { v: "Regularly", tone: "rose" as const, icon: I.waves },
                    ] as const
                  ).map((o) => (
                    <ChoiceTile
                      key={`s-${o.v}`}
                      label={o.v}
                      tone={o.tone}
                      icon={o.icon}
                      selected={data.smoking === o.v}
                      onClick={() => patch({ smoking: o.v })}
                    />
                  ))}
                </ChoiceGrid>
                <p className="pt-3 text-xs font-semibold text-ink-900">Vaping</p>
                <ChoiceGrid count={3}>
                  {(
                    [
                      { v: "Never", tone: "mint" as const, icon: I.ban },
                      { v: "Occasionally", tone: "peach" as const, icon: I.clock },
                      { v: "Regularly", tone: "rose" as const, icon: I.waves },
                    ] as const
                  ).map((o) => (
                    <ChoiceTile
                      key={`v-${o.v}`}
                      label={o.v}
                      tone={o.tone}
                      icon={o.icon}
                      selected={data.vaping === o.v}
                      onClick={() => patch({ vaping: o.v })}
                    />
                  ))}
                </ChoiceGrid>
              </>
            )}

            {step.id === "about" && (
              <>
                <textarea
                  className="field min-h-[140px]"
                  rows={5}
                  placeholder="Describe yourself, your values, your lifestyle..."
                  value={data.about}
                  onChange={(e) => patch({ about: e.target.value })}
                />
                <p className="text-xs text-ink-700/50 text-right">
                  {wordCount(data.about)} / 30 words minimum
                </p>
              </>
            )}

            {step.id === "lookingFor" && (
              <>
                <textarea
                  className="field min-h-[140px]"
                  rows={5}
                  placeholder="Describe your ideal partner and what matters most to you..."
                  value={data.lookingFor}
                  onChange={(e) => patch({ lookingFor: e.target.value })}
                />
                <p className="text-xs text-ink-700/50 text-right">
                  {wordCount(data.lookingFor)} / 30 words minimum
                </p>
              </>
            )}

            {step.id === "photo" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 flex flex-col items-center justify-center gap-3 overflow-hidden hover:border-rose-400 transition"
                >
                  {data.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.photoDataUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <span className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-rose-600">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                      <div className="text-center px-6">
                        <p className="font-semibold text-ink-950">Upload a clear photo of yourself</p>
                        <p className="text-xs text-ink-700/60 mt-1">JPG or PNG · max 6MB · reviewed by humans</p>
                      </div>
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                />
                {data.photoDataUrl ? (
                  <button
                    type="button"
                    className="text-sm text-rose-600 font-semibold"
                    onClick={() => fileRef.current?.click()}
                  >
                    Change photo
                  </button>
                ) : null}
              </div>
            )}

            {step.id === "commMode" && (
              <>
                <ChoiceGrid count={4}>
                  {(
                    [
                      { id: "standard", tone: "sky" as const, icon: I.chat },
                      { id: "wali_oversight", tone: "lilac" as const, icon: I.eye },
                      { id: "wali_only", tone: "peach" as const, icon: I.phone },
                      { id: "niqab", tone: "rose" as const, icon: I.veil },
                    ] as const
                  ).map((row) => {
                    const m = COMM_MODES.find((c) => c.id === row.id)!;
                    return (
                      <ChoiceTile
                        key={m.id}
                        label={m.title}
                        tone={row.tone}
                        icon={row.icon}
                        selected={data.communicationMode === m.id}
                        onClick={() =>
                          patch({
                            communicationMode: m.id,
                            niqabSubMode: m.id === "niqab" ? data.niqabSubMode : "",
                          })
                        }
                      />
                    );
                  })}
                </ChoiceGrid>
                {data.communicationMode ? (
                  <p className="text-xs text-ink-700/70 leading-relaxed rounded-xl bg-white/70 border border-ink-900/8 px-3 py-2.5">
                    {COMM_MODES.find((c) => c.id === data.communicationMode)?.blurb}
                  </p>
                ) : null}
                {data.communicationMode === "niqab" ? (
                  <div className="pt-3 space-y-2">
                    <p className="text-xs font-semibold text-ink-900">After matching, prefer…</p>
                    <ChoiceGrid count={3}>
                      {[
                        { id: "standard", label: "Standard", icon: I.chat, tone: "sky" as const },
                        { id: "wali_oversight", label: "Wali Oversight", icon: I.eye, tone: "lilac" as const },
                        { id: "wali_only", label: "Wali-Only", icon: I.phone, tone: "peach" as const },
                      ].map((s) => (
                        <ChoiceTile
                          key={s.id}
                          label={s.label}
                          tone={s.tone}
                          icon={s.icon}
                          selected={data.niqabSubMode === s.id}
                          onClick={() => patch({ niqabSubMode: s.id })}
                        />
                      ))}
                    </ChoiceGrid>
                  </div>
                ) : null}
              </>
            )}

            {step.id === "phone" && (
              <div className="flex gap-2">
                <select
                  className="field shrink-0"
                  style={{ width: 110 }}
                  value={data.phoneCountry}
                  onChange={(e) => patch({ phoneCountry: e.target.value })}
                >
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+92">🇵🇰 +92</option>
                  <option value="+93">🇦🇫 +93</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+49">🇩🇪 +49</option>
                </select>
                <input
                  className="field"
                  type="tel"
                  placeholder="7911 123456"
                  value={data.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                />
              </div>
            )}

            {step.id === "account" && (
              <>
                <input
                  className="field"
                  type="email"
                  placeholder="Email address"
                  autoComplete="email"
                  value={data.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
                <input
                  className="field"
                  type="password"
                  placeholder="Password (min 8 characters)"
                  autoComplete="new-password"
                  value={data.password}
                  onChange={(e) => patch({ password: e.target.value })}
                />
                <input
                  className="field"
                  type="password"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  value={data.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                />
                {data.password && data.confirmPassword && data.password !== data.confirmPassword ? (
                  <p className="text-sm text-red-600">Passwords do not match.</p>
                ) : null}
              </>
            )}

            {step.id === "done" && (
              <div className="text-center py-6">
                <div className="signup-burst mx-auto w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="2.2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h1 className="font-serif mt-6 text-3xl font-medium text-ink-950">{step.title}</h1>
                <p className="mt-3 text-sm text-ink-700/70 max-w-sm mx-auto leading-relaxed">{step.subtitle}</p>
                <p className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">
                  Profile submitted · pending review
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/browse")}
                  className="block w-full mt-8 py-3.5 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
                >
                  Start browsing
                </button>
                <Link href="/login" className="block mt-3 text-sm text-ink-700/60 hover:text-ink-900">
                  Or go to login
                </Link>
              </div>
            )}
          </div>

          {error ? (
            <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2" role="alert">
              {error}
            </p>
          ) : null}

          {step.id !== "done" ? (
            <button
              type="button"
              disabled={!canNext || submitting}
              onClick={onNext}
              className="w-full mt-7 py-3.5 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(170,25,69,0.55)]"
            >
              {submitting
                ? "Creating account…"
                : step.id === "account"
                  ? "Create account"
                  : step.id === "phone"
                    ? "Continue"
                    : left === 0
                      ? "Finish"
                      : `Next · ${left} left`}
            </button>
          ) : null}
        </div>
        </div>
      </main>

      {cropSource ? (
        <PhotoCropModal
          src={cropSource}
          onCancel={() => setCropSource(null)}
          onSave={(cropped) => {
            patch({ photoDataUrl: cropped });
            setCropSource(null);
          }}
        />
      ) : null}
    </div>
  );
}
