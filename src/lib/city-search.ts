import { googleMapsApiKey } from "@/lib/geo";
import { toCountryCode } from "@/lib/country";
import { prisma } from "@/lib/prisma";

export type CitySuggestion = { city: string; detail: string; label: string; placeId: string };

/** Towns and cities only — no streets, venues or whole countries (R04). */
const CITY_TYPES = ["locality", "postal_town", "administrative_area_level_3"];

/**
 * R04: real, selectable places for the city field (Google Places Autocomplete). Returns `null`
 * when the lookup itself is unavailable (no key / Google error), so callers can tell "no such
 * city" apart from "couldn't check".
 */
export async function searchCities(
  query: string,
  country?: string | null
): Promise<CitySuggestion[] | null> {
  const input = query.trim();
  if (input.length < 2) return [];
  let key: string;
  try {
    key = googleMapsApiKey();
  } catch {
    return null;
  }
  const code = country && country !== "ZZ" ? toCountryCode(country) : null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: CITY_TYPES,
        ...(code && code !== "ZZ" ? { includedRegionCodes: [code.toLowerCase()] } : {}),
        languageCode: "en",
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        };
      }[];
    };
    const seen = new Set<string>();
    const out: CitySuggestion[] = [];
    for (const s of data.suggestions ?? []) {
      const p = s.placePrediction;
      const city = p?.structuredFormat?.mainText?.text?.trim();
      if (!city) continue;
      const detail = p?.structuredFormat?.secondaryText?.text?.trim() ?? "";
      const label = p?.text?.text?.trim() || [city, detail].filter(Boolean).join(", ");
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ city, detail, label, placeId: p?.placeId ?? "" });
    }
    return out.slice(0, 6);
  } catch {
    return null;
  }
}

/**
 * The member picked this exact place from the list — confirm it with Google by its id rather than
 * re-searching by name (a re-search can rank the same town differently or leave it out). The
 * place must be a town/city with that name AND sit in the chosen country, so a hand-crafted
 * request can't pair a country with another country's city. Null = couldn't check.
 */
async function checkPlaceId(
  placeId: string,
  city: string,
  countryCode: string | null
): Promise<"ok" | "wrong-country" | "no-match" | null> {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return "no-match";
  let key: string;
  try {
    key = googleMapsApiKey();
  } catch {
    return null;
  }
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "displayName,types,addressComponents" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 400 || res.status === 404) return "no-match";
    if (!res.ok) return null;
    const data = (await res.json()) as {
      displayName?: { text?: string };
      types?: string[];
      addressComponents?: { shortText?: string; types?: string[] }[];
    };
    const name = data.displayName?.text?.trim().toLowerCase();
    if (name !== city.trim().toLowerCase()) return "no-match";
    if (!(data.types ?? []).some((t) => CITY_TYPES.includes(t))) return "no-match";
    const placeCountry = data.addressComponents?.find((c) => c.types?.includes("country"))?.shortText?.toUpperCase();
    if (countryCode && placeCountry && placeCountry !== countryCode) return "wrong-country";
    return "ok";
  } catch {
    return null;
  }
}

export type CityVerdict = {
  /** "unknown" = the lookup is down — signup and profile saves must never fail just for that. */
  status: "ok" | "invalid" | "unknown";
  /** Google place id of the verified city — the stable reference stored with the profile. */
  placeId: string | null;
};

/**
 * Server-side guard: is `city` a real town/city in `country`? Checked by the picked place id
 * first; a missing/stale id falls back to a country-restricted search by name.
 */
export async function verifyCity(
  city: string | null | undefined,
  country?: string | null,
  placeId?: string | null
): Promise<CityVerdict> {
  const name = (city ?? "").trim();
  if (!name) return { status: "ok", placeId: null }; // empty is handled by each form's own rules
  const code = toCountryCode(country);
  if (placeId) {
    const byId = await checkPlaceId(placeId, name, code && code !== "ZZ" ? code : null);
    if (byId === "ok") return { status: "ok", placeId };
    if (byId === "wrong-country") return { status: "invalid", placeId: null };
    if (byId === null) return { status: "unknown", placeId: null };
  }
  const results = await searchCities(name, country);
  if (results === null) return { status: "unknown", placeId: null };
  const match = results.find((r) => r.city.toLowerCase() === name.toLowerCase());
  return match ? { status: "ok", placeId: match.placeId || null } : { status: "invalid", placeId: null };
}

let placeIdColumnEnsured = false;

/** Store the Google place id next to the profile's city text (null clears a stale one). */
export async function saveCityPlaceId(userId: bigint, placeId: string | null) {
  try {
    if (!placeIdColumnEnsured) {
      await prisma.$executeRawUnsafe(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city_place_id VARCHAR(300)`);
      placeIdColumnEnsured = true;
    }
    await prisma.$executeRaw`UPDATE profiles SET city_place_id = ${placeId} WHERE user_id = ${userId}`;
  } catch (err) {
    console.error("saveCityPlaceId", err);
  }
}
