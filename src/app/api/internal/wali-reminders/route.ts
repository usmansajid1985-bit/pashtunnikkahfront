import { NextResponse } from "next/server";
import { processWaliReminders } from "@/lib/wali-reminders";

export const dynamic = "force-dynamic";

/** Secret-protected endpoint for cron or admin to run wali 48h reminders. */
export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processWaliReminders();
  return NextResponse.json({ ok: true, ...result });
}
