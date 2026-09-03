import { expireStaleRequests } from "@/lib/matches";
import { processWaliReminders } from "@/lib/wali-reminders";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Cron endpoint: expiry, wali reminders, and other lazy jobs. */
export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await expireStaleRequests();
  const wali = await processWaliReminders();

  return NextResponse.json({
    ok: true,
    expiredStaleRequests: true,
    wali,
    ranAt: new Date().toISOString(),
  });
}
