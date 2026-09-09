/**
 * Height parsing / formatting (PN-BROWSE-010).
 *
 * Legacy `profiles.height` is free text: mostly `5'9" (175 cm)`, some bare cm, and a few
 * malformed values like `5.196.11`. We store a validated integer in `profiles.height_cm` and
 * render everything from that.
 */

const MIN_CM = 120;
const MAX_CM = 230;

export function parseHeightCm(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Any explicit "NNN cm" anywhere wins (covers "5'9\" (175 cm)", "175cm", "175 cm+").
  let m = s.match(/(\d{2,3})\s*cm/i);
  if (m) return clamp(Number(m[1]));

  // Bare centimetres.
  m = s.match(/^(\d{2,3})$/);
  if (m) return clamp(Number(m[1]));

  // Feet + inches: 5'9, 5'9", 5 ft 9 in, 5’9”.
  m = s.match(/^(\d)\s*['’ft]\s*(\d{1,2})?\s*(?:["”]|in|inch(?:es)?)?\+?$/i);
  if (m) {
    const ft = Number(m[1]);
    const inch = m[2] ? Number(m[2]) : 0;
    if (ft >= 4 && ft <= 7 && inch >= 0 && inch < 12) {
      return clamp(Math.round((ft * 12 + inch) * 2.54));
    }
  }

  // Metres: 1.75 m
  m = s.match(/^(\d)\.(\d{1,2})\s*m$/i);
  if (m) return clamp(Math.round(Number(`${m[1]}.${m[2]}`) * 100));

  return null;
}

function clamp(n: number): number | null {
  return Number.isFinite(n) && n >= MIN_CM && n <= MAX_CM ? n : null;
}

/** "5'9\" (175 cm)" */
export function formatHeight(cm: number | null | undefined): string | null {
  if (cm == null || !Number.isFinite(cm)) return null;
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches % 12;
  return `${ft}'${inch}" (${Math.round(cm)} cm)`;
}

/** Prefer the validated cm column; fall back to a parse of the legacy string. */
export function displayHeight(
  heightCm: number | null | undefined,
  legacy: string | null | undefined
): string | null {
  const cm = heightCm ?? parseHeightCm(legacy);
  return formatHeight(cm);
}

/** Dropdown steps for the Browse height filter (cm, with a friendly label). */
export const HEIGHT_FILTER_STEPS: { cm: number; label: string }[] = Array.from(
  { length: (205 - 140) / 5 + 1 },
  (_, i) => {
    const cm = 140 + i * 5;
    return { cm, label: formatHeight(cm)! };
  }
);
