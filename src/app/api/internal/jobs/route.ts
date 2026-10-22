import { runRequestLifecycleJobs } from "@/lib/request-lifecycle";
import { processFamilyReminders } from "@/lib/family-flow";
import { processUnreadMessageReminders } from "@/lib/notification-email";
import { NextResponse } from "next/server";
import { purgeExpiredDeletions } from "@/lib/account-deletion";
import { runBillingJobs } from "@/lib/billing-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron endpoint: request expiry + refunds, request reminders, Involve Family reminders, email backups.
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
  const family = await processFamilyReminders().catch((err) => {
    console.error("[family] reminders failed", err);
    return { checked: 0, advanced: 0 };
  });
  const messageReminders = await processUnreadMessageReminders().catch(() => ({ sent: 0 }));
  // N54: accounts closed more than 30 days ago are deleted (email first).
  const accountDeletions = await purgeExpiredDeletions().catch((err) => {
    console.error("[account-deletion] purge failed", err);
    return { deleted: 0 };
  });

  // Token expiry + reminders, grace-period downgrades, Stripe reconciliation and credit audits.
  const billing = await runBillingJobs().catch((err) => {
    console.error("[billing] jobs failed", err);
    return null;
  });

  return NextResponse.json({
    ok: true,
    billing,
    requests,
    family,
    messageReminders,
    accountDeletions,
    ranAt: new Date().toISOString(),
  });
}

export const GET = run;
export const POST = run;
