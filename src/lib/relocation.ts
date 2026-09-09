/**
 * Relocation preference — one canonical value system (PN-BROWSE-009).
 *
 * Legacy data has this in two columns (`willing_to_relocate` + `relocate`) with mixed values:
 * "Yes" / "Open to Relocation", "No" / "Not Open to Relocation", "Maybe" / "Maybe Depends".
 * We normalise to `yes | maybe | no` and read/write only `willing_to_relocate`.
 */

export const RELOCATION_VALUES = ["yes", "maybe", "no"] as const;
export type RelocationValue = (typeof RELOCATION_VALUES)[number];

export function normalizeRelocation(
  raw: string | null | undefined
): RelocationValue | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("not") || v === "no" || v.startsWith("no ")) return "no";
  if (v.includes("maybe") || v.includes("depend") || v.includes("unsure")) return "maybe";
  if (v.includes("open") || v === "yes" || v.startsWith("yes") || v.includes("willing")) {
    return "yes";
  }
  return null;
}

const LABELS: Record<RelocationValue, string> = {
  yes: "Open to relocation",
  maybe: "Maybe — depends",
  no: "Not open to relocation",
};

export function relocationLabel(raw: string | null | undefined): string | null {
  const v = normalizeRelocation(raw);
  return v ? LABELS[v] : null;
}

export const RELOCATION_OPTIONS: { value: RelocationValue; label: string }[] =
  RELOCATION_VALUES.map((v) => ({ value: v, label: LABELS[v] }));
