import { NextResponse } from "next/server";
import { searchCities } from "@/lib/city-search";

export const dynamic = "force-dynamic";

// Signup needs this before an account exists, so it can't require a session. Keep it cheap to
// abuse-proof: short inputs are ignored and each IP gets a modest per-minute budget.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { n: number; start: number }>();

function allowed(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { n: 1, start: now });
    if (hits.size > 5000) hits.clear();
    return true;
  }
  h.n += 1;
  return h.n <= MAX_PER_WINDOW;
}

/** R04: city/area suggestions for the location fields (signup + Edit Profile). */
export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (!allowed(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").slice(0, 80);
  const country = url.searchParams.get("country");
  const cities = await searchCities(q, country);
  if (cities === null) return NextResponse.json({ cities: [], unavailable: true });
  return NextResponse.json({ cities });
}
