import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** One row of the signup dial-code picker. `iso` is the key — US and Canada share +1. */
export type PhoneCountryCode = {
  iso: string;
  name: string;
  dialCode: string;
  pinned: boolean;
};

/**
 * Initial rows: [iso, name, dial code, pinned position (0 = not pinned)]. Only inserted when
 * missing, so later edits to the table (rename, unpin, deactivate) are never overwritten.
 */
const SEED: [string, string, string, number][] = [
  ["GB", "United Kingdom", "+44", 1],
  ["PK", "Pakistan", "+92", 2],
  ["AF", "Afghanistan", "+93", 3],
  ["US", "United States", "+1", 4],
  ["CA", "Canada", "+1", 5],
  ["AE", "United Arab Emirates", "+971", 6],
  ["SA", "Saudi Arabia", "+966", 7],
  ["DE", "Germany", "+49", 8],
  ["AU", "Australia", "+61", 9],
  ["QA", "Qatar", "+974", 0],
  ["OM", "Oman", "+968", 0],
  ["KW", "Kuwait", "+965", 0],
  ["BH", "Bahrain", "+973", 0],
  ["NL", "Netherlands", "+31", 0],
  ["BE", "Belgium", "+32", 0],
  ["FR", "France", "+33", 0],
  ["NO", "Norway", "+47", 0],
  ["SE", "Sweden", "+46", 0],
  ["DK", "Denmark", "+45", 0],
  ["AT", "Austria", "+43", 0],
  ["CH", "Switzerland", "+41", 0],
  ["IE", "Ireland", "+353", 0],
  ["IT", "Italy", "+39", 0],
  ["ES", "Spain", "+34", 0],
  ["NZ", "New Zealand", "+64", 0],
  ["ZA", "South Africa", "+27", 0],
  ["IN", "India", "+91", 0],
  ["TR", "Turkey", "+90", 0],
];

let ensured = false;

/** Creates and seeds `phone_country_codes` — the list is managed in the database from here on. */
export async function ensurePhoneCodesSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS phone_country_codes (
        iso_code VARCHAR(2) PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        dial_code VARCHAR(8) NOT NULL,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const values = SEED.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO phone_country_codes (iso_code, name, dial_code, is_pinned, sort_order)
       VALUES ${values.join(", ")}
       ON CONFLICT (iso_code) DO NOTHING`,
      ...SEED.flatMap(([iso, name, dial, pin]) => [iso, name, dial, pin > 0, pin]),
    );
    ensured = true;
  } catch (err) {
    console.error("ensurePhoneCodesSchema", err);
  }
}

async function queryPhoneCountryCodes(): Promise<PhoneCountryCode[]> {
  await ensurePhoneCodesSchema();
  const rows = await prisma.$queryRaw<{ iso_code: string; name: string; dial_code: string; is_pinned: boolean }[]>`
    SELECT iso_code, name, dial_code, is_pinned
    FROM phone_country_codes
    WHERE is_active = TRUE
    ORDER BY is_pinned DESC, CASE WHEN is_pinned THEN sort_order ELSE 0 END ASC, name ASC
  `;
  return rows.map((r) => ({ iso: r.iso_code, name: r.name, dialCode: r.dial_code, pinned: r.is_pinned }));
}

const cachedPhoneCountryCodes = unstable_cache(queryPhoneCountryCodes, ["phone-country-codes"], {
  revalidate: 300,
  tags: ["phone-country-codes"],
});

/**
 * Active dial codes, pinned countries first (in their set order), then the rest A–Z.
 * Returns [] if the database can't be reached — callers treat that as "list unavailable".
 */
export async function getPhoneCountryCodes(): Promise<PhoneCountryCode[]> {
  try {
    return await cachedPhoneCountryCodes();
  } catch (err) {
    console.error("getPhoneCountryCodes", err);
    return [];
  }
}
