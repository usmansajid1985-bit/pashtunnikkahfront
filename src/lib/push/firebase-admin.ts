import { readFileSync } from "fs";
import { isAbsolute, join } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

function readServiceAccount() {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (file) {
    try {
      const path = isAbsolute(file) ? file : join(process.cwd(), file);
      return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
    } catch (err) {
      console.error("[push] could not read FIREBASE_SERVICE_ACCOUNT_PATH", err);
      return null;
    }
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

export function getFirebaseMessaging(): Messaging | null {
  const account = readServiceAccount();
  if (!account) return null;
  if (!getApps().length) {
    initializeApp({ credential: cert(account) });
  }
  return getMessaging();
}
