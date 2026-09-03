import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { googleMapsApiKey, isValidLatLng, placeFromGoogleResult } from "@/lib/geo";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey()}`
    );
    if (!res.ok) throw new Error(`Google Geocoding ${res.status}`);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({ error: data.status || "No result" }, { status: 502 });
    }
    const place = placeFromGoogleResult(data.results[0]);
    place.lat = lat;
    place.lng = lng;
    return NextResponse.json({ place });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
