"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BrowseFilters,
  SALAH_OPTIONS,
  countActiveFilters,
  filtersToQuery,
  stripGoldFilters,
} from "@/lib/browse-filters-shared";
import { LocationFilter } from "@/components/browse/location-filter";
import { FilterPresets } from "@/components/browse/filter-presets";

export type FilterOptions = {
  countries: string[];
  cities: string[];
  ethnicities: string[];
  marital: string[];
  sects: string[];
  practices: string[];
  tribes: string[];
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
  savedLocation?: {
    city: string | null;
    country: string | null;
    countryCode: string | null;
    radiusMiles: number;
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
  if (locked) {
    return (
      <a
        href="/settings/membership"
        className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold hover:bg-amber-200"
      >
        Gold · Upgrade
      </a>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wide bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold">
      Gold
    </span>
  );
}

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

export function BrowseFiltersBar({ filters, options, isGold = false, savedLocation }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [draft, setDraft] = useState<BrowseFilters>(filters);
  const locked = !isGold;
  const activeCount = countActiveFilters(filters, isGold);

  function navigate(next: BrowseFilters) {
    // A Basic viewer can never submit Gold-only filters — strip them so the URL and the
    // result set always agree with what the UI shows (PN-BROWSE-002).
    const safe = isGold ? next : stripGoldFilters(next);
    startTransition(() => {
      router.push(`/browse${filtersToQuery({ ...safe, page: 1 })}`);
    });
  }

  function applyDraft() {
    setOpen(false);
    navigate(draft);
  }

  function clearAll() {
    const cleared: BrowseFilters = {
      ...filters,
      ageMin: 18,
      ageMax: 60,
      country: "",
      city: "",
      ethnicity: "",
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
    setOpen(false);
  }

  return (
    <>
      <div className={`mt-5 flex flex-wrap items-center gap-3 ${pending ? "opacity-70" : ""}`}>
        <Pill
          active={filters.ageMin !== 18 || filters.ageMax !== 60}
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
        >
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
          <Pill
            active={filters.near}
            onClick={() => {
              setDraft(filters);
              setOpen(true);
              setLocationOpen(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.8">
              <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
              <circle cx="12" cy="10.5" r="2" />
            </svg>
            {filters.near && savedLocation?.hasPin
              ? `${savedLocation.city || savedLocation.country || "Pinned area"} · ${savedLocation.radiusMiles} mi`
              : "Any location"}
          </Pill>
        )}

        <button
          type="button"
          className="pill-btn"
          style={activeCount > 0 ? { borderColor: "#f0c3d3", color: "#aa1945" } : undefined}
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
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
              value={filters.sort}
              onChange={(e) =>
                navigate({
                  ...filters,
                  sort: e.target.value as BrowseFilters["sort"],
                  recentlyActive: e.target.value === "recently_active" ? true : filters.recentlyActive,
                })
              }
            >
              <option value="newest">Most active</option>
              <option value="recently_active">Recently active</option>
              <option value="age_asc">Age ↑</option>
              <option value="age_desc">Age ↓</option>
            </select>
          </label>
        </div>
      </div>

      <FilterPresets isGold={isGold} currentFilters={filters} onLoad={(next) => navigate(next)} />

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/30"
            aria-label="Close filters"
            onClick={() => {
              setLocationOpen(false);
              setOpen(false);
            }}
          />
          <aside className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col animate-in">
            {locationOpen ? (
              <LocationFilter
                onClose={() => setLocationOpen(false)}
                onApplied={() => {
                  setLocationOpen(false);
                  navigate({ ...filters, near: true });
                }}
                onClearDistance={() => {
                  setLocationOpen(false);
                  navigate({ ...filters, near: false });
                }}
              />
            ) : (
              <>
            <div className="px-5 py-4 border-b border-ink-900/8 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-ink-950 text-lg">Filters</h2>
                <p className="text-xs text-ink-700/60 mt-0.5">All browse filters · Gold marked where gated</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {locked ? (
                <a
                  href="/settings/membership"
                  className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
                >
                  <span className="font-bold">Upgrade to Gold</span> to use city, distance, tribe,
                  keyword and activity filters. Age, country, marital status, religious practice and
                  relocation are always available.
                </a>
              ) : null}
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-ink-950">Basics</h3>
                <Field label={`Age (${draft.ageMin} – ${draft.ageMax})`}>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min={18}
                      max={80}
                      value={draft.ageMin}
                      aria-label={`Minimum age (${draft.ageMin})`}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          ageMin: Math.min(Number(e.target.value), d.ageMax),
                        }))
                      }
                      className="flex-1 accent-rose-600"
                    />
                    <input
                      type="range"
                      min={18}
                      max={80}
                      value={draft.ageMax}
                      aria-label={`Maximum age (${draft.ageMax})`}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          ageMax: Math.max(Number(e.target.value), d.ageMin),
                        }))
                      }
                      className="flex-1 accent-rose-600"
                    />
                  </div>
                </Field>

                <Field label="Country">
                  <select
                    className={selectClass}
                    value={draft.country}
                    onChange={(e) => setDraft({ ...draft, country: e.target.value, city: "" })}
                  >
                    <option value="">Any country</option>
                    {options.countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
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

              <fieldset disabled={locked} className={`space-y-3 ${locked ? "opacity-50" : ""}`}>
                <h3 className="text-sm font-bold text-ink-950 flex items-center gap-2">
                  Discovery <GoldTag locked={locked} />
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.newMembers}
                    onChange={(e) => setDraft({ ...draft, newMembers: e.target.checked })}
                    className="accent-rose-600"
                  />
                  New members (last 7 days)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.recentlyActive}
                    onChange={(e) => setDraft({ ...draft, recentlyActive: e.target.checked })}
                    className="accent-rose-600"
                  />
                  Recently active (30 days)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.goldOnly}
                    onChange={(e) => setDraft({ ...draft, goldOnly: e.target.checked })}
                    className="accent-rose-600"
                  />
                  Gold members only
                </label>
              </fieldset>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-ink-950">Location &amp; tribe</h3>
                <Field label="City" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  >
                    <option value="">Any city</option>
                    {options.cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Distance" gold locked={locked}>
                  <button
                    type="button"
                    onClick={() => setLocationOpen(true)}
                    className={`${selectClass} text-left flex items-center justify-between`}
                  >
                    <span>Set your location &amp; search radius</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </Field>
                <Field label="Tribe" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.tribe}
                    onChange={(e) => setDraft({ ...draft, tribe: e.target.value })}
                  >
                    <option value="">Any tribe</option>
                    {options.tribes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ancestral region" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.ancestral}
                    onChange={(e) => setDraft({ ...draft, ancestral: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options.ancestral.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Open to relocation">
                  <select
                    className={selectClass}
                    value={draft.relocate}
                    onChange={(e) => setDraft({ ...draft, relocate: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options.relocate.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-ink-950">Faith &amp; appearance</h3>
                <Field label="Religious practice">
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
                <Field label="Islamic dress (keyword)" gold locked={locked}>
                  <input
                    className={selectClass}
                    value={draft.dress}
                    onChange={(e) => setDraft({ ...draft, dress: e.target.value })}
                    placeholder="e.g. hijab, niqab"
                  />
                </Field>
                <Field label="Interests (keyword)" gold locked={locked}>
                  <input
                    className={selectClass}
                    value={draft.interests}
                    onChange={(e) => setDraft({ ...draft, interests: e.target.value })}
                    placeholder="e.g. reading, travel"
                  />
                </Field>
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
                <Field label="Appearance / Islamic dress" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.appearance}
                    onChange={(e) => setDraft({ ...draft, appearance: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options.appearances.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-ink-950">About them</h3>
                <Field label="Height" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.height}
                    onChange={(e) => setDraft({ ...draft, height: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options.heights.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Education" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.education}
                    onChange={(e) => setDraft({ ...draft, education: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options.educations.map((c) => (
                      <option key={c} value={c}>
                        {c}
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
                    {options.dialects.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Language" gold locked={locked}>
                  <select
                    className={selectClass}
                    value={draft.language}
                    onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                  >
                    <option value="">Any</option>
                    {options.languages.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Profession contains…" gold locked={locked}>
                  <input
                    className={selectClass}
                    value={draft.occupation}
                    placeholder="e.g. Engineer, Doctor"
                    onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
                  />
                </Field>
              </section>
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
                Show results
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
