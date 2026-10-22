import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { MembershipActions } from "@/components/settings/membership-actions";
import { GoldFeatureIcon, type GoldFeature } from "@/components/settings/membership-icons";
import { getPlanSettings } from "@/lib/plan-settings";
import { currentTopupPack } from "@/lib/stripe";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { GOLD_PRICE_LABEL, goldFeatures } from "@/lib/gold-offer";

export const dynamic = "force-dynamic";


const LEDGER_LABELS: Record<string, string> = {
  monthly_free_allowance: "Monthly tokens reset",
  monthly_gold_allowance: "Monthly tokens added",
  gold_rollover: "Unused tokens rolled over",
  request_sent: "Request sent",
  request_withdrawn_refund: "Request withdrawn — refunded",
  request_expired_refund: "Request expired — refunded",
  request_blocked_refund: "Request refunded",
  topup_purchased: "Match Tokens purchased",
  admin_adjustment: "Adjusted by the PN team",
  fraud_refund: "Refunded by the PN team",
  technical_restoration: "Restored by the PN team",
  subscription_cancellation: "Gold ended",
  promotional_credit: "Promotional tokens",
  referral_reward: "Referral reward",
  token_expired: "Unused tokens expired",
  gold_upgrade_reconciled: "Basic tokens replaced by Gold",
  gold_ended: "Gold tokens ended",
  admin_grant: "Added by the PN team",
  admin_remove: "Removed by the PN team",
};

const REFUND_REASONS = ["request_withdrawn_refund", "request_expired_refund", "request_blocked_refund"];

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(d: Date) {
  return `${formatDate(d)}, ${d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()}`;
}

