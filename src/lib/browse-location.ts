import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function countryAliases(country: string): string[] {
  const c = country.trim().toLowerCase();
  if (!c) return [];
  if (
    ["united kingdom", "uk", "gb", "great britain", "england", "scotland", "wales", "northern ireland"].includes(c)
  ) {
    return ["United Kingdom", "UK", "GB", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"];
  }
  if (["united states", "usa", "us", "united states of america"].includes(c)) {
    return ["United States", "USA", "US", "United States of America"];
  }
  return [country.trim()];
}

function countryMatchSql(country: string) {
  const names = countryAliases(country);
  if (names.length === 0) return Prisma.empty;
  const ors = names.map(
    (name) =>
      Prisma.sql`(lower(trim(coalesce(country, ''))) = lower(${name}) OR lower(trim(coalesce(location_country, ''))) = lower(${name}))`
  );
  return Prisma.sql`AND (${Prisma.join(ors, " OR ")})`;
}

/**
 * Ids of approved profiles for the location filter.
 * Country-only uses the profile `country` field (most members have that, not a map pin).
 * Distance only applies to profiles that have coordinates.
 */
export async function locationRadiusIds(opts: {
  lat: number;
  lng: number;
  radiusMiles: number;
  countryOnly: boolean;
  country?: string | null;
}): Promise<bigint[]> {
  const countryClause = opts.countryOnly && opts.country ? countryMatchSql(opts.country) : Prisma.empty;

  if (opts.countryOnly && opts.country) {
    const rows = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
      SELECT id FROM profiles
      WHERE status = 'approved'
        AND is_hidden = false
        ${countryClause}
        AND (
          location_lat IS NULL
          OR location_lng IS NULL
          OR (3959 * acos(LEAST(1, GREATEST(-1,
                cos(radians(${opts.lat})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(${opts.lng}))
                + sin(radians(${opts.lat})) * sin(radians(location_lat))
              )))) <= ${opts.radiusMiles}
        )
    `);
    return rows.map((r) => r.id);
  }

  const rows = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    SELECT id FROM profiles
    WHERE status = 'approved'
      AND is_hidden = false
      AND location_lat IS NOT NULL
      AND location_lng IS NOT NULL
      AND (3959 * acos(LEAST(1, GREATEST(-1,
            cos(radians(${opts.lat})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(${opts.lng}))
            + sin(radians(${opts.lat})) * sin(radians(location_lat))
          )))) <= ${opts.radiusMiles}
  `);
  return rows.map((r) => r.id);
}
