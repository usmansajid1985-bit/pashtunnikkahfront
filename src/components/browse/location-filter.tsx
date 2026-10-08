"use client";

import "flag-icons/css/flag-icons.min.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeocodedPlace } from "@/lib/geo";
import { ANY_RADIUS_MILES, LOCATION_RADIUS_STEPS } from "@/lib/geo";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

const MILES_TO_METERS = 1609.34;
const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 };
const REVERSE_DEBOUNCE_MS = 700;
const SEARCH_DEBOUNCE_MS = 350;

/** Slider stops: the radius steps, then "Any" (no distance limit). */
const STOPS: readonly number[] = [...LOCATION_RADIUS_STEPS, ANY_RADIUS_MILES];
const ANY_IDX = STOPS.length - 1;

type Point = { lat: number; lng: number };

type SavedLocation = {
  lat: number | null;
  lng: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  radiusMiles: number;
  countryOnly: boolean;
  photoUrl: string | null;
};

type HomeLocation = Point & { city: string | null; country: string | null; countryCode: string | null };

/** What was saved by "Use this location" — shown as the summary on the Filters screen. */
export type LocationChoice = {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  radiusMiles: number;
  countryOnly: boolean;
};

/** "Horsham · 25 miles" / "United Kingdom only" / "Any distance". */
export function locationSummary(l: LocationChoice): string {
  const area = l.city || l.country || "Pinned area";
  if (l.radiusMiles === ANY_RADIUS_MILES) return l.countryOnly && l.country ? `${l.country} only` : "Any distance";
  return `${area} · ${l.radiusMiles} miles`;
}

/** True when the choice actually narrows results (a radius, or a country restriction). */
export function locationNarrows(l: LocationChoice): boolean {
  return l.radiusMiles !== ANY_RADIUS_MILES || l.countryOnly;
}

const near = (a: Point | null, b: Point | null) =>
  Boolean(a && b && Math.abs(a.lat - b.lat) < 0.03 && Math.abs(a.lng - b.lng) < 0.03);

const countryPhrase = (country: string) => (country === "United Kingdom" ? "the UK" : country);

type Props = {
  /** The location filter is currently part of the search — reopen on the saved search area. */
  active: boolean;
  onClose: () => void;
  /** Search area saved — the Filters screen shows it and applies it with everything else. */
  onUse: (choice: LocationChoice) => void;
};

/**
 * Location & distance screen of the Browse filters. It only chooses WHERE to search (map centre,
 * radius, country-only) — it never changes the member's profile location, which is edited in
 * Edit Profile.
 */
