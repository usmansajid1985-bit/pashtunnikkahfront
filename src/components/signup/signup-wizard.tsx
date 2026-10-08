"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CityPicker } from "@/components/location/city-picker";
import {
  ANCESTRAL_REGIONS,
  COMM_MODES,
  COUNTRIES,
  HEIGHTS,
  LANGUAGES_ORDERED,
  MEN_APPEARANCE,
  OPEN_TO_OPTIONS,
  WOMEN_DRESS_STYLE,
  WOMEN_HEAD_COVERING,
  calcAge,
  emptySignupData,
  getSignupSteps,
  isStepValid,
  normalizeOpenTo,
  occupationPrompt,
  splitWomenAppearance,
  wordCount,
  textQualityIssue,
  SALAH_OPTIONS,
  salahShortLabel,
  type SignupData,
} from "@/lib/signup";
import { BeardTile, ChoiceGrid, ChoiceSection, ChoiceTile, DressTile, GenderTile, I, LIFESTYLE_ICONS } from "@/components/signup/choice-tile";
import { RELOCATION_OPTIONS, normalizeRelocation } from "@/lib/relocation";
import { PhotoCropModal } from "@/components/signup/photo-crop-modal";
import { PhoneCodePicker } from "@/components/signup/phone-code-picker";
import { PashtoLevelQuestion } from "@/components/signup/pashto-level-question";
import { PasswordField } from "@/components/signup/password-field";
import { TribePicker } from "@/components/tribe/tribe-picker";
import {
  PASSWORD_HINT,
  PASSWORD_MAX,
  PASSWORD_MIN,
  PASSWORD_WEAK_MESSAGE,
  checkPassword,
  isBreachedPassword,
} from "@/lib/password-strength";
import { PHONE_INVALID_MESSAGE, phonePlaceholder, sanitizePhoneInput, toE164 } from "@/lib/phone";

const STORAGE_KEY = "pn_signup_draft_v2";

/** Shared by the "your status" and "open to" steps so both show the same tile per status. */
const MARITAL_TILES = {
  "Never married": { tone: "mint", icon: I.neverMarried },
  Divorced: { tone: "rose", icon: I.divorced },
  Annulled: { tone: "peach", icon: I.annulled },
  Widowed: { tone: "sky", icon: I.widowed },
} as const;

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

/** One line of the live password checklist. */
function PasswordRule({ state, children }: { state: "pass" | "fail" | "pending"; children: React.ReactNode }) {
  const tone = state === "pass" ? "text-emerald-700" : state === "fail" ? "text-rose-700" : "text-ink-700/60";
  return (
    <p className={`flex items-center gap-1.5 ${tone}`}>
      <span aria-hidden className="inline-block w-3 text-center">
        {state === "pass" ? "✓" : state === "fail" ? "✕" : "•"}
      </span>
      <span className="sr-only">{state === "pass" ? "Met:" : state === "fail" ? "Not met:" : ""}</span>
      {children}
    </p>
  );
}

