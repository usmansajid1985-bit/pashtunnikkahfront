"use client";

import { useEffect, useId, useRef, useState } from "react";
import { countryInSentence, toCountryCode } from "@/lib/country";

type Suggestion = { city: string; detail: string; label: string; placeId?: string };

/**
 * R04: searchable city / town dropdown for the chosen country. Typing only searches — the value
 * is always a place picked from the list, never free text: leaving the field without picking
 * drops what was typed (back to the last picked place, if any). Disabled until a country is
 * chosen, and cleared when the country changes. `onChange(city, confirmed, placeId)` lets forms
 * block Continue/Save until a place is picked.
 */
export function CityPicker({
  value,
  country,
  onChange,
  className = "field",
  placeholder = "Search your city or town",
  initiallyConfirmed = false,
}: {
  value: string;
  /** Narrows suggestions to the chosen country (flag label, name or ISO code). */
  country?: string | null;
  onChange: (city: string, confirmed: boolean, placeId?: string) => void;
  className?: string;
  placeholder?: string;
  /** A city loaded from an already-saved profile counts as confirmed until it's edited. */
  initiallyConfirmed?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [confirmed, setConfirmed] = useState(initiallyConfirmed && Boolean(value));
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const reqId = useRef(0);

  /** The last place actually picked — what the field falls back to if typing is abandoned. */
  const picked = useRef<{ city: string; placeId?: string } | null>(
    initiallyConfirmed && value ? { city: value } : null
  );

  // A city belongs to its country: changing country clears it and a new one must be picked.
  const lastCountry = useRef(country);
  useEffect(() => {
    if (lastCountry.current === country) return;
    lastCountry.current = country;
    picked.current = null;
    setQuery("");
    setConfirmed(false);
    setResults([]);
    onChange("", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  /** Leaving without picking: typed text is not a city. */
  function dropTyped() {
    setOpen(false);
    if (confirmed) return;
    const last = picked.current;
    setQuery(last?.city ?? "");
    setConfirmed(Boolean(last));
    onChange(last?.city ?? "", Boolean(last), last?.placeId);
  }

  useEffect(() => {
    if (confirmed || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q: query.trim() });
        if (country) qs.set("country", country);
        const res = await fetch(`/api/geocode/cities?${qs.toString()}`);
        const data: { cities?: Suggestion[]; unavailable?: boolean } = await res.json();
        if (id !== reqId.current) return;
        setResults(data.cities ?? []);
        setUnavailable(Boolean(data.unavailable));
        setActive(0);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, country, confirmed]);

  function pick(s: Suggestion) {
    picked.current = { city: s.city, placeId: s.placeId };
    setQuery(s.city);
    setConfirmed(true);
    setOpen(false);
    setResults([]);
    onChange(s.city, true, s.placeId);
  }

  const showList = open && !confirmed && query.trim().length >= 2;
  const countryName = countryInSentence(toCountryCode(country));

  return (
    <div className="relative">
      <input
        className={className}
        value={query}
        placeholder={country ? placeholder : "Select a country first"}
        autoComplete="off"
        disabled={!country}
        aria-label="City or town"
        onBlur={dropTyped}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setConfirmed(false);
          setOpen(true);
          onChange(e.target.value, false);
        }}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {confirmed ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" aria-label="City selected">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m5 12 5 5L20 7" />
          </svg>
        </span>
      ) : null}

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-lg"
        >
          {results.map((s, i) => (
            <li key={s.label} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3.5 py-2.5 text-sm ${i === active ? "bg-rose-50" : ""}`}
              >
                <span className="font-semibold text-ink-950">{s.city}</span>
                {s.detail ? <span className="text-ink-700/60">, {s.detail}</span> : null}
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-ink-700/60">
              {loading
                ? "Searching…"
                : unavailable
                  ? "City search is unavailable right now — please try again shortly."
                  : `No matching city or town${countryName ? ` in ${countryName}` : ""} — check the spelling or try a nearby town.`}
            </li>
          ) : null}
        </ul>
      ) : null}

    </div>
  );
}
