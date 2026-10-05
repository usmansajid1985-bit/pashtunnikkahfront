/**
 * Password rules for account creation — shared by the signup form and the signup API.
 * Length over composition: no mandatory symbols/capitals, spaces allowed, but nothing common,
 * repetitive, sequential or derived from the member's email.
 */

export const PASSWORD_MIN = 12;
/** bcrypt only reads the first 72 bytes, so anything longer would be silently truncated. */
export const PASSWORD_MAX = 72;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters. Avoid common or easily guessed passwords.`;
export const PASSWORD_WEAK_MESSAGE = "Choose a stronger password that is harder to guess.";

/** Words that, padded with digits/symbols or repeated, make up the most-used passwords. */
const COMMON_BASES = [
  "password", "passw", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm", "letmein",
  "welcome", "iloveyou", "loveyou", "admin", "administrator", "login", "master", "monkey", "dragon",
  "football", "baseball", "cricket", "princess", "sunshine", "superman", "batman", "shadow", "michael",
  "computer", "internet", "starwars", "whatever", "trustno", "freedom", "secret", "changeme", "default",
  "test", "testing", "abcd", "google", "facebook", "pakistan", "afghanistan", "pashtun", "pashto",
  "pathan", "nikah", "pashtunnikah", "bismillah", "allah", "allahu", "akbar", "islam", "muslim",
  "mohammad", "mohammed", "muhammad", "muhammed", "mohamed", "ahmad", "ahmed", "khan", "ali",
  "london", "england", "liverpool", "arsenal", "chelsea", "summer", "winter", "spring", "autumn",
].sort((a, b) => b.length - a.length);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

/** "P@ssw0rd!" → "password": lower-case, undo common letter swaps, keep letters only. */
function lettersCore(lower: string): string {
  const swaps: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };
  // Leading/trailing digits are padding ("…12345"), not letter swaps.
  const trimmed = lower.replace(/^[\d\s._\-#*]+|[\d\s._\-#*]+$/g, "");
  return [...trimmed].map((ch) => swaps[ch] ?? ch).join("").replace(/[^a-z]/g, "");
}

function isCommon(lower: string): boolean {
  // Digits/symbols are only decoration here ("Mohammad123!"), so judge the letters that remain —
  // both as typed and with letter swaps undone.
  for (const core of new Set([lower.replace(/[^a-z]/g, ""), lettersCore(lower)])) {
    if (!core) continue;
    let rest = core;
    for (const base of COMMON_BASES) rest = rest.split(base).join("");
    if (rest.length <= 3 && rest.length < core.length) return true;
  }
  return false;
}

function isRepetitive(lower: string): boolean {
  const chars = [...lower];
  const counts = new Map<string, number>();
  for (const ch of chars) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  if (counts.size < 5) return true;
  if (Math.max(...counts.values()) > chars.length / 2) return true;
  // One short chunk over and over: "abcabcabcabc", "12 12 12 12 12".
  return /^(.{1,6})\1+.{0,2}$/u.test(lower);
}

/** Are a→b neighbours in the alphabet, in the digits, or along a keyboard row (either direction)? */
function stepOf(a: string, b: string): number {
  const d = b.charCodeAt(0) - a.charCodeAt(0);
  if (/^[a-z]{2}$|^\d{2}$/.test(a + b) && Math.abs(d) === 1) return d;
  if (a + b === "90") return 1;
  if (a + b === "09") return -1;
  for (const row of KEYBOARD_ROWS) {
    const i = row.indexOf(a);
    const j = row.indexOf(b);
    if (i >= 0 && j >= 0 && Math.abs(j - i) === 1) return (j - i) * 10;
  }
  return 0;
}

/** Mostly made of runs like "123456", "lkjihg" or "qwerty". */
function isSequential(lower: string): boolean {
  const chars = [...lower];
  let inRuns = 0;
  let runLen = 1;
  let runStep = 0;
  const close = () => {
    if (runLen >= 4) inRuns += runLen;
  };
  for (let i = 1; i < chars.length; i++) {
    const step = stepOf(chars[i - 1], chars[i]);
    if (step !== 0 && (runLen === 1 || step === runStep)) {
      runLen++;
      runStep = step;
    } else {
      close();
      runLen = step !== 0 ? 2 : 1;
      runStep = step;
    }
  }
  close();
  return inRuns >= chars.length * 0.6;
}

/** The password is, or is built around, the email address or an obvious part of it. */
function usesEmail(lower: string, email: string): boolean {
  const addr = email.trim().toLowerCase();
  if (!addr.includes("@")) return false;
  const [local, domain = ""] = addr.split("@");
  const label = domain.split(".")[0] ?? "";
  const parts = new Set<string>([addr, local, label, ...local.split(/[._+\-\d]+/), local.replace(/[^a-z]/g, "")]);
  const squashed = lower.replace(/[\s._\-]/g, "");
  for (const part of parts) {
    if (part.length >= 4 && (lower.includes(part) || squashed.includes(part))) return true;
  }
  return false;
}

export type PasswordCheck = {
  /** 12+ characters (and within the maximum). */
  longEnough: boolean;
  tooLong: boolean;
  /** Not common, repetitive, sequential or email-derived. Only meaningful once `longEnough`. */
  hardToGuess: boolean;
  ok: boolean;
};

export function checkPassword(password: string, email = ""): PasswordCheck {
  const length = [...password].length;
  const tooLong = length > PASSWORD_MAX || new TextEncoder().encode(password).length > PASSWORD_MAX;
  const longEnough = length >= PASSWORD_MIN;
  const lower = password.toLowerCase();
  const hardToGuess =
    password.trim().length > 0 &&
    !isRepetitive(lower) &&
    !isSequential(lower) &&
    !isCommon(lower) &&
    !usesEmail(lower, email);
  return { longEnough, tooLong, hardToGuess, ok: longEnough && !tooLong && hardToGuess };
}

/** One message for the API / form, or null when the password is acceptable. */
export function passwordIssue(password: string, email = ""): string | null {
  const c = checkPassword(password, email);
  if (!c.longEnough) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (c.tooLong) return `Password must be ${PASSWORD_MAX} characters or fewer.`;
  if (!c.hardToGuess) return PASSWORD_WEAK_MESSAGE;
  return null;
}

/**
 * Has this password appeared in a known data breach? Uses the Have I Been Pwned range API:
 * only the first 5 characters of the SHA-1 hash leave the device, never the password.
 * Returns null when the service can't be reached — callers must not block on that.
 */
export async function isBreachedPassword(password: string): Promise<boolean | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const suffix = hash.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix) return Number(count) > 0;
    }
    return false;
  } catch {
    return null;
  }
}
