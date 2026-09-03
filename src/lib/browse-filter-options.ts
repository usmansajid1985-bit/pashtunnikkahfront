import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

async function distinctStrings(column: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ v: string }[]>(
    `SELECT DISTINCT TRIM(${column}) AS v
     FROM profiles
     WHERE status = 'approved'
       AND ${column} IS NOT NULL
       AND TRIM(${column}) <> ''
     ORDER BY 1
     LIMIT 250`
  );
  return rows.map((r) => r.v).filter(Boolean);
}

export const getBrowseFilterOptions = unstable_cache(
  async () => {
    const [
      countries,
      cities,
      ethnicities,
      marital,
      sects,
      practices,
      tribes,
      relocate,
      appearances,
      educations,
      dialects,
      ancestral,
      heights,
      languages,
    ] = await Promise.all([
      distinctStrings("country"),
      distinctStrings("city"),
      distinctStrings("ethnicity"),
      distinctStrings("marital_status"),
      distinctStrings("religious_methodology"),
      distinctStrings("religious_practice"),
      distinctStrings("tribe"),
      distinctStrings("willing_to_relocate"),
      distinctStrings("appearance"),
      distinctStrings("education"),
      distinctStrings("dialect"),
      distinctStrings("ancestral_village"),
      distinctStrings("height"),
      distinctStrings("home_language"),
    ]);
    return {
      countries,
      cities,
      ethnicities,
      marital,
      sects,
      practices,
      tribes,
      relocate,
      appearances,
      educations,
      dialects,
      ancestral,
      heights,
      languages,
    };
  },
  ["browse-filter-options"],
  { revalidate: 300 }
);
