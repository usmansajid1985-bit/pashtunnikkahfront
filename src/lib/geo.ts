export const LOCATION_RADIUS_STEPS = [10, 25, 50, 75, 100, 150, 250] as const;

export const DEFAULT_RADIUS_MILES = 50;

export function isValidRadiusMiles(n: unknown): n is number {
  return typeof n === "number" && (LOCATION_RADIUS_STEPS as readonly number[]).includes(n);
}

/** Round to ~1.1km so exact home addresses are never persisted, only an approximate area. */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export type GeocodedPlace = {
  lat: number;
  lng: number;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  label: string;
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodingResult = {
  formatted_address: string;
  address_components: GoogleAddressComponent[];
  geometry: { location: { lat: number; lng: number } };
};

function component(components: GoogleAddressComponent[], type: string, useShort = false): string {
  const match = components.find((c) => c.types.includes(type));
  if (!match) return "";
  return useShort ? match.short_name : match.long_name;
}

export function placeFromGoogleResult(result: GoogleGeocodingResult): GeocodedPlace {
  const c = result.address_components;
  const city =
    component(c, "locality") ||
    component(c, "postal_town") ||
    component(c, "administrative_area_level_2");
  const region = component(c, "administrative_area_level_1");
  const country = component(c, "country");
  const countryCode = component(c, "country", true).toUpperCase();
  const label = [city, country].filter(Boolean).join(", ") || result.formatted_address;
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    city,
    region,
    country,
    countryCode,
    label,
  };
}

export function googleMapsApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

/**
 * Forward-geocode city (+ optional country) for signup / bootstrap.
 * Soft-fails to null if the key is missing, Google errors, or nothing matches —
 * signup must never fail because geocoding failed.
 */
export async function geocodeCityCountry(
  city: string | null | undefined,
  country: string | null | undefined
): Promise<GeocodedPlace | null> {
  const q = [city?.trim(), country?.trim()].filter(Boolean).join(", ");
  if (!q) return null;

  let key: string;
  try {
    key = googleMapsApiKey();
  } catch {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`,
      { signal: controller.signal }
    ).finally(() => clearTimeout(timer));

    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: GoogleGeocodingResult[];
    };
    if (data.status !== "OK" || !data.results?.[0]) return null;
    return placeFromGoogleResult(data.results[0]);
  } catch {
    return null;
  }
}
