import { createHash, randomBytes } from "crypto";

export function generatePasswordResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.WEB_ORIGIN?.replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

export function passwordResetUrl(token: string) {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
