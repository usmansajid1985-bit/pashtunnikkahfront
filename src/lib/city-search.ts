import { googleMapsApiKey } from "@/lib/geo";
import { toCountryCode } from "@/lib/country";

export type CitySuggestion = { city: string; detail: string; label: string };

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
      out.push({ city, detail, label });
    }
    return out.slice(0, 6);
  } catch {
    return null;
  }
}

/**
 * Server-side guard: is `city` a real town/city (in `country`, when given)? Unknown when the
 * lookup is down — signup and profile saves must never fail just because Google is unreachable.
 */
export async function verifyCity(
  city: string | null | undefined,
  country?: string | null
): Promise<"ok" | "invalid" | "unknown"> {
  const name = (city ?? "").trim();
  if (!name) return "ok"; // empty is handled by each form's own required-field rules
  const results = await searchCities(name, country);
  if (results === null) return "unknown";
  const wanted = name.toLowerCase();
  return results.some((r) => r.city.toLowerCase() === wanted) ? "ok" : "invalid";
}
