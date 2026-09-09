import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { RELOCATION_VALUES } from "@/lib/relocation";

/** Title-case a value for display: "LONDON"/"london" -> "London", "united arab emirates" -> "United Arab Emirates". */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The)\b/g, (m) => m.toLowerCase());
}

async function distinctStrings(column: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ v: string }[]>(
    `SELECT DISTINCT TRIM(${column}) AS v
     FROM profiles
     WHERE status = 'approved'
       AND ${column} IS NOT NULL
       AND TRIM(${column}) <> ''
     ORDER BY 1
     LIMIT 400`
  );
  // Collapse case/whitespace variants ("london" / "London" / "LONDON") to one option — the
  // Browse WHERE clause already matches case-insensitively, so a single canonical-cased label
  // filters them all (report §10: fix duplicate/case filter values).
  const byKey = new Map<string, string>();
  for (const { v } of rows) {
    const val = v.trim().replace(/\s+/g, " ");
    if (!val) continue;
    const key = val.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, titleCase(val));
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export const getBrowseFilterOptions = unstable_cache(
  async () => {
    const [
      countries,
      cities,
      marital,
      sects,
      practices,
      tribes,
      appearances,
      educations,
      dialects,
      ancestral,
      heights,
      languages,
    ] = await Promise.all([
      distinctStrings("country"),
      distinctStrings("city"),
      distinctStrings("marital_status"),
      distinctStrings("religious_methodology"),
      distinctStrings("religious_practice"),
      distinctStrings("tribe"),
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
      marital,
      sects,
      practices,
      tribes,
      // Fixed canonical set — never derived from raw stored values (PN-BROWSE-009).
      relocate: [...RELOCATION_VALUES],
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
