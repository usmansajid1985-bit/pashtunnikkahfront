import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let started = false;
let mapsLibraryPromise: Promise<google.maps.MapsLibrary> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (!started) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set");
    setOptions({ key: apiKey, v: "weekly" });
    started = true;
  }
  if (!mapsLibraryPromise) {
    mapsLibraryPromise = importLibrary("maps");
  }
  return mapsLibraryPromise.then(() => google);
}