export function LocationFilter({ active, onClose, onUse }: Props) {
  const [saved, setSaved] = useState<SavedLocation | null>(null);
  const [home, setHome] = useState<HomeLocation | null>(null);
  const [live, setLive] = useState<Point | null>(null);
  const [radiusIdx, setRadiusIdx] = useState(2);
  // The saved radius, and whether the slider was moved. A non-standard older radius is shown at
  // the nearest stop but only overwritten once the member actually moves the slider (PN-BROWSE-006).
  const [savedRadius, setSavedRadius] = useState<number | null>(null);
  const [radiusTouched, setRadiusTouched] = useState(false);
  const [countryOnly, setCountryOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<GeocodedPlace | null>(null);
  const [resolving, setResolving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const startRef = useRef<Point | null>(null);

  const radiusMiles = STOPS[radiusIdx];
  const anyDistance = radiusIdx === ANY_IDX;

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const seq = ++requestSeq.current;
    setResolving(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      if (data.place) setPlace(data.place as GeocodedPlace);
    } finally {
      if (seq === requestSeq.current) setResolving(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile/location");
        const data = await res.json();
        const loc = (data.location || {}) as SavedLocation;
        const homeLoc = (data.home || null) as HomeLocation | null;
        setSaved(loc);
        setHome(homeLoc);
        setSavedRadius(typeof loc.radiusMiles === "number" ? loc.radiusMiles : null);
        if (typeof loc.radiusMiles === "number") {
          // Nearest stop for display ("Any" only on an exact match).
          let idx = STOPS.indexOf(loc.radiusMiles);
          if (idx < 0) {
            idx = 0;
            LOCATION_RADIUS_STEPS.forEach((step, i) => {
              if (Math.abs(step - loc.radiusMiles) < Math.abs(LOCATION_RADIUS_STEPS[idx] - loc.radiusMiles)) idx = i;
            });
          }
          setRadiusIdx(idx);
        }
        setCountryOnly(Boolean(loc.countryOnly));

        // Start from the saved search area while that filter is in use; otherwise from the
        // member's profile location.
        const hasSaved = loc.lat != null && loc.lng != null;
        if (hasSaved && (active || !homeLoc)) {
          startRef.current = { lat: loc.lat!, lng: loc.lng! };
          setPlace({
            lat: loc.lat!,
            lng: loc.lng!,
            city: loc.city || "",
            region: loc.region || "",
            country: loc.country || "",
            countryCode: loc.countryCode || "",
            label: [loc.city, loc.country].filter(Boolean).join(", ") || "Saved location",
          });
        } else if (homeLoc) {
          startRef.current = { lat: homeLoc.lat, lng: homeLoc.lng };
          setPlace({
            lat: homeLoc.lat,
            lng: homeLoc.lng,
            city: homeLoc.city || "",
            region: "",
            country: homeLoc.country || "",
            countryCode: homeLoc.countryCode || "",
            label: [homeLoc.city, homeLoc.country].filter(Boolean).join(", ") || "Your profile location",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !mapElRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !mapElRef.current) return;
        const start = startRef.current;
        const center = start ?? DEFAULT_CENTER;

        const map = new g.maps.Map(mapElRef.current, {
          center,
          zoom: start ? 10 : 5,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        circleRef.current = new g.maps.Circle({
          map,
          center,
          radius: (anyDistance ? 0 : radiusMiles) * MILES_TO_METERS,
          visible: !anyDistance,
          clickable: false,
          strokeColor: "#aa1945",
          strokeOpacity: 0.7,
          strokeWeight: 1,
          fillColor: "#aa1945",
          fillOpacity: 0.14,
        });
        if (start && !anyDistance) {
          const bounds = circleRef.current.getBounds();
          if (bounds) map.fitBounds(bounds, 28);
        }

        // The pin is fixed at the centre: moving the map moves the search area.
        let first = true;
        map.addListener("idle", () => {
          const c = map.getCenter();
          if (!c) return;
          circleRef.current?.setCenter(c);
          // Opening the screen is not a move — keep the starting place as it is named.
          if (first) {
            first = false;
            if (start) return;
          }
          if (reverseTimer.current) clearTimeout(reverseTimer.current);
          reverseTimer.current = setTimeout(() => reverseGeocode(c.lat(), c.lng()), REVERSE_DEBOUNCE_MS);
        });

        mapRef.current = map;
        setMapError(null);
      } catch {
        setMapError("Map could not load. Search for a city below.");
      }
    })();

    return () => {
      cancelled = true;
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      circleRef.current?.setMap(null);
      circleRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const circle = circleRef.current;
    const map = mapRef.current;
    if (!circle || !map) return;
    circle.setVisible(!anyDistance);
    if (anyDistance) return;
    circle.setRadius(radiusMiles * MILES_TO_METERS);
    const bounds = circle.getBounds();
    if (bounds) map.fitBounds(bounds, 28);
  }, [radiusMiles, anyDistance]);

  function recenter(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    circleRef.current?.setCenter({ lat, lng });
    const bounds = anyDistance ? null : circleRef.current?.getBounds();
    // L03: one camera move — panTo() followed by setZoom() lets the zoom cancel the pan.
    if (bounds) map.fitBounds(bounds, 28);
    else map.setOptions({ center: { lat, lng }, zoom: 9 });
  }

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (map) map.setZoom((map.getZoom() ?? 10) + delta);
  }

  function onSearchChange(value: string) {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults((data.places as GeocodedPlace[]) ?? []);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function pickResult(p: GeocodedPlace) {
    setResults([]);
    setQuery("");
    setSearchOpen(false);
    setPlace(p);
    recenter(p.lat, p.lng);
  }

  function useLiveLocation() {
    setNotice(null);
    if (!navigator.geolocation) {
      setNotice("Live location isn't available on this device. Search for an area instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const data = await res.json();
          if (data.place) {
            const p = data.place as GeocodedPlace;
            setLive({ lat: p.lat, lng: p.lng });
            setPlace(p);
            recenter(p.lat, p.lng);
          }
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setNotice("We couldn't get your live location. Allow location access, or search for an area instead.");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  async function confirm() {
    if (!place || saving) return;
    setSaving(true);
    setNotice(null);
    // Only write a radius the member actually chose; otherwise keep their saved value.
    const radius = radiusTouched ? radiusMiles : (savedRadius ?? radiusMiles);
    try {
      const res = await fetch("/api/profile/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: place.lat,
          lng: place.lng,
          city: place.city,
          region: place.region,
          country: place.country,
          countryCode: place.countryCode,
          radiusMiles: radius,
          countryOnly,
        }),
      });
      if (!res.ok) {
        setNotice("Could not save this location. Please try again.");
        return;
      }
      onUse({
        city: place.city || null,
        country: place.country || null,
        countryCode: place.countryCode || null,
        radiusMiles: radius,
        countryOnly,
      });
    } catch {
      setNotice("Could not save this location. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const country = place?.country || saved?.country || "";
  const flagCode = (place?.countryCode || "").toLowerCase();
  const source = near(place, home)
    ? "Based on your profile location"
    : near(place, live)
      ? "Your live location"
      : "The area you've chosen";
  const mapButton =
    "flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-950 shadow-md hover:bg-[#faf8f7]";

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-white">
      <div className="px-5 py-4 border-b border-ink-900/8 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-ink-950 text-lg">Location</h2>
          <p className="text-xs text-ink-700/60 mt-0.5">Search around a city or area with a set radius</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
          aria-label="Back to filters"
        >
          ✕
        </button>
      </div>

      <div className={`relative shrink-0 bg-[#e8f0e6] ${expanded ? "flex-1 min-h-0" : "h-[38%] min-h-[220px]"}`}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-700/50">Loading map…</div>
        ) : (
          <>
            <div ref={mapElRef} className="absolute inset-0" />
            {mapError ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-700/70">
                {mapError}
              </div>
            ) : null}

            {/* Profile-photo pin, fixed at the map centre. */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-full drop-shadow-lg">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-rose-600 ring-4 ring-white">
                {saved?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={saved.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="h-full w-full p-3.5">
                    <circle cx="12" cy="8.5" r="3.5" />
                    <path d="M5 20a7 7 0 0 1 14 0" />
                  </svg>
                )}
              </div>
              <svg width="18" height="12" viewBox="0 0 18 12" className="mx-auto -mt-0.5 text-rose-600" fill="currentColor">
                <path d="M9 12 0 0h18z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Shrink map" : "Expand map"}
              aria-pressed={expanded}
              className={`absolute right-3 top-3 z-[3] ${mapButton}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {expanded ? (
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                )}
              </svg>
            </button>
            <div className="absolute bottom-3 right-3 z-[3] overflow-hidden rounded-xl bg-white shadow-md">
              <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" className="flex h-10 w-10 items-center justify-center text-xl text-ink-950 hover:bg-[#faf8f7]">
                +
              </button>
              <div className="h-px bg-ink-900/10" />
              <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" className="flex h-10 w-10 items-center justify-center text-xl text-ink-950 hover:bg-[#faf8f7]">
                −
              </button>
            </div>
          </>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-3 ${expanded ? "hidden" : ""}`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-expanded={searchOpen}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-ink-900/10 px-4 py-3 text-left hover:border-rose-200"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.8" className="shrink-0">
              <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
              <circle cx="12" cy="10.5" r="2" />
            </svg>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-ink-700/60">Search around</span>
              <span className="block truncate text-[15px] font-semibold text-ink-950" aria-live="polite">
                {resolving ? "Finding area…" : place?.label || "Choose an area"}
              </span>
              <span className="block text-xs text-ink-700/60">
                {place ? source : "Search for an area or move the map"}
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-ink-700/60 transition-transform ${searchOpen ? "rotate-90" : ""}`}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          {searchOpen ? (
            <div className="mt-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search country, city or area"
                aria-label="Search for another area"
                className="w-full rounded-xl border border-ink-900/10 bg-[#faf8f7] px-4 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white"
              />
              {results.length > 0 ? (
                <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-2xl border border-ink-900/8 bg-white shadow-lg">
                  {results.map((r, i) => (
                    <li key={`${r.lat}-${r.lng}-${i}`}>
                      <button type="button" onClick={() => pickResult(r)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-[#faf8f7]">
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {searching ? <p className="mt-1 text-xs text-ink-700/50">Searching…</p> : null}
              <p className="mt-1.5 text-xs text-ink-700/55">You can also move the map to place the pin.</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={useLiveLocation}
          disabled={locating}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-ink-900/10 px-4 py-3 text-left hover:border-rose-200 disabled:opacity-60"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-ink-700">
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" strokeLinecap="round" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink-950">Use my live location</span>
            <span className="block text-xs text-ink-700/60">{locating ? "Detecting…" : "Detect your current location"}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-700/60">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <div className="pt-1">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-ink-950">Distance</span>
            <span className="text-ink-700/70">{anyDistance ? "Any distance" : `Up to ${radiusMiles} miles away`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={ANY_IDX}
            step={1}
            value={radiusIdx}
            onChange={(e) => {
              setRadiusIdx(Number(e.target.value));
              setRadiusTouched(true);
            }}
            className="pn-range w-full"
            style={{ "--pn-fill": `${(radiusIdx / ANY_IDX) * 100}%` } as React.CSSProperties}
            aria-label="Search distance"
            aria-valuetext={anyDistance ? "Any distance" : `Up to ${radiusMiles} miles away`}
          />
          <div className="mt-1 flex justify-between px-[3px] text-xs" aria-hidden>
            {STOPS.map((s, i) => (
              <span key={s} className={`w-6 text-center first:text-left last:text-right ${i === radiusIdx ? "font-bold text-rose-600" : "text-ink-700/60"}`}>
                {i === ANY_IDX ? "Any" : s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-ink-900/10 px-4 py-3">
          {flagCode ? <span aria-hidden className={`fi fi-${flagCode} shrink-0 rounded-[3px] text-xl`} /> : null}
          <span className="min-w-0 flex-1">
            <span id="country-only-label" className="block text-[15px] font-semibold text-ink-950">
              Limit to only {country || "this country"}
            </span>
            <span className="block text-xs text-ink-700/60">
              Only show profiles in {country ? countryPhrase(country) : "this country"}, regardless of map radius
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={countryOnly}
            aria-labelledby="country-only-label"
            onClick={() => setCountryOnly((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${countryOnly ? "bg-rose-600" : "bg-ink-900/15"}`}
          >
            <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${countryOnly ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </button>
        </div>
        {countryOnly && country ? (
          <p className="flex items-start gap-2.5 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] leading-snug text-rose-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-px shrink-0" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
            </svg>
            Profiles will only be shown from within {country === "United Kingdom" ? "the United Kingdom" : country}, even if
            your search radius goes outside {countryPhrase(country)}.
          </p>
        ) : null}
      </div>

      <div className="p-4 border-t border-ink-900/8 shrink-0">
        {notice ? (
          <p role="alert" className="mb-2 text-center text-xs text-rose-700">
            {notice}
          </p>
        ) : null}
        <button
          type="button"
          onClick={confirm}
          disabled={saving || loading || resolving || !place}
          className="w-full py-3 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Use this location"}
        </button>
      </div>
    </div>
  );
}
