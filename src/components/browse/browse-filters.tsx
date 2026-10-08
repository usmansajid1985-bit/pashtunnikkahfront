"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  BrowseFilters,
  SALAH_OPTIONS,
  countActiveFilters,
  filtersToQuery,
  stripGoldFilters,
} from "@/lib/browse-filters-shared";
import { LocationFilter, locationNarrows, locationSummary, type LocationChoice } from "@/components/browse/location-filter";
import { FilterPresets } from "@/components/browse/filter-presets";
import { RELOCATION_OPTIONS } from "@/lib/relocation";
import { COUNTRIES } from "@/lib/country";
import { HEIGHT_FILTER_STEPS } from "@/lib/height";
import { TribePicker } from "@/components/tribe/tribe-picker";
import { formatTribeList, parseTribeList } from "@/lib/tribes";
import {
  ANCESTRAL_REGIONS,
  EDUCATION_OPTIONS,
  LANGUAGES_ORDERED,
  MEN_APPEARANCE,
  WOMEN_DRESS_STYLE,
  WOMEN_HEAD_COVERING,
} from "@/lib/signup";
import { PASHTO_DIALECTS } from "@/lib/profile-optional";
import { PROFESSION_GROUPS } from "@/lib/professions";

export type FilterOptions = {
  countries: string[];
  cities: string[];
  marital: string[];
  sects: string[];
  practices: string[];
  relocate: string[];
  appearances: string[];
  educations: string[];
  dialects: string[];
  ancestral: string[];
  heights: string[];
  languages: string[];
};

type Props = {
  filters: BrowseFilters;
  options: FilterOptions;
  isGold?: boolean;
  /** The gender being browsed (opposite of the viewer) — drives the appearance options shown. */
  targetGender?: "male" | "female" | null;
  /** Per-member key under which the last applied filters are remembered on this device. */
  rememberKey?: string;
  savedLocation?: {
    city: string | null;
    country: string | null;
    countryCode: string | null;
    radiusMiles: number;
    countryOnly: boolean;
    hasPin: boolean;
  };
};

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill-btn"
      style={active ? { borderColor: "#f0c3d3", color: "#aa1945" } : undefined}
    >
      {children}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

function GoldTag({ locked }: { locked?: boolean }) {
  const pill = "text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200/70 px-1.5 py-px rounded font-bold";
  if (locked) {
    return (
      <a href="/settings/membership" className={`${pill} hover:bg-amber-100`}>
        Gold · Upgrade
      </a>
    );
  }
  return <span className={pill}>Gold</span>;
}

const AGE_MIN = 18;
const AGE_MAX = 80;

/** Two-thumb age slider with the chosen ages shown above the thumbs. */
function AgeRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const pct = (v: number) => ((v - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;
  // Keeps a bubble centred on its 24px thumb, which travels 24px less than the track.
  const at = (v: number) => `calc(${pct(v)}% + ${12 - pct(v) * 0.24}px)`;
  return (
    <div className="pn-dual relative h-6 mt-8">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#e7e2e0]" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-rose-600"
        style={{ left: at(min), right: `calc(100% - ${at(max)})` }}
      />
      {[min, max].map((v, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute -top-7 -translate-x-1/2 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-600"
          style={{ left: at(v) }}
        >
          {v}
        </span>
      ))}
      <input
        type="range"
        min={AGE_MIN}
        max={AGE_MAX}
        value={min}
        aria-label={`Minimum age (${min})`}
        onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)}
        // When both thumbs sit at the top end, the minimum must stay grabbable.
        style={{ zIndex: min > AGE_MAX - 2 ? 3 : 1 }}
      />
      <input
        type="range"
        min={AGE_MIN}
        max={AGE_MAX}
        value={max}
        aria-label={`Maximum age (${max})`}
        onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))}
        style={{ zIndex: 2 }}
      />
    </div>
  );
}

/** Feet-and-inches part of a height label: `5'9" (175 cm)` → `5'9"`. */
const shortHeight = (label: string) => label.split(" (")[0];

function Field({
  label,
  children,
  gold,
  locked,
}: {
  label: string;
  children: React.ReactNode;
  gold?: boolean;
  /** Gold-gated field, current viewer is not Gold — show as locked and disable the control. */
  locked?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-semibold text-ink-900 mb-1.5">
        {label}
        {gold ? <GoldTag locked={locked} /> : null}
      </span>
      <fieldset disabled={locked} className={locked ? "opacity-50" : undefined}>
        {children}
      </fieldset>
    </label>
  );
}

