import { runRequestLifecycleJobs } from "@/lib/request-lifecycle";
import { processWaliReminders } from "@/lib/wali-reminders";
import { processUnreadMessageReminders } from "@/lib/notification-email";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron endpoint: request expiry + refunds, request reminders, wali reminders, email backups.
 * Vercel Cron calls it with GET and `Authorization: Bearer $CRON_SECRET`; INTERNAL_API_SECRET
 * is accepted too so it can be triggered by hand or by another scheduler.
 */
async function run(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const secrets = [process.env.CRON_SECRET, process.env.INTERNAL_API_SECRET].filter(Boolean);
  if (!auth || !secrets.includes(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await runRequestLifecycleJobs();
  const wali = await processWaliReminders();
  const messageReminders = await processUnreadMessageReminders().catch(() => ({ sent: 0 }));

  return NextResponse.json({
    ok: true,
    requests,
    wali,
    messageReminders,
    ranAt: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
