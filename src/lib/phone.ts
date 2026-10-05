import { getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";

export const PHONE_INVALID_MESSAGE = "Enter a valid phone number for the selected country.";

/** Keep only what belongs in a phone number: digits, spaces, hyphens, dots, brackets and one leading +. */
export function sanitizePhoneInput(raw: string): string {
  const cleaned = raw.replace(/[^\d\s().+-]/g, "").replace(/^\s+/, "");
  return cleaned.slice(0, 1) + cleaned.slice(1).replace(/\+/g, "");
}

/**
 * Validate a number against the selected country's numbering plan and return it in E.164
 * ("+447911123456"), or null if it isn't a real number there. Spaces/hyphens are ignored, a
 * domestic leading 0 is dropped, and a number typed with its own +prefix must carry the
 * selected country's dial code.
 */
export function toE164(iso: string, input: string): string | null {
  if (!input.trim() || /[^\d\s().+-]/.test(input)) return null;
  try {
    const parsed = parsePhoneNumberFromString(input, iso as CountryCode);
    if (!parsed || !parsed.isValid()) return null;
    // Compare dial codes, not countries: +44 also covers Jersey/Guernsey/Isle of Man and +1 is
    // shared by the US and Canada, so a valid number there is still correct under that prefix.
    if (parsed.countryCallingCode !== getCountryCallingCode(iso as CountryCode)) return null;
    return parsed.number;
  } catch {
    return null;
  }
}

/** A sample mobile number in national format for the placeholder, e.g. "07400 123456" for GB. */
export function phonePlaceholder(iso: string): string {
  try {
    return getExampleNumber(iso as CountryCode, examples)?.formatNational() ?? "Phone number";
  } catch {
    return "Phone number";
  }
}

/** Numbers saved before E.164 storage are national digits plus a separate dial code. */
export function displayStoredPhone(dialCode: string | null | undefined, phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.startsWith("+") ? phone : [dialCode, phone].filter(Boolean).join(" ").trim();
}
