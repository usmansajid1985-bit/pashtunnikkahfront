import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";

export const dynamic = "force-dynamic";

/** Lightweight liveness check the wali portal polls — 401 as soon as the link is revoked. */
export async function GET() {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
