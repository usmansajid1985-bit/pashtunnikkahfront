import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { firebaseAdminUnavailableReason, getFirebaseMessaging } from "@/lib/push/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Signed-in diagnostic: is email + push delivery configured on this deployment? Reports only
 * yes/no and which provider — never any credential values.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messaging = getFirebaseMessaging();
  return NextResponse.json(
    {
      mail: process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "none",
      mailAuth: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
      pushServer: messaging ? "firebase_ok" : `firebase_missing: ${firebaseAdminUnavailableReason() ?? "unknown"}`,
      pushClientConfig: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      // Admin → web calls (approval push, tokens) need the same secret on both projects. A short
      // hash prefix lets the two be compared without revealing the value.
      internalSecret: process.env.INTERNAL_API_SECRET
        ? createHash("sha256").update(process.env.INTERNAL_API_SECRET).digest("hex").slice(0, 6)
        : "missing",
      pushVapidKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
