import { NextResponse } from "next/server";
import { firebaseVapidKey, firebaseWebConfig } from "@/lib/push/firebase-web";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = firebaseWebConfig();
  if (!config) return NextResponse.json({ configured: false }, { status: 503 });
  return NextResponse.json({ configured: true, ...config, vapidKey: firebaseVapidKey() });
}
