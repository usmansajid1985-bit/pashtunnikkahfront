"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { city: string; detail: string; label: string; placeId?: string };

/**
 * R04: searchable city/area field. The member types, then MUST pick a real place from the list;
 * free text never counts as a city. `onChange(city, confirmed)` reports the text and whether it
 * came from a selection, so forms can block Continue/Save until it's confirmed.
 */
export function CityPicker({
  value,
  country,
  onChange,
  className = "field",
  placeholder = "Start typing your city (e.g. Birmingham)",
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // Changing country invalidates a city picked for the old one.
  const lastCountry = useRef(country);
  useEffect(() => {
    if (lastCountry.current === country) return;
    lastCountry.current = country;
    if (confirmed) {
      setConfirmed(false);
      onChange(query, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(s: Suggestion) {
    setQuery(s.city);
    setConfirmed(true);
    setOpen(false);
    setResults([]);
    onChange(s.city, true, s.placeId);
  }

  const showList = open && !confirmed && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={className}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
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
                  : "No matching city — check the spelling or try a nearby town."}
            </li>
          ) : null}
        </ul>
      ) : null}

      {!confirmed && query.trim().length >= 2 && !open ? (
        <p className="mt-1 text-[12px] text-rose-600">Please choose your city from the list.</p>
      ) : null}
    </div>
  );
}
