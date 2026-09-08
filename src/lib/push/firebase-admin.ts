import { readFileSync } from "fs";
import { isAbsolute, join } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

type ServiceAccount = Record<string, string>;

let cachedReason: string | null = null;

/** Last reason the Firebase Admin credentials could not be loaded (for diagnostics). */
export function firebaseAdminUnavailableReason() {
  return cachedReason;
}

function parseAccount(raw: string, source: string): ServiceAccount | null {
  // Vercel env values are often base64-encoded to survive newline mangling in the private key.
  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  try {
    const parsed = JSON.parse(text) as ServiceAccount;
    if (parsed.private_key?.includes("\\n")) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    cachedReason = `${source} is not valid JSON`;
    console.error(`[push] ${cachedReason}`);
    return null;
  }
}

function readServiceAccount(): ServiceAccount | null {
  cachedReason = null;

  // 1. Inline JSON (works on serverless hosts where no file is deployed).
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    const account = parseAccount(inline, "FIREBASE_SERVICE_ACCOUNT");
    if (account) return account;
  }

  // 2. A file path — fall through to nothing if it can't be read.
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (file) {
    try {
      const path = isAbsolute(file) ? file : join(process.cwd(), file);
      return JSON.parse(readFileSync(path, "utf8")) as ServiceAccount;
    } catch (err) {
      cachedReason = `FIREBASE_SERVICE_ACCOUNT_PATH ("${file}") could not be read`;
      console.error(`[push] ${cachedReason}`, err instanceof Error ? err.message : err);
    }
  }

  if (!cachedReason) {
    cachedReason = "no FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH set";
  }
  return null;
}

export function getFirebaseMessaging(): Messaging | null {
  const account = readServiceAccount();
  if (!account) return null;
  if (!getApps().length) {
    initializeApp({ credential: cert(account) });
  }
  return getMessaging();
}
