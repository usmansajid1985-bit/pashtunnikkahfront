import { createHash, randomBytes } from "crypto";
import { siteOrigin } from "@/lib/site-url";

export function generatePasswordResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function appBaseUrl() {
  return siteOrigin().replace(/\/$/, "");
}

export function passwordResetUrl(token: string) {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
