"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeocodedPlace } from "@/lib/geo";
import { LOCATION_RADIUS_STEPS } from "@/lib/geo";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

const MILES_TO_METERS = 1609.34;
const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 };
const REVERSE_DEBOUNCE_MS = 700;
const SEARCH_DEBOUNCE_MS = 350;

type LocationState = {
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

type Props = {
  onClose: () => void;
  onApplied: () => void;
  onClearDistance?: () => void;
};

export function LocationFilter({ onClose, onApplied, onClearDistance }: Props) {
  const [state, setState] = useState<LocationState | null>(null);
  const [radiusIdx, setRadiusIdx] = useState(2);
  const [countryOnly, setCountryOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<GeocodedPlace | null>(null);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [pinBounce, setPinBounce] = useState(false);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const radiusMiles = LOCATION_RADIUS_STEPS[radiusIdx];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

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
        const loc = (data.location || {}) as LocationState;
        setState(loc);
        const idx = LOCATION_RADIUS_STEPS.indexOf(loc.radiusMiles as (typeof LOCATION_RADIUS_STEPS)[number]);
        setRadiusIdx(idx >= 0 ? idx : 2);
        setCountryOnly(Boolean(loc.countryOnly));
        if (loc.lat != null && loc.lng != null) {
          setPlace({
            lat: loc.lat,
            lng: loc.lng,
            city: loc.city || "",
            region: loc.region || "",
            country: loc.country || "",
            countryCode: loc.countryCode || "",
            label: [loc.city, loc.country].filter(Boolean).join(", ") || "Saved location",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading || !mapElRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !mapElRef.current) return;
        const hasPin = state?.lat != null && state?.lng != null;
        const center = hasPin ? { lat: state.lat!, lng: state.lng! } : DEFAULT_CENTER;

        const map = new g.maps.Map(mapElRef.current, {
          center,
          zoom: hasPin ? 10 : 5,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        circleRef.current = new g.maps.Circle({
          map,
          center,
          radius: radiusMiles * MILES_TO_METERS,
          strokeColor: "#aa1945",
          strokeWeight: 1,
          fillColor: "#aa1945",
          fillOpacity: 0.14,
        });

        map.addListener("idle", () => {
          const c = map.getCenter();
          if (!c) return;
          circleRef.current?.setCenter(c);
          if (reverseTimer.current) clearTimeout(reverseTimer.current);
          reverseTimer.current = setTimeout(() => {
            reverseGeocode(c.lat(), c.lng());
            setPinBounce(true);
            setTimeout(() => setPinBounce(false), 400);
          }, REVERSE_DEBOUNCE_MS);
        });

        mapRef.current = map;
        setMapError(null);
        if (hasPin) reverseGeocode(state.lat!, state.lng!);
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
    if (!circleRef.current || !mapRef.current) return;
    circleRef.current.setRadius(radiusMiles * MILES_TO_METERS);
    const bounds = circleRef.current.getBounds();
    if (bounds) mapRef.current.fitBounds(bounds, 28);
  }, [radiusMiles]);

  function recenter(lat: number, lng: number, zoom = 11) {
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(zoom);
    circleRef.current?.setCenter({ lat, lng });
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
    setPlace(p);
    recenter(p.lat, p.lng);
  }

  function useLiveLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const data = await res.json();
          if (data.place) {
            setPlace(data.place as GeocodedPlace);
            recenter(data.place.lat, data.place.lng);
          }
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  async function confirm() {
    if (!place || saving) return;
    setSaving(true);
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
          radiusMiles,
          countryOnly,
        }),
      });
      if (!res.ok) return;
      showToast(
        `Location updated — approximate area set to ${place.city ? `${place.city}, ` : ""}${place.country}.`
      );
      onApplied();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const pinLabel = resolving
    ? "Finding area…"
    : place?.label || "Move the map or search for a city";

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-5 py-4 border-b border-ink-900/8 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-ink-950 text-lg">Location</h2>
          <p className="text-xs text-ink-700/60 mt-0.5">Approximate city or area — not your exact address</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
          aria-label="Back to filters"
        >
          ‹
        </button>
      </div>

      <div className="relative h-[42%] min-h-[220px] shrink-0 bg-[#e8f0e6]">
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
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-full">
              <div
                className={`w-11 h-11 rounded-full bg-rose-600 ring-4 ring-white shadow-lg flex items-center justify-center transition-transform ${
                  pinBounce ? "scale-110" : "scale-100"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
                  <circle cx="12" cy="10.5" r="2" />
                </svg>
              </div>
              <svg width="12" height="8" viewBox="0 0 14 10" className="mx-auto text-rose-600" fill="currentColor">
                <path d="M7 10 0 0h14z" />
              </svg>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search country, city or area"
            aria-label="Search for a location"
            className="w-full rounded-full border border-ink-900/10 bg-[#faf8f7] px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-rose-300 focus:bg-white"
          />
          {results.length > 0 ? (
            <ul className="absolute z-10 mt-1.5 w-full bg-white rounded-2xl shadow-lg border border-ink-900/8 overflow-hidden max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#faf8f7]"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searching ? <p className="mt-1 text-xs text-ink-700/50">Searching…</p> : null}
        </div>

        <div>
          <p className="text-xs text-ink-700/55">Pin your location to</p>
          <p className="text-sm font-semibold text-ink-950 mt-0.5">{pinLabel}</p>
        </div>

        <button
          type="button"
          onClick={useLiveLocation}
          disabled={locating}
          className="w-full text-left rounded-xl border border-ink-900/8 px-3 py-2.5 disabled:opacity-50"
        >
          <p className="text-xs text-ink-700/55">Or use your live location</p>
          <p className="text-sm font-semibold text-ink-950">{locating ? "Detecting…" : "Tap to detect (optional)"}</p>
        </button>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-ink-950">Distance</span>
            <span className="text-ink-700/70">Up to {radiusMiles} miles away</span>
          </div>
          <input
            type="range"
            min={0}
            max={LOCATION_RADIUS_STEPS.length - 1}
            step={1}
            value={radiusIdx}
            onChange={(e) => setRadiusIdx(Number(e.target.value))}
            className="w-full accent-rose-600"
            aria-label="Search distance"
            aria-valuetext={`Up to ${radiusMiles} miles away`}
          />
        </div>

        <label className="flex items-center justify-between text-sm gap-3">
          <span>Limit to only {place?.country || state?.country || "selected country"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={countryOnly}
            onClick={() => setCountryOnly((v) => !v)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
              countryOnly ? "bg-rose-600" : "bg-ink-900/15"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                countryOnly ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="p-4 border-t border-ink-900/8 shrink-0 space-y-2">
        <button
          type="button"
          onClick={confirm}
          disabled={saving || loading || !place}
          className="w-full py-3 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Search this area"}
        </button>
        <button
          type="button"
          onClick={() => onClearDistance?.() ?? onClose()}
          className="w-full py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
        >
          Any location — show all
        </button>
      </div>

      {toast ? (
        <div className="absolute top-16 left-4 right-4 z-20 bg-ink-950 text-white text-sm rounded-xl px-4 py-3 text-center shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