const selectClass =
  "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white";

export function BrowseFiltersBar({
  filters,
  options,
  isGold = false,
  targetGender = null,
  rememberKey,
  savedLocation,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [tribeOpen, setTribeOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [draft, setDraft] = useState<BrowseFilters>(filters);
  // The saved search area ("Horsham · 25 miles"). "Use this location" saves it straight away;
  // whether it is part of the search is `draft.near`, applied with every other filter.
  const [area, setArea] = useState<LocationChoice | null>(
    savedLocation?.hasPin
      ? {
          city: savedLocation.city,
          country: savedLocation.country,
          countryCode: savedLocation.countryCode,
          radiusMiles: savedLocation.radiusMiles,
          countryOnly: savedLocation.countryOnly,
        }
      : null
  );
  const [areaChanged, setAreaChanged] = useState(false);
  const locked = !isGold;
  const activeCount = countActiveFilters(filters, isGold);
  const draftTribes = parseTribeList(draft.tribe);

  // Remember the last applied filters: coming back to a plain /browse restores them.
  const storageKey = rememberKey ? `pn_browse_filters:${rememberKey}` : null;
  useEffect(() => {
    if (!storageKey || window.location.search) return;
    try {
      const last = localStorage.getItem(storageKey);
      if (last) router.replace(`/browse${last}`);
    } catch {
      /* storage unavailable — nothing to restore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(next: BrowseFilters) {
    // A Basic viewer can never submit Gold-only filters — strip them so the URL and the
    // result set always agree with what the UI shows (PN-BROWSE-002).
    const safe = isGold ? next : stripGoldFilters(next);
    const query = filtersToQuery({ ...safe, page: 1 });
    if (storageKey) {
      try {
        if (query) localStorage.setItem(storageKey, query);
        else localStorage.removeItem(storageKey);
      } catch {
        /* storage unavailable */
      }
    }
    startTransition(() => {
      router.push(`/browse${query}`);
      // A new search area doesn't change the URL (it is saved on the account) — reload results.
      if (areaChanged) router.refresh();
    });
    setAreaChanged(false);
  }

  function openPanel(location = false) {
    setDraft(filters);
    setTribeOpen(false);
    setRegionOpen(false);
    setLocationOpen(location);
    setOpen(true);
  }

  function closePanel() {
    setLocationOpen(false);
    setTribeOpen(false);
    setRegionOpen(false);
    setOpen(false);
  }

  function applyDraft() {
    closePanel();
    // City and Interests are no longer filters — never carry an old one along invisibly.
    navigate({ ...draft, city: "", interests: "" });
  }

  function clearAll() {
    const cleared: BrowseFilters = {
      ...filters,
      ageMin: 18,
      ageMax: 60,
      country: "",
      city: "",
      marital: "",
      sect: "",
      practice: "",
      tribe: "",
      relocate: "",
      salah: "",
      appearance: "",
      education: "",
      dialect: "",
      ancestral: "",
      height: "",
      occupation: "",
      language: "",
      dress: "",
      interests: "",
      goldOnly: false,
      newMembers: false,
      recentlyActive: false,
      near: false,
      sort: "newest",
      page: 1,
    };
    setDraft(cleared);
    navigate(cleared);
    closePanel();
  }

  // Appearance options of the gender being browsed: head covering + dress style for sisters,
  // beard style for brothers. A value from an older link stays selectable.
  const browsingBrothers = targetGender === "male";
  const withCurrent = (list: { v: string; label: string }[], current: string) =>
    current && !list.some((o) => o.v === current) ? [{ v: current, label: current }, ...list] : list;
  const dressOptions = withCurrent(
    browsingBrothers
      ? MEN_APPEARANCE.map((v) => ({ v, label: v }))
      : WOMEN_HEAD_COVERING.map((o) => ({ v: o.v, label: o.v === "Does Not Wear Hijab" ? "No hijab" : o.label })),
    draft.dress
  );
  const styleOptions = withCurrent(
    WOMEN_DRESS_STYLE.map((o) => ({ v: o.v, label: o.label })),
    draft.appearance
  );
  const professionOptions = withCurrent(
    PROFESSION_GROUPS.map((g) => ({ v: g.id, label: g.label })),
    draft.occupation
  );
  const shownRegions = ANCESTRAL_REGIONS.filter((r) => r.toLowerCase().includes(regionQuery.trim().toLowerCase()));

  // Minimum height slider: position 0 is "Any", then one stop per height step.
  const heightIdx = (() => {
    const cm = Number(draft.height);
    if (!draft.height || !Number.isFinite(cm) || cm <= 0) return 0;
    let best = 0;
    HEIGHT_FILTER_STEPS.forEach((h, i) => {
      if (Math.abs(h.cm - cm) < Math.abs(HEIGHT_FILTER_STEPS[best].cm - cm)) best = i;
    });
    return best + 1;
  })();
  const heightStep = heightIdx > 0 ? HEIGHT_FILTER_STEPS[heightIdx - 1] : null;

  return (
    <>
      <div className={`mt-5 flex flex-wrap items-center gap-3 ${pending ? "opacity-70" : ""}`}>
        <Pill active={filters.ageMin !== 18 || filters.ageMax !== 60} onClick={() => openPanel()}>
          {filters.ageMin} – {filters.ageMax} yrs
        </Pill>

        {locked ? (
          <a href="/settings/membership" className="pill-btn" title="Distance search is a Gold feature">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.8">
              <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
              <circle cx="12" cy="10.5" r="2" />
            </svg>
            Distance
            <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
              Gold
            </span>
          </a>
        ) : (
          <Pill active={filters.near} onClick={() => openPanel(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.8">
              <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
              <circle cx="12" cy="10.5" r="2" />
            </svg>
            {filters.near && area ? locationSummary(area) : "Any location"}
          </Pill>
        )}

        <button
          type="button"
          className="pill-btn"
          style={activeCount > 0 ? { borderColor: "#f0c3d3", color: "#aa1945" } : undefined}
          onClick={() => openPanel()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M8 6v3M4 12h16M14 12v3M4 18h16M10 18v3" />
            <circle cx="8" cy="9" r="1.6" fill="white" stroke="currentColor" />
            <circle cx="14" cy="15" r="1.6" fill="white" stroke="currentColor" />
            <circle cx="10" cy="21" r="1.6" fill="white" stroke="currentColor" />
          </svg>
          More Filters
          {activeCount > 0 ? (
            <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          ) : null}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="pill-btn cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <select
              className="bg-transparent text-sm font-medium outline-none"
              value={filters.sort === "recently_active" ? "newest" : filters.sort}
              onChange={(e) =>
                navigate({
                  ...filters,
                  sort: e.target.value as BrowseFilters["sort"],
                })
              }
            >
              {/* B23: "newest" is the activity ranking — shown as Recently active. */}
              <option value="newest">Recently active</option>
              <option value="best_match">{isGold ? "Compatibility" : "Compatibility (Gold)"}</option>
              <option value="age_asc">Age ↑</option>
              <option value="age_desc">Age ↓</option>
            </select>
          </label>
        </div>
      </div>

      <FilterPresets isGold={isGold} currentFilters={filters} onLoad={(next) => navigate(next)} />

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-ink-950/30" aria-label="Close filters" onClick={closePanel} />
          <aside className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col animate-in">
            {locationOpen ? (
              <LocationFilter
                active={draft.near}
                onClose={() => setLocationOpen(false)}
                onUse={(choice) => {
                  setArea(choice);
                  setAreaChanged(true);
                  setDraft((d) => ({ ...d, near: locationNarrows(choice) }));
                  setLocationOpen(false);
                }}
              />
            ) : tribeOpen ? (
              <>
                <div className="px-5 py-4 border-b border-ink-900/8 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-ink-950 text-lg">Select tribe(s)</h2>
                    <p className="text-xs text-ink-700/60 mt-0.5">Choose as many as you&apos;re open to.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTribeOpen(false)}
                    aria-label="Back to filters"
                    className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <TribePicker
                    multiple
                    selected={draftTribes}
                    onChange={(next) => setDraft((d) => ({ ...d, tribe: formatTribeList(next) }))}
                  />
                </div>
                <div className="p-4 border-t border-ink-900/8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, tribe: "" }))}
                    className="flex-1 py-3 rounded-full border border-ink-900/12 text-sm font-semibold"
                  >
                    Any tribe
                  </button>
                  <button
                    type="button"
                    onClick={() => setTribeOpen(false)}
                    className="flex-1 py-3 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : regionOpen ? (
              <>
                <div className="px-5 py-4 border-b border-ink-900/8 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-ink-950 text-lg">Ancestral region</h2>
                    <p className="text-xs text-ink-700/60 mt-0.5">Pakhtunkhwa / Afghanistan</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegionOpen(false)}
                    aria-label="Back to filters"
                    className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-5 pt-4">
                  <input
                    type="search"
                    value={regionQuery}
                    onChange={(e) => setRegionQuery(e.target.value)}
                    placeholder="Search region..."
                    aria-label="Search region"
                    autoComplete="off"
                    className={selectClass}
                  />
                </div>
                <div role="radiogroup" aria-label="Ancestral region" className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
                  {["", ...shownRegions].map((r) => {
                    const on = draft.ancestral === r;
                    return (
                      <button
                        key={r || "any"}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setDraft((d) => ({ ...d, ancestral: r }));
                          setRegionOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm ${
                          on ? "border-rose-600 bg-rose-50 font-semibold text-rose-700" : "border-ink-900/10 hover:border-rose-200"
                        }`}
                      >
                        {r || "Any region"}
                        {on ? <span aria-hidden>✓</span> : null}
                      </button>
                    );
                  })}
                  {shownRegions.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-ink-700/70">No region matches “{regionQuery.trim()}”.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-ink-900/8 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-ink-950 text-xl">Filters</h2>
                    <p className="text-xs text-ink-700/60 mt-0.5">Refine your search and find a better match</p>
                  </div>
                  <button
                    type="button"
                    onClick={closePanel}
                    aria-label="Close filters"
                    className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-base font-bold text-ink-950">Basic filters</h3>
                    <div>
                      <span className="text-xs font-semibold text-ink-900">
                        Age ({draft.ageMin} – {draft.ageMax})
                      </span>
                      <AgeRange
                        min={draft.ageMin}
                        max={draft.ageMax}
                        onChange={(ageMin, ageMax) => setDraft((d) => ({ ...d, ageMin, ageMax }))}
                      />
                    </div>

                    <Field label="Country">
                      <select
                        className={selectClass}
                        value={draft.country}
                        onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                      >
                        <option value="">Any country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Marital status">
                      <select
                        className={selectClass}
                        value={draft.marital}
                        onChange={(e) => setDraft({ ...draft, marital: e.target.value })}
                      >
                        <option value="">Any</option>
                        {options.marital.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Islamic background (sect)" gold locked={locked}>
                      <select
                        className={selectClass}
                        value={draft.sect}
                        onChange={(e) => setDraft({ ...draft, sect: e.target.value })}
                      >
                        <option value="">Any</option>
                        {options.sects.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </section>

                  <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-b from-amber-50/70 to-rose-50/40 p-4 space-y-5">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-bold text-rose-600">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M10 3l1.8 4.7L16.5 9.5l-4.7 1.8L10 16l-1.8-4.7L3.5 9.5l4.7-1.8L10 3Zm8 10 .9 2.3 2.3.9-2.3.9L18 19.5l-.9-2.4-2.3-.9 2.3-.9L18 13Z" />
                        </svg>
                        Advanced filters
                        <span className="rounded-full bg-gradient-to-r from-rose-300 via-amber-300 to-amber-400 px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-950 shadow-sm">
                          Gold
                        </span>
                      </h3>
                      {locked ? (
                        <a
                          href="/settings/membership"
                          className="mt-2.5 block rounded-xl border border-amber-200 bg-white/70 px-3.5 py-2.5 text-xs text-amber-900"
                        >
                          <span className="font-bold">Upgrade to Gold</span> to search by distance, tribe, faith,
                          education and more. Age, country and marital status are always available.
                        </a>
                      ) : null}
                    </div>

                    <section className="space-y-3">
                      <h4 className="text-sm font-bold text-ink-950">Location</h4>
                      <Field label="Distance" gold locked={locked}>
                        <button
                          type="button"
                          onClick={() => setLocationOpen(true)}
                          className={`${selectClass} text-left flex items-center justify-between gap-3`}
                        >
                          <span className={`truncate ${draft.near && area ? "font-semibold text-ink-950" : ""}`}>
                            {draft.near && area ? locationSummary(area) : "Set your location & search radius"}
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </Field>
                      {draft.near && area ? (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => setDraft((d) => ({ ...d, near: false }))}
                          className="-mt-1 text-xs font-semibold text-rose-700 hover:underline"
                        >
                          Remove location filter
                        </button>
                      ) : null}
                      <Field label="Relocation plans" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.relocate}
                          onChange={(e) => setDraft({ ...draft, relocate: e.target.value })}
                        >
                          <option value="">Any</option>
                          {RELOCATION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </section>

                    <section className="space-y-3 border-t border-ink-900/8 pt-4">
                      <h4 className="text-sm font-bold text-ink-950">About them</h4>
                      <Field label="Minimum height" gold locked={locked}>
                        <input
                          type="range"
                          min={0}
                          max={HEIGHT_FILTER_STEPS.length}
                          step={1}
                          value={heightIdx}
                          onChange={(e) => {
                            const i = Number(e.target.value);
                            setDraft({ ...draft, height: i === 0 ? "" : String(HEIGHT_FILTER_STEPS[i - 1].cm) });
                          }}
                          className="pn-range w-full mt-1"
                          style={{ "--pn-fill": `${(heightIdx / HEIGHT_FILTER_STEPS.length) * 100}%` } as React.CSSProperties}
                          aria-valuetext={heightStep ? `${heightStep.label} or taller` : "Any height"}
                        />
                        <span className="mt-1 flex justify-between text-xs text-ink-700/60">
                          <span>Any</span>
                          <span className="font-semibold text-ink-950">
                            {heightStep ? `${heightStep.label} or taller` : "Any height"}
                          </span>
                          <span>{shortHeight(HEIGHT_FILTER_STEPS[HEIGHT_FILTER_STEPS.length - 1].label)}</span>
                        </span>
                      </Field>
                      <Field label="Education" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.education}
                          onChange={(e) => setDraft({ ...draft, education: e.target.value })}
                        >
                          <option value="">Any</option>
                          {withCurrent(EDUCATION_OPTIONS.map((v) => ({ v, label: v })), draft.education).map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Profession" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.occupation}
                          onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
                        >
                          <option value="">Any</option>
                          {professionOptions.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Pashto dialect" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.dialect}
                          onChange={(e) => setDraft({ ...draft, dialect: e.target.value })}
                        >
                          <option value="">Any</option>
                          {PASHTO_DIALECTS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tribe" gold locked={locked}>
                        <button
                          type="button"
                          onClick={() => setTribeOpen(true)}
                          className={`${selectClass} text-left flex items-center justify-between gap-3`}
                        >
                          <span className="truncate">
                            {draftTribes.length === 0
                              ? "Any"
                              : draftTribes.length <= 2
                                ? draftTribes.join(", ")
                                : `${draftTribes.length} tribes`}
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </Field>
                      <Field label="Ancestral region" gold locked={locked}>
                        <button
                          type="button"
                          onClick={() => {
                            setRegionQuery("");
                            setRegionOpen(true);
                          }}
                          className={`${selectClass} text-left flex items-center justify-between gap-3`}
                        >
                          <span className="truncate">{draft.ancestral || "Any"}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </Field>
                      <Field label="Language" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.language}
                          onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                        >
                          <option value="">Any</option>
                          {LANGUAGES_ORDERED.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <fieldset disabled={locked} className={`space-y-2 pt-1 ${locked ? "opacity-50" : ""}`}>
                        <legend className="flex items-center gap-2 text-xs font-semibold text-ink-900 mb-1.5">
                          Activity <GoldTag locked={locked} />
                        </legend>
                        {(
                          [
                            ["newMembers", "New members (last 7 days)"],
                            ["recentlyActive", "Recently active (30 days)"],
                            ["goldOnly", "Gold members only"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draft[key]}
                              onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                              className="accent-rose-600"
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                    </section>

                    <section className="space-y-3 border-t border-ink-900/8 pt-4">
                      <h4 className="text-sm font-bold text-ink-950">Faith &amp; appearance</h4>
                      <Field label="Religious practice" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.practice}
                          onChange={(e) => setDraft({ ...draft, practice: e.target.value })}
                        >
                          <option value="">Any</option>
                          {options.practices.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={browsingBrothers ? "Beard" : "Islamic dress"} gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.dress}
                          onChange={(e) => setDraft({ ...draft, dress: e.target.value })}
                        >
                          <option value="">Any</option>
                          {dressOptions.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {browsingBrothers ? null : (
                        <Field label="Dress style" gold locked={locked}>
                          <select
                            className={selectClass}
                            value={draft.appearance}
                            onChange={(e) => setDraft({ ...draft, appearance: e.target.value })}
                          >
                            <option value="">Any</option>
                            {styleOptions.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="Salah pattern" gold locked={locked}>
                        <select
                          className={selectClass}
                          value={draft.salah}
                          onChange={(e) => setDraft({ ...draft, salah: e.target.value })}
                        >
                          <option value="">Any</option>
                          {SALAH_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </section>
                  </div>
                </div>

                <div className="p-4 border-t border-ink-900/8 flex gap-3">
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex-1 py-3 rounded-full border border-ink-900/12 text-sm font-semibold"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={applyDraft}
                    className="flex-1 py-3 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
                  >
                    Apply
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
