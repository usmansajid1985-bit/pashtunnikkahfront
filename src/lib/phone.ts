import {
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import { Metadata as CoreMetadata } from "libphonenumber-js/core";
import maxMetadata from "libphonenumber-js/max/metadata";

// The core Metadata class takes the metadata JSON; its typings don't declare the constructor.
const Metadata = CoreMetadata as unknown as new (json: unknown) => {
  selectNumberingPlan(iso: CountryCode): void;
  numberingPlan: unknown;
};
import examples from "libphonenumber-js/mobile/examples";

export const PHONE_INVALID_MESSAGE = "Enter a valid mobile number for the selected country.";

/** Both count: in the US/Canada and a few others mobiles and landlines share the same ranges. */
const MOBILE_TYPES = new Set(["MOBILE", "FIXED_LINE_OR_MOBILE"]);

/** Keep only what belongs in a phone number: digits, spaces, hyphens, dots, brackets and one leading +. */
export function sanitizePhoneInput(raw: string): string {
  const cleaned = raw.replace(/[^\d\s().+-]/g, "").replace(/^\s+/, "");
  return cleaned.slice(0, 1) + cleaned.slice(1).replace(/\+/g, "");
}

/**
 * Validate a MOBILE number against the selected country's numbering plan and return it in E.164
 * ("+447911123456"), or null. Landlines, wrong starting digits and wrong lengths are rejected, and
 * so is the domestic trunk prefix ("07…" in the UK) — the dial code is already selected. A number
 * typed with its own +prefix must carry the selected country's dial code.
 */
export function toE164(iso: string, input: string): string | null {
  if (!input.trim() || /[^\d\s().+-]/.test(input)) return null;
  try {
    const parsed = parsePhoneNumberFromString(input, iso as CountryCode);
    if (!parsed || !parsed.isValid() || !MOBILE_TYPES.has(parsed.getType() ?? "")) return null;
    // Compare dial codes, not countries: +44 also covers Jersey/Guernsey/Isle of Man and +1 is
    // shared by the US and Canada, so a valid number there is still correct under that prefix.
    if (parsed.countryCallingCode !== getCountryCallingCode(iso as CountryCode)) return null;
    if (!input.trim().startsWith("+") && input.replace(/\D/g, "") !== parsed.nationalNumber) return null;
    return parsed.number;
  } catch {
    return null;
  }
}

/** A sample mobile number without the trunk prefix for the placeholder, e.g. "7400 123456" for GB. */
export function phonePlaceholder(iso: string): string {
  try {
    const example = getExampleNumber(iso as CountryCode, examples);
    if (!example) return "Phone number";
    return example.formatInternational().replace(`+${example.countryCallingCode}`, "").trim();
  } catch {
    return "Phone number";
  }
}

export type PhoneRules = { hint: string; error: string };

const rulesCache = new Map<string, PhoneRules>();

function orList(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

function countryLabel(iso: string) {
  if (iso === "GB") return "UK";
  if (iso === "US") return "US";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/**
 * Per-country guidance from the numbering plan itself: which digits mobiles start with and how
 * many digits they have — e.g. GB → "starting with 7 (10 digits)", PK → 3 / 10, AF → 7 / 9.
 */
export function phoneRules(iso: string): PhoneRules {
  const cached = rulesCache.get(iso);
  if (cached) return cached;
  let dial = "";
  let trunk = "";
  let lengths: number[] = [];
  const starts: string[] = [];
  try {
    dial = `+${getCountryCallingCode(iso as CountryCode)}`;
    const meta = new Metadata(maxMetadata);
    meta.selectNumberingPlan(iso as CountryCode);
    // Runtime API the published typings leave out.
    const plan = meta.numberingPlan as unknown as {
      nationalPrefix(): string | undefined;
      possibleLengths(): number[];
      type(t: "MOBILE"): { possibleLengths(): number[] } | undefined;
    };
    trunk = plan.nationalPrefix() ?? "";
    lengths = plan.type("MOBILE")?.possibleLengths?.() ?? [];
    if (!lengths.length) lengths = plan.possibleLengths();
    // Which first digits mobiles mostly start with: sample random numbers per first digit
    // (deterministic) and keep the digits whose share of valid mobiles is substantial, so a few
    // rare ranges don't turn "starting with 1" into "starting with 1, 3, 4 or 6".
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 10;
    const hits: number[] = [];
    for (let d = 0; d <= 9; d++) {
      let count = 0;
      for (const len of lengths) {
        for (let i = 0; i < 300; i++) {
          let n = String(d);
          while (n.length < len) n += rand();
          const p = parsePhoneNumberFromString(n, iso as CountryCode);
          if (p?.isValid() && MOBILE_TYPES.has(p.getType() ?? "") && p.nationalNumber === n) count++;
        }
      }
      hits.push(count);
    }
    const best = Math.max(...hits);
    hits.forEach((count, d) => {
      if (best > 0 && count >= best * 0.25) starts.push(String(d));
    });
  } catch {
    // Unknown country — fall back to generic wording below.
  }

  const name = countryLabel(iso);
  const startsText = starts.length && starts.length <= 4 ? orList(starts) : "";
  const lengthText = lengths.length ? `${orList(lengths.map(String))} digits` : "";
  const notTrunk =
    trunk && starts.length === 1 && !starts.includes(trunk[0]) ? `, not ${trunk}${starts[0]}` : "";

  const hint = startsText
    ? `Please enter your mobile number starting with ${startsText}${notTrunk}${dial ? `, as ${dial} is already included` : ""}.`
    : `Please enter your mobile number without the country code${dial ? `, as ${dial} is already included` : ""}.`;
  const detail = [startsText && `starting with ${startsText}`, lengthText && `(${lengthText})`].filter(Boolean).join(" ");
  const error = `Enter a valid ${name} mobile number${detail ? ` ${detail}` : ""}.`;

  const rules = { hint, error };
  rulesCache.set(iso, rules);
  return rules;
}

/** Numbers saved before E.164 storage are national digits plus a separate dial code. */
export function displayStoredPhone(dialCode: string | null | undefined, phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.startsWith("+") ? phone : [dialCode, phone].filter(Boolean).join(" ").trim();
}
