import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { countryByCode, toCountryCode } from "@/lib/country";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";
import { geocodeCityCountry, roundCoord } from "@/lib/geo";

/**
 * B07: a member's HOME coordinates (where they live), used when OTHER members search by
 * distance. Kept apart from `location_lat/lng`, which is this member's own Browse search centre
 * and moves every time they search a different area.
 */
export async function saveHomeCoords(userId: bigint, lat: number, lng: number) {
  await ensureBrowseAndWaliSchema();
  await prisma.$executeRaw`
    UPDATE profiles SET home_lat = ${roundCoord(lat)}, home_lng = ${roundCoord(lng)} WHERE user_id = ${userId}
  `.catch(() => undefined);
}

/** Re-geocode home coordinates from the profile's city/country (e.g. after the city changes). */
export async function refreshHomeCoords(userId: bigint, city: string | null, country: string | null) {
  const geo = await geocodeCityCountry(city, country);
  if (geo) await saveHomeCoords(userId, geo.lat, geo.lng);
  else {
    await ensureBrowseAndWaliSchema();
    await prisma.$executeRaw`UPDATE profiles SET home_lat = NULL, home_lng = NULL WHERE user_id = ${userId}`.catch(
      () => undefined
    );
  }
}

/**
 * Ids of approved profiles within the searching user's saved distance radius (PN-BROWSE-006).
 *
 * Rules:
 *  - The Haversine distance test always applies. A profile with no coordinates cannot be
 *    proven to be within the radius, so it is **excluded** — we never silently widen the
 *    user's chosen radius to pull in no-pin members.
 *  - `countryOnly` adds a hard AND on the canonical country (code first, alias names as a
 *    fallback for rows not yet backfilled), still combined with the distance test.
 */
export async function locationRadiusIds(opts: {
  lat: number;
  lng: number;
  radiusMiles: number;
  countryOnly: boolean;
  country?: string | null;
  countryCode?: string | null;
}): Promise<bigint[]> {
  const haversine = Prisma.sql`
    (3959 * acos(LEAST(1, GREATEST(-1,
      cos(radians(${opts.lat})) * cos(radians(home_lat)) * cos(radians(home_lng) - radians(${opts.lng}))
      + sin(radians(${opts.lat})) * sin(radians(home_lat))
    ))))
  `;

  let countryClause = Prisma.empty;
  if (opts.countryOnly) {
    const code = opts.countryCode || toCountryCode(opts.country);
    const country = countryByCode(code);
    if (country) {
      const names = [country.name, ...(country.aliases ?? [])];
      const nameOrs = names.map(
        (n) => Prisma.sql`lower(trim(coalesce(country, ''))) LIKE ${"%" + n.toLowerCase() + "%"}`
      );
      countryClause = Prisma.sql`AND (country_code = ${country.code} OR ${Prisma.join(nameOrs, " OR ")})`;
    } else if (opts.country && opts.country.trim()) {
      countryClause = Prisma.sql`AND lower(trim(coalesce(country, ''))) = ${opts.country.trim().toLowerCase()}`;
    }
  }

  await ensureBrowseAndWaliSchema();
  const rows = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    SELECT id FROM profiles
    WHERE status = 'approved'
      AND is_hidden = false
      AND home_lat IS NOT NULL
      AND home_lng IS NOT NULL
      ${countryClause}
      AND ${haversine} <= ${opts.radiusMiles}
  `);
  return rows.map((r) => r.id);
}