/** Meaningful-word count, plus the quality message once there are enough words to judge. */
function WordHint({ text }: { text: string }) {
  const n = wordCount(text);
  const issue = n >= 30 ? textQualityIssue(text) : null;
  return (
    <>
      <p className={`text-xs text-right ${n >= 30 ? "text-ink-700/50" : "text-ink-700/60"}`}>
        {n} / 30 meaningful words
      </p>
      {issue ? <p className="text-xs text-rose-700">{issue}</p> : null}
    </>
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
  /** null = adding a new photo; number = replacing the photo at that index. */
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [breach, setBreach] = useState<{ password: string; breached: boolean | null } | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 3;
  const wearsNiqab = data.gender === "Sister" && data.appearance.includes("Wears Niqab");

  const steps = useMemo(() => getSignupSteps(data.gender), [data.gender]);
  const step = steps[stepIndex] ?? steps[0];
  const total = steps.length;
  const left = Math.max(0, total - stepIndex - 1);
  const progress = ((stepIndex + 1) / total) * 100;
  // The phone step is checked against the selected country's numbering plan, not just length.
  const phoneValid = toE164(data.phoneIso, data.phone) !== null;
  // Password: the instant rules, then a breach-list lookup for the exact password typed. If that
  // lookup can't be reached it doesn't block (the server tries again on submit).
  const pw = checkPassword(data.password, data.email);
  const breachKnown = breach?.password === data.password;
  const breachChecking = pw.ok && !breachKnown;
  const passwordWeak = !pw.hardToGuess || pw.tooLong || (breachKnown && breach?.breached === true);
  const canNext =
    isStepValid(step.id, data) &&
    (step.id !== "phone" || phoneValid) &&
    (step.id !== "account" || (breachKnown && breach?.breached !== true));
  // Don't nag on the first few digits — only once they've left the field or typed a full number.
  const phoneError =
    !phoneValid && data.phone.trim() !== "" && (phoneTouched || data.phone.replace(/\D/g, "").length >= 9);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: SignupData; stepIndex: number };
        if (parsed?.data) {
          const restored = { ...emptySignupData(), ...parsed.data };
          restored.openTo = normalizeOpenTo(restored.openTo);
          let resumeAt = Math.max(0, parsed.stepIndex || 0);
          // Drafts saved with the old "open to" options may now have none selected — send them
          // back to that step, since one is required.
          const openToIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "openTo");
          if (openToIndex >= 0 && resumeAt > openToIndex && !restored.openTo.length) {
            resumeAt = openToIndex;
          }
          // Same for sister drafts saved before appearance became head covering + dress style.
          const appearanceIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "appearance");
          if (appearanceIndex >= 0 && resumeAt > appearanceIndex && !isStepValid("appearance", restored)) {
            resumeAt = appearanceIndex;
          }
          // Drafts saved while "Profession / role" was optional: workers and students must now
          // answer it, so send them back to that step.
          const careerIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "career");
          if (careerIndex >= 0 && resumeAt > careerIndex && !isStepValid("career", restored)) {
            resumeAt = careerIndex;
          }
          // R04: drafts saved before the city picker existed (or with a typed-in city) must go
          // back and pick the city from the list, instead of failing at "Create account".
          const locationIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "location");
          if (locationIndex >= 0 && resumeAt > locationIndex && !restored.cityConfirmed) {
            resumeAt = locationIndex;
          }
          // Drafts saved before Pashto speakers were asked their level.
          const languagesIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "languages");
          if (languagesIndex >= 0 && resumeAt > languagesIndex && !isStepValid("languages", restored)) {
            resumeAt = languagesIndex;
          }
          // Drafts saved before the tribe question existed.
          const tribeIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "tribe");
          if (tribeIndex >= 0 && resumeAt > tribeIndex && !isStepValid("tribe", restored)) {
            resumeAt = tribeIndex;
          }
          // Drafts saved before numbers were validated per country: fix the number before the
          // account step rather than failing at "Create account".
          const phoneIndex = getSignupSteps(restored.gender).findIndex((s) => s.id === "phone");
          if (phoneIndex >= 0 && resumeAt > phoneIndex && toE164(restored.phoneIso, restored.phone) === null) {
            resumeAt = phoneIndex;
          }
          setData(restored);
          setStepIndex(resumeAt);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || step.id === "done") return;
    // The draft lives in localStorage in plain text — never keep the password there.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: { ...data, password: "", confirmPassword: "" }, stepIndex }));
  }, [data, stepIndex, hydrated, step.id]);

  // Breach lookup, once they pause typing a password that passes the instant rules.
  const passwordToLookUp = step.id === "account" && checkPassword(data.password, data.email).ok ? data.password : null;
  useEffect(() => {
    if (passwordToLookUp === null) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const breached = await isBreachedPassword(passwordToLookUp);
      if (!cancelled) setBreach({ password: passwordToLookUp, breached });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [passwordToLookUp]);

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
        if (res.status === 409 && json.code === "EMAIL_EXISTS") {
          // Don't clear the draft or navigate away — the member just spent several steps filling
          // this in. Let them fix the email (or deliberately go log in) without losing anything.
          setError(
            "An account with this email already exists. Use a different email, or log in instead."
          );
          return;
        }
        if (json.code === "TRIBE_INVALID") {
          const tribeIndex = steps.findIndex((s) => s.id === "tribe");
          if (tribeIndex >= 0) {
            setDir(-1);
            setStepIndex(tribeIndex);
          }
          setError(json.error || "Please select your tribe.");
          return;
        }
        if (json.code === "CITY_INVALID") {
          // Take them straight to the field that needs fixing, with the message shown there.
          const locationIndex = steps.findIndex((s) => s.id === "location");
          setData((d) => ({ ...d, cityConfirmed: false, cityPlaceId: undefined }));
          if (locationIndex >= 0) {
            setDir(-1);
            setStepIndex(locationIndex);
          }
          setError(json.error || "Please select a valid city from the list.");
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

  function pickPhoto(index: number | null) {
    setEditingPhotoIndex(index);
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  }

  function removePhoto(index: number) {
    const next = data.photos.filter((_, i) => i !== index);
    let main = data.mainPhotoIndex;
    if (index === main) main = 0;
    else if (index < main) main -= 1;
    patch({ photos: next, mainPhotoIndex: Math.max(0, Math.min(main, next.length - 1)) });
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
        <div className="rounded-3xl bg-white shadow-[0_20px_60px_-30px_rgba(32,26,29,0.25)] border border-ink-900/6 p-5 sm:p-9">
        {/* Progress */}
        {step.id !== "done" ? (
          <div className="relative flex items-center gap-3 mb-6">
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
              <p className="absolute inset-x-0 top-full mt-0.5 text-center text-xs font-medium text-ink-700/70">
                Step {stepIndex + 1} of {total}
              </p>
            </div>

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
                <GenderTile
                  label="Brother"
                  tone="sky"
                  image="/images/signup/gender-brother.png"
                  selected={data.gender === "Brother"}
                  onClick={() => patch({ gender: "Brother", appearance: [], communicationMode: "" })}
                />
                <GenderTile
                  label="Sister"
                  tone="rose"
                  image="/images/signup/gender-sister.png"
                  selected={data.gender === "Sister"}
                  onClick={() => patch({ gender: "Sister", appearance: [] })}
                />
              </ChoiceGrid>
            )}

            {step.id === "name" && (
              <input
                className="field"
                placeholder={data.gender === "Sister" ? "e.g. Fatima Khan" : "e.g. Ahmed Khan"}
                value={data.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                autoFocus
              />
            )}

            {step.id === "marital" && (
              <ChoiceGrid count={4}>
                {OPEN_TO_OPTIONS.map((o) => {
                  const v = o === "Never married" ? "Never Married" : o;
                  return (
                    <ChoiceTile
                      key={v}
                      label={v}
                      tone={MARITAL_TILES[o].tone}
                      icon={MARITAL_TILES[o].icon}
                      selected={data.maritalStatus === v}
                      onClick={() => patch({ maritalStatus: v })}
                    />
                  );
                })}
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
                <label htmlFor="signup-country" className="block text-xs font-semibold text-ink-900 mb-1.5">
                  Country
                </label>
                <select
                  id="signup-country"
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
                <p className="pt-3 text-xs font-semibold text-ink-900 mb-1.5">City / town</p>
                <CityPicker
                  value={data.city}
                  country={data.country}
                  initiallyConfirmed={Boolean(data.cityConfirmed)}
                  onChange={(city, confirmed, placeId) =>
                    patch({ city, cityConfirmed: confirmed, cityPlaceId: confirmed ? placeId : undefined })
                  }
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
              <>
                <p className="text-sm font-semibold text-ink-950">Languages</p>
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
                            // The level only exists alongside Pashto.
                            ...(lang === "Pashto" && on ? { pashtoLevel: "" } : {}),
                          })
                        }
                      >
                        {lang}
                      </Chip>
                    );
                  })}
                </div>
                {data.languages.includes("Pashto") ? (
                  <PashtoLevelQuestion value={data.pashtoLevel} onChange={(v) => patch({ pashtoLevel: v })} />
                ) : null}
              </>
            )}

            {step.id === "tribe" && (
              <TribePicker selected={data.tribe ? [data.tribe] : []} onChange={([tribe]) => patch({ tribe: tribe ?? "" })} />
            )}

            {step.id === "openTo" && (
              <>
                <ChoiceGrid count={4}>
                  {OPEN_TO_OPTIONS.map((v) => {
                    const on = data.openTo.includes(v);
                    return (
                      <ChoiceTile
                        key={v}
                        label={v}
                        tone={MARITAL_TILES[v].tone}
                        icon={MARITAL_TILES[v].icon}
                        multi
                        selected={on}
                        onClick={() =>
                          patch({
                            openTo: on ? data.openTo.filter((x) => x !== v) : [...data.openTo, v],
                          })
                        }
                      />
                    );
                  })}
                </ChoiceGrid>
                <p className="text-xs text-ink-700/50 leading-relaxed">
                  You can select more than one, but at least one must be selected to continue. Leaving an
                  option unselected means those profiles won&apos;t be included in your preferences.
                </p>
              </>
            )}

            {step.id === "family" && (
              <>
                <p className="text-xs font-semibold text-ink-900">Do you currently have children?</p>
                <ChoiceGrid count={2}>
                  <ChoiceTile
                    label="Yes, I have children"
                    tone="sky"
                    icon={I.baby}
                    selected={data.hasChildren === "Have Children"}
                    onClick={() => patch({ hasChildren: "Have Children" })}
                  />
                  <ChoiceTile
                    label="No, I don't"
                    tone="sand"
                    icon={I.babyOff}
                    selected={data.hasChildren === "No Children"}
                    onClick={() => patch({ hasChildren: "No Children" })}
                  />
                </ChoiceGrid>
                <p className="pt-3 text-xs font-semibold text-ink-900">Would you like children in the future?</p>
                <ChoiceGrid count={2}>
                  <ChoiceTile
                    label="Yes, Insha'Allah"
                    hint="If Allah wills"
                    tone="mint"
                    icon={I.babySparkle}
                    selected={
                      data.willingChildren === "Insha'Allah if Allah Wills" ||
                      data.willingChildren === "Yes"
                    }
                    onClick={() => patch({ willingChildren: "Insha'Allah if Allah Wills" })}
                  />
                  <ChoiceTile
                    label="No"
                    tone="peach"
                    icon={I.babyNo}
                    selected={data.willingChildren === "No"}
                    onClick={() => patch({ willingChildren: "No" })}
                  />
                </ChoiceGrid>
              </>
            )}

            {step.id === "faith" && (
              <>
              <ChoiceGrid count={4}>
                {(
                  [
                    {
                      v: "Strictly Practising",
                      hint: "All 5 salah consistently; deen guides daily life",
                      tone: "mint" as const,
                      icon: I.practiceStrict,
                    },
                    {
                      v: "Actively Practising",
                      hint: "Prays all 5 salah and actively practises",
                      tone: "sky" as const,
                      icon: I.practiceActive,
                    },
                    {
                      v: "Occasionally Practising",
                      hint: "Practises, but not always consistently",
                      tone: "peach" as const,
                      icon: I.practiceOccasional,
                    },
                    {
                      v: "Does Not Practise",
                      hint: "Muslim, but not currently practising regularly",
                      tone: "rose" as const,
                      icon: I.practiceNone,
                    },
                  ] as const
                ).map((o) => (
                  <ChoiceTile
                    key={o.v}
                    label={o.v}
                    hint={o.hint}
                    tone={o.tone}
                    icon={o.icon}
                    showCheck
                    selected={data.religiousPractice === o.v}
                    onClick={() => patch({ religiousPractice: o.v })}
                  />
                ))}
              </ChoiceGrid>
              <p className="pt-4 text-xs font-semibold text-ink-900">How regularly do you pray?</p>
              <div className="space-y-2">
                {SALAH_OPTIONS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => patch({ salah: o })}
                    className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition ${
                      data.salah === o ? "border-rose-400 bg-rose-50 text-ink-950" : "border-ink-900/10 hover:border-rose-200"
                    }`}
                  >
                    <span className="font-semibold">{salahShortLabel(o)}</span>
                    <span className="block text-[12px] text-ink-700/65">{o.split("–").slice(1).join("–").trim()}</span>
                  </button>
                ))}
              </div>
              </>
            )}

            {step.id === "appearance" && data.gender === "Brother" && (
              <ChoiceGrid count={5}>
                {MEN_APPEARANCE.map((v) => (
                  <BeardTile
                    key={v}
                    label={v}
                    selected={data.appearance[0] === v}
                    onClick={() => patch({ appearance: [v] })}
                  />
                ))}
              </ChoiceGrid>
            )}

            {step.id === "appearance" && data.gender === "Sister" && (() => {
              const { head, dress } = splitWomenAppearance(data.appearance);
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
                        onClick={() => patch({ appearance: [o.v, ...dress] })}
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
                            patch({
                              appearance: [
                                ...(head ? [head] : []),
                                ...(on ? dress.filter((x) => x !== o.v) : [...dress, o.v]),
                              ],
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </>
              );
            })()}

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
                      onClick={() =>
                        // Homemaker / Unemployed aren't asked — drop any answer typed earlier.
                        patch({ employment: o.v, ...(occupationPrompt(o.v) ? {} : { occupation: "" }) })
                      }
                    />
                  ))}
                </ChoiceGrid>
                {(() => {
                  const prompt = occupationPrompt(data.employment);
                  if (!prompt) return null;
                  return (
                    <>
                      <label
                        htmlFor="signup-occupation"
                        className="block pt-3 text-xs font-semibold text-ink-900 mb-1.5"
                      >
                        {prompt.label}
                      </label>
                      <input
                        id="signup-occupation"
                        className="field"
                        placeholder={prompt.placeholder}
                        maxLength={100}
                        required
                        value={data.occupation}
                        onChange={(e) => patch({ occupation: e.target.value })}
                      />
                    </>
                  );
                })()}
              </>
            )}

            {step.id === "lifestyle" && (
              <>
                <p className="text-xs font-semibold text-ink-900">Smoking</p>
                <ChoiceGrid count={3}>
                  {(
                    [
                      { v: "Never", tone: "mint" as const, icon: LIFESTYLE_ICONS.smoking[0] },
                      { v: "Occasionally", tone: "peach" as const, icon: LIFESTYLE_ICONS.smoking[1] },
                      { v: "Regularly", tone: "rose" as const, icon: LIFESTYLE_ICONS.smoking[2] },
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
                      { v: "Never", tone: "mint" as const, icon: LIFESTYLE_ICONS.vaping[0] },
                      { v: "Occasionally", tone: "peach" as const, icon: LIFESTYLE_ICONS.vaping[1] },
                      { v: "Regularly", tone: "rose" as const, icon: LIFESTYLE_ICONS.vaping[2] },
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
                <WordHint text={data.about} />
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
                <WordHint text={data.lookingFor} />
              </>
            )}

            {step.id === "photo" && (
              <div className="space-y-4">
                <p className="text-sm text-ink-700/70">
                  {wearsNiqab
                    ? "If you wear a niqab, you may upload yourself in a niqab or choose to upload something else."
                    : "Upload a clear photo of yourself. Add up to 3 — you choose which is your main photo."}
                </p>

                {data.photos.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => pickPhoto(null)}
                    className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 flex flex-col items-center justify-center gap-3 overflow-hidden hover:border-rose-400 transition"
                  >
                    <span className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-rose-600">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                    <div className="text-center px-6">
                      <p className="font-semibold text-ink-950">Add a photo</p>
                      <p className="text-xs text-ink-700/60 mt-1">JPG or PNG · max 6MB · reviewed by humans</p>
                    </div>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {data.photos.map((src, i) => (
                      <div key={i} className="relative">
                        <div className="aspect-square rounded-xl overflow-hidden border border-ink-900/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          aria-label={`Remove photo ${i + 1}`}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-ink-950 text-white text-xs flex items-center justify-center shadow"
                        >
                          ✕
                        </button>
                        {data.mainPhotoIndex === i ? (
                          <span className="absolute bottom-1 left-1 right-1 text-[10px] font-bold uppercase tracking-wide bg-rose-600 text-white rounded px-1 py-0.5 text-center">
                            Main
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => patch({ mainPhotoIndex: i })}
                            className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold bg-white/90 text-ink-900 rounded px-1 py-0.5 text-center hover:bg-white"
                          >
                            Set main
                          </button>
                        )}
                      </div>
                    ))}
                    {data.photos.length < MAX_PHOTOS ? (
                      <button
                        type="button"
                        onClick={() => pickPhoto(null)}
                        className="aspect-square rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/40 flex items-center justify-center text-rose-600 hover:border-rose-400"
                        aria-label="Add another photo"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-ink-700/55">
                  Every photo is manually reviewed before it goes live.
                </p>
              </div>
            )}

            {step.id === "commMode" && (
              <>
                <ChoiceGrid count={2}>
                  {(
                    [
                      { id: "standard", tone: "sky" as const, icon: I.chat },
                      { id: "wali_oversight", tone: "lilac" as const, icon: I.eye },
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
                        onClick={() => patch({ communicationMode: m.id })}
                      />
                    );
                  })}
                </ChoiceGrid>
                {data.communicationMode ? (
                  <p className="text-xs text-ink-700/70 leading-relaxed rounded-xl bg-white/70 border border-ink-900/8 px-3 py-2.5">
                    {COMM_MODES.find((c) => c.id === data.communicationMode)?.blurb}
                  </p>
                ) : null}
              </>
            )}

            {step.id === "phone" && (
              <>
              <div className="flex gap-2">
                <PhoneCodePicker
                  iso={data.phoneIso}
                  dialCode={data.phoneCountry}
                  onChange={(c) => patch({ phoneIso: c.iso, phoneCountry: c.dialCode })}
                />
                <input
                  className="field"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={24}
                  aria-label="Phone number"
                  aria-invalid={phoneError}
                  aria-describedby={phoneError ? "signup-phone-error" : undefined}
                  placeholder={phonePlaceholder(data.phoneIso)}
                  value={data.phone}
                  onChange={(e) => patch({ phone: sanitizePhoneInput(e.target.value) })}
                  onBlur={() => setPhoneTouched(true)}
                />
              </div>
              {phoneError ? (
                <p id="signup-phone-error" role="alert" className="text-xs text-rose-700">
                  {PHONE_INVALID_MESSAGE}
                </p>
              ) : null}
              </>
            )}

            {step.id === "account" && (
              <>
                <div>
                  <label htmlFor="signup-email" className="block text-xs font-semibold text-ink-900 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="signup-email"
                    className="field"
                    type="email"
                    autoComplete="email"
                    value={data.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </div>
                <div>
                  <PasswordField
                    id="signup-password"
                    label="Password"
                    value={data.password}
                    maxLength={PASSWORD_MAX}
                    invalid={data.password !== "" && passwordWeak}
                    describedBy="signup-password-help"
                    onChange={(v) => patch({ password: v })}
                  />
                  <div id="signup-password-help" className="mt-1.5 text-xs" aria-live="polite">
                    {data.password === "" ? (
                      <p className="text-ink-700/60">{PASSWORD_HINT}</p>
                    ) : (
                      <>
                        <PasswordRule state={pw.longEnough ? "pass" : "fail"}>{PASSWORD_MIN}+ characters</PasswordRule>
                        <PasswordRule
                          state={!pw.longEnough ? "pending" : passwordWeak ? "fail" : breachChecking ? "pending" : "pass"}
                        >
                          {pw.longEnough && !passwordWeak && breachChecking
                            ? "Checking against known breached passwords…"
                            : "Not a common or easily guessed password"}
                        </PasswordRule>
                        {pw.longEnough && passwordWeak ? (
                          <p role="alert" className="mt-1 text-rose-700">{PASSWORD_WEAK_MESSAGE}</p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <PasswordField
                    id="signup-confirm-password"
                    label="Confirm password"
                    value={data.confirmPassword}
                    maxLength={PASSWORD_MAX}
                    invalid={data.confirmPassword !== "" && data.password !== data.confirmPassword}
                    describedBy="signup-confirm-help"
                    onChange={(v) => patch({ confirmPassword: v })}
                  />
                  <div id="signup-confirm-help" className="mt-1.5 text-xs" aria-live="polite">
                    {data.confirmPassword !== "" ? (
                      <PasswordRule state={data.password === data.confirmPassword ? "pass" : "fail"}>
                        {data.password === data.confirmPassword ? "Passwords match" : "Passwords do not match"}
                      </PasswordRule>
                    ) : null}
                  </div>
                </div>
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
              className="w-full mt-7 py-3.5 flex items-center justify-center gap-2 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(170,25,69,0.55)]"
            >
              {submitting
                ? "Creating account…"
                : step.id === "account"
                  ? "Create account"
                  : step.id === "phone"
                    ? "Continue"
                    : left === 0
                      ? "Finish"
                      : "Next"}
              {!submitting ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              ) : null}
            </button>
          ) : null}
        </div>
        </div>
      </main>

      {cropSource ? (
        <PhotoCropModal
          src={cropSource}
          onCancel={() => {
            setCropSource(null);
            setEditingPhotoIndex(null);
          }}
          onSave={(cropped) => {
            const next = [...data.photos];
            if (editingPhotoIndex != null && editingPhotoIndex < next.length) {
              next[editingPhotoIndex] = cropped;
            } else if (next.length < MAX_PHOTOS) {
              next.push(cropped);
            }
            patch({ photos: next });
            setCropSource(null);
            setEditingPhotoIndex(null);
          }}
        />
      ) : null}
    </div>
  );
}
