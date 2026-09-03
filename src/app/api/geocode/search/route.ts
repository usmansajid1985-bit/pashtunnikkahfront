import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { googleMapsApiKey, placeFromGoogleResult } from "@/lib/geo";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ places: [] });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${googleMapsApiKey()}`
    );
    if (!res.ok) throw new Error(`Google Geocoding ${res.status}`);
    const data = await res.json();
    if (data.status !== "OK") return NextResponse.json({ places: [] });
    const places = (data.results ?? []).slice(0, 6).map(placeFromGoogleResult);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
