import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidLatLng, isValidRadiusMiles, roundCoord, DEFAULT_RADIUS_MILES } from "@/lib/geo";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: {
      location_lat: true,
      location_lng: true,
      location_city: true,
      location_region: true,
      location_country: true,
      location_country_code: true,
      location_radius_miles: true,
      location_country_only: true,
      photo_url: true,
      city: true,
      country: true,
    },
  });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  return NextResponse.json({
    // Own-account endpoint only — coordinates are already rounded to ~1.1km at write time
    // (never exact address-level), and this value is never exposed through the public
    // browse/profile APIs, only back to the user who owns it.
    location: {
      lat: profile.location_lat,
      lng: profile.location_lng,
      city: profile.location_city || profile.city,
      region: profile.location_region,
      country: profile.location_country || profile.country,
      countryCode: profile.location_country_code,
      radiusMiles: profile.location_radius_miles ?? DEFAULT_RADIUS_MILES,
      countryOnly: profile.location_country_only,
      photoUrl: profile.photo_url,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userId = BigInt(session.userId);
  const data: Record<string, unknown> = {};

  // Pin move: lat/lng + reverse-geocoded place, sent together.
  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!isValidLatLng(lat, lng)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    data.location_lat = roundCoord(lat);
    data.location_lng = roundCoord(lng);
    data.location_city = typeof body.city === "string" ? body.city.slice(0, 128) : null;
    data.location_region = typeof body.region === "string" ? body.region.slice(0, 128) : null;
    data.location_country = typeof body.country === "string" ? body.country.slice(0, 128) : null;
    data.location_country_code =
      typeof body.countryCode === "string" ? body.countryCode.slice(0, 8) : null;
  }

  // Distance-screen confirm: radius + country-restriction toggle.
  if (body.radiusMiles !== undefined) {
    const radius = Number(body.radiusMiles);
    if (!isValidRadiusMiles(radius)) {
      return NextResponse.json({ error: "Invalid radius" }, { status: 400 });
    }
    data.location_radius_miles = radius;
  }
  if (body.countryOnly !== undefined) {
    data.location_country_only = Boolean(body.countryOnly);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const existing = await prisma.profiles.findUnique({ where: { user_id: userId } });
  if (!existing) return NextResponse.json({ error: "No profile" }, { status: 404 });

  // First time a pin is dropped and no radius was ever saved — seed a default so distance
  // search actually works (it now requires both a pin and a radius).
  if (
    data.location_lat !== undefined &&
    data.location_radius_miles === undefined &&
    existing.location_radius_miles == null
  ) {
    data.location_radius_miles = DEFAULT_RADIUS_MILES;
  }

  const updated = await prisma.profiles.update({
    where: { user_id: userId },
    data,
    select: {
      location_city: true,
      location_region: true,
      location_country: true,
      location_country_code: true,
      location_radius_miles: true,
      location_country_only: true,
    },
  });

  return NextResponse.json({
    location: {
      city: updated.location_city,
      region: updated.location_region,
      country: updated.location_country,
      countryCode: updated.location_country_code,
      radiusMiles: updated.location_radius_miles,
      countryOnly: updated.location_country_only,
    },
  });
}