const card = "bg-white rounded-2xl border border-ink-900/6";

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; payments?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const allActivity = params.activity === "all";
  const allPayments = params.payments === "all";

  const userId = BigInt(session.userId);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [user, unreadCount, ledger, monthRows, lastGoldGrant, payments] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    getUnreadMessageCount(userId),
    prisma.credit_ledger.findMany({
      where: { user_id: userId, amount: { not: 0 } },
      orderBy: { created_at: "desc" },
      take: allActivity ? 100 : 5,
    }),
    prisma.credit_ledger.findMany({
      where: { user_id: userId, created_at: { gte: monthStart }, reason: { in: ["request_sent", ...REFUND_REASONS] } },
      select: { reason: true },
    }),
    prisma.credit_ledger.findFirst({
      where: { user_id: userId, reason: "monthly_gold_allowance" },
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
    prisma.payments.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: allPayments ? 100 : 5,
    }),
  ]);
  if (!user) redirect("/login");

  const isGold = (user.plan || "").toLowerCase() === "gold";
  const active = (user.subscription_status || "").toLowerCase() === "active";
  const [planSettings, goldSettings, topupPack] = await Promise.all([
    getPlanSettings(user.plan),
    getPlanSettings("gold"),
    currentTopupPack().catch(() => ({ tokens: 5, pricePence: 699, priceId: "" })),
  ]);

  const allowance = planSettings.monthlyCredits;
  const sent = monthRows.filter((r) => r.reason === "request_sent").length;
  const refunded = monthRows.length - sent;
  const used = Math.min(Math.max(sent - refunded, 0), allowance);
  const balance = user.requests_remaining;

  let resetLine: string;
  if (isGold && user.subscription_cancel_at) {
    resetLine = `Gold ends on ${formatDate(user.subscription_cancel_at)}`;
  } else if (isGold && lastGoldGrant) {
    const next = new Date(lastGoldGrant.created_at);
    next.setMonth(next.getMonth() + 1);
    resetLine = `Renews on ${formatDate(next)}`;
  } else if (isGold) {
    resetLine = "Renews monthly";
  } else {
    resetLine = `Resets on ${formatDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)))}`;
  }

  const features: GoldFeature[] = goldFeatures(goldSettings);

  const ring = allowance > 0 ? used / allowance : 0;

  return (
    <SettingsShell
      title="Membership"
      backHref="/settings"
      profileCode={session.profileCode || undefined}
      unreadCount={unreadCount}
      userId={session.userId}
      wide
    >
      <div className="pb-4">
        <p className="hidden lg:block text-xs font-semibold uppercase tracking-widest text-rose-600 mb-2">Settings</p>
        <h2 className="text-[28px] lg:text-[34px] leading-tight font-bold text-ink-950 tracking-tight">
          Membership &amp; Billing
        </h2>
        <p className="mt-1.5 text-sm text-ink-700/65">Manage your membership, Match Tokens and payment details.</p>
      </div>

      <section className={`${card} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]">
            <GoldFeatureIcon icon="tokens" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-bold text-ink-950">
              {balance} Match Token{balance === 1 ? "" : "s"} left
            </p>
            <p className="text-sm text-ink-700/60">{resetLine}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#e12d72 ${ring * 360}deg, #ece7e6 0deg)` }}
          >
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-sm font-semibold text-ink-950 tabular-nums">
              {used}/{allowance}
            </span>
          </span>
          <p className="max-w-[200px] text-sm text-ink-700/60">
            You&apos;ve used {used} of {allowance} {isGold ? "Gold" : "free"} Match Tokens this month.
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_1fr] items-start">
        <section className={`${card} overflow-hidden`}>
          <div className="bg-gradient-to-br from-[#fbcfe0] via-[#fde2e4] to-[#fde9b8] p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e12d72] px-3 py-1 text-xs font-semibold text-white">
              ✦ {isGold ? "Your plan" : "Most popular"}
            </span>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-[34px] font-bold leading-none text-ink-950">Gold</p>
                <p className="mt-2 max-w-xs text-[15px] text-ink-900">
                  Unlock more ways to continue your search for marriage.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[30px] font-bold leading-none text-ink-950">{GOLD_PRICE_LABEL}</p>
                <p className="mt-1 text-ink-700/60">/ month</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span className="flex items-center gap-2.5 text-sm text-ink-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#e12d72]">
                  <GoldFeatureIcon icon="tokens" />
                </span>
                {goldSettings.monthlyCredits} Match Tokens
                <br className="hidden sm:block" /> monthly
              </span>
              <span className="h-10 w-px bg-[#e12d72]/25" aria-hidden />
              <span className="flex items-center gap-2.5 text-sm text-ink-900">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#e12d72]">
                  <GoldFeatureIcon icon="calendar" />
                </span>
                Cancel anytime
              </span>
            </div>
          </div>

          <div className="p-5">
            <h3 className="font-bold text-ink-950">What&apos;s included</h3>
            <ul className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]">
                    <GoldFeatureIcon icon={f.icon} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink-950">{f.title}</span>
                    <span className="block text-xs text-ink-700/55">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            {isGold && user.subscription_cancel_at ? (
              <p className="mt-4 text-sm font-semibold text-amber-700">
                Gold — cancels on {formatDate(user.subscription_cancel_at)}. Your membership stays active until then
                and won&apos;t renew.
              </p>
            ) : null}

            <div className="mt-5">
              <Suspense fallback={null}>
                <MembershipActions
                  isGold={isGold}
                  activeSubscription={active || isGold}
                  credits={balance}
                  topupConfigured={Boolean(topupPack.priceId)}
                  topupTokens={topupPack.tokens}
                  topupPricePence={topupPack.pricePence}
                  priceLabel={GOLD_PRICE_LABEL}
                  features={features}
                />
              </Suspense>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 border-b border-ink-900/6 px-5 py-4">
              <h3 className="flex items-center gap-3 font-bold text-ink-950">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]">
                  <GoldFeatureIcon icon="clock" />
                </span>
                Token Activity
              </h3>
              <Link
                href={allActivity ? "/settings/membership" : "/settings/membership?activity=all"}
                scroll={false}
                className="text-sm font-semibold text-[#e12d72] hover:underline"
              >
                {allActivity ? "Show less" : "View all ›"}
              </Link>
            </div>
            {ledger.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-700/55">No token activity yet.</p>
            ) : (
              <ul className={`divide-y divide-ink-900/6 ${allActivity ? "max-h-[480px] overflow-y-auto" : ""}`}>
                {ledger.map((row) => (
                  <li key={row.id.toString()} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-950">
                        {LEDGER_LABELS[row.reason] || row.reason.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-ink-700/50">{formatDateTime(row.created_at)}</p>
                    </div>
                    <p
                      className={`text-sm font-semibold tabular-nums ${row.amount >= 0 ? "text-emerald-600" : "text-[#e12d72]"}`}
                    >
                      {row.amount > 0 ? "+" : "−"}
                      {Math.abs(row.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 border-b border-ink-900/6 px-5 py-4">
              <h3 className="flex items-center gap-3 font-bold text-ink-950">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]">
                  <GoldFeatureIcon icon="receipt" />
                </span>
                Payment History
              </h3>
              {payments.length > 0 ? (
                <Link
                  href={allPayments ? "/settings/membership" : "/settings/membership?payments=all"}
                  scroll={false}
                  className="text-sm font-semibold text-[#e12d72] hover:underline"
                >
                  {allPayments ? "Show less" : "View all ›"}
                </Link>
              ) : null}
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink-900/[0.04] text-ink-700/60">
                  <GoldFeatureIcon icon="receipt" className="h-6 w-6" />
                </span>
                <p className="mt-3 font-semibold text-ink-950">No payments yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-ink-700/55">
                  Your payments and top-ups will appear here after you make a purchase.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-900/6">
                {payments.map((p) => (
                  <li key={p.id.toString()} className="flex justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium capitalize text-ink-950">
                        {p.plan_or_pack} · {p.type}
                      </p>
                      <p className="text-xs text-ink-700/50">{formatDateTime(p.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: (p.currency || "gbp").toUpperCase(),
                        }).format(p.amount_pence / 100)}
                      </p>
                      <p className="text-xs capitalize text-ink-700/50">
                        {p.status === "pending" ? "Pending / not completed" : p.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/settings" className="text-rose-600 font-semibold hover:underline">
          ← Back to settings
        </Link>
      </p>
    </SettingsShell>
  );
}
