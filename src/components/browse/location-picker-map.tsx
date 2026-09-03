"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeocodedPlace } from "@/lib/geo";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 }; // London — used only when the user has no saved location yet
const REVERSE_GEOCODE_DEBOUNCE_MS = 700;
const SEARCH_DEBOUNCE_MS: number = 350;

type Props = {
  initialLat: number | null;
  initialLng: number | null;
  photoUrl: string | null;
  onClose: () => void;
  onConfirm: (place: GeocodedPlace) => Promise<void>;
};

export function LocationPickerMap({ initialLat, initialLng, photoUrl, onClose, onConfirm }: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const [place, setPlace] = useState<GeocodedPlace | null>(null);
  const [resolving, setResolving] = useState(true);
  const [pinBounce, setPinBounce] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [liveLocation, setLiveLocation] = useState<GeocodedPlace | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mapReady, setMapReady] = useState(false);

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
    let cancelled = false;

    (async () => {
      const g = await loadGoogleMaps();
      if (cancelled || !mapElRef.current) return;

      const center = initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER;

      const map = new g.maps.Map(mapElRef.current, {
        center,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_BOTTOM },
        gestureHandling: "greedy",
        clickableIcons: false,
      });

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      map.addListener("dragstart", () => setPinBounce(false));
      map.addListener("idle", () => {
        const c = map.getCenter();
        if (!c) return;
        if (reverseTimer.current) clearTimeout(reverseTimer.current);
        reverseTimer.current = setTimeout(() => {
          reverseGeocode(c.lat(), c.lng());
          if (!reducedMotion) {
            setPinBounce(true);
            if (settleTimer.current) clearTimeout(settleTimer.current);
            settleTimer.current = setTimeout(() => setPinBounce(false), 450);
          }
        }, REVERSE_GEOCODE_DEBOUNCE_MS);
      });

      mapRef.current = map;
      setMapReady(true);
      if (initialLat != null && initialLng != null) {
        reverseGeocode(initialLat, initialLng);
      } else {
        setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recenter(lat: number, lng: number, zoom = 12) {
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(zoom);
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
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          if (data.place) setLiveLocation(data.place as GeocodedPlace);
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function applyLiveLocation() {
    if (!liveLocation) return;
    setPlace(liveLocation);
    recenter(liveLocation.lat, liveLocation.lng);
  }

  async function confirm() {
    if (!place || confirming) return;
    setConfirming(true);
    try {
      await onConfirm(place);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[600] bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-ink-900/8 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-full border border-ink-900/10 flex items-center justify-center"
        >
          ✕
        </button>
        <h2 className="font-semibold text-ink-950 text-base">Your location</h2>
        <div className="w-9" />
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="absolute top-3 left-3 right-3 z-[500]">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search country, city or area"
              aria-label="Search for a location"
              className="w-full rounded-full border border-ink-900/10 bg-white/95 backdrop-blur px-4 py-2.5 pr-10 text-sm shadow-md focus:outline-none focus:border-rose-300"
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-700/50"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {results.length > 0 ? (
              <ul className="absolute mt-1.5 w-full bg-white rounded-2xl shadow-lg border border-ink-900/8 overflow-hidden max-h-64 overflow-y-auto">
                {results.map((r, i) => (
                  <li key={`${r.lat}-${r.lng}-${i}`}>
                    <button
                      type="button"
                      onClick={() => pickResult(r)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#faf8f7] flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.8" className="shrink-0">
                        <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
                        <circle cx="12" cy="10.5" r="2" />
                      </svg>
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {searching ? (
              <div className="absolute mt-1.5 w-full bg-white rounded-2xl shadow-lg border border-ink-900/8 px-4 py-2.5 text-xs text-ink-700/60">
                Searching…
              </div>
            ) : null}
          </div>
        </div>

        <div ref={mapElRef} className="absolute inset-0" aria-hidden={!mapReady} />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2"
          style={{ transform: `translate(-50%, -100%)` }}
        >
          <div
            className={`w-12 h-12 rounded-full ring-4 ring-rose-600 shadow-lg overflow-hidden bg-rose-600 transition-transform ${
              pinBounce ? "scale-110" : "scale-100"
            }`}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="w-full h-full p-2.5">
                <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
                <circle cx="12" cy="10.5" r="2" />
              </svg>
            )}
          </div>
          <svg
            width="14"
            height="10"
            viewBox="0 0 14 10"
            className="mx-auto -mt-px text-rose-600"
            fill="currentColor"
          >
            <path d="M7 10 0 0h14z" />
          </svg>
        </div>
      </div>

      <div className="border-t border-ink-900/8 bg-white p-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-700/60">Pin your location to</p>
            <p className="text-sm font-semibold text-ink-950 truncate" aria-live="polite">
              {resolving ? (
                <span className="inline-block h-3.5 w-40 rounded bg-ink-900/8 animate-pulse align-middle" />
              ) : (
                place?.label || "Move the map to choose a location"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={!place || resolving || confirming}
            aria-label="Confirm this location"
            className="w-11 h-11 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
              <circle cx="12" cy="10.5" r="2" />
            </svg>
          </button>
        </div>

        <div className="pt-3 border-t border-ink-900/8 flex items-center justify-between gap-3">
          <button type="button" onClick={useLiveLocation} className="min-w-0 text-left flex-1" disabled={locating}>
            <p className="text-xs text-ink-700/60">Or use your live location</p>
            <p className="text-sm font-semibold text-ink-950 truncate">
              {locating ? "Detecting…" : liveLocation ? liveLocation.label : "Tap to detect"}
            </p>
          </button>
          <button
            type="button"
            onClick={liveLocation ? applyLiveLocation : useLiveLocation}
            aria-label="Use my live location"
            disabled={locating}
            className="w-10 h-10 rounded-full border border-ink-900/12 flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-ink-700/50">
          Location permission is optional — you can always pick a location manually instead.
        </p>
      </div>
    </div>
  );
}
