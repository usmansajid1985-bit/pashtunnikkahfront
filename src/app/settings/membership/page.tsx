import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { MembershipActions } from "@/components/settings/membership-actions";
import { GOLD_MONTHLY_CREDITS } from "@/lib/stripe";
import { getRematchBalance } from "@/lib/rematch-tokens";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, unreadCount, ledger, rematchTokens] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    getUnreadMessageCount(userId),
    prisma.credit_ledger.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 15,
    }),
    getRematchBalance(userId),
  ]);
  if (!user) redirect("/login");

  const isGold = (user.plan || "").toLowerCase() === "gold";
  const active = (user.subscription_status || "").toLowerCase() === "active";

  const payments = await prisma.payments.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  return (
    <SettingsShell title="Membership" backHref="/settings" profileCode={session.profileCode || undefined} unreadCount={unreadCount}>
      <div className="pb-4">
        <p className="hidden lg:block text-xs font-semibold uppercase tracking-widest text-rose-600 mb-2">
          Billing
        </p>
        <h2 className="text-[28px] lg:text-[34px] leading-tight font-bold text-ink-950 tracking-tight">
          Membership &amp; credits
        </h2>
        <p className="mt-1.5 text-sm text-ink-700/65">
          Gold unlocks views, saved profiles, advanced filters, and {GOLD_MONTHLY_CREDITS} match
          tokens each month.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-ink-900/6 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50">Current plan</p>
            <p className={`text-2xl font-bold ${isGold ? "text-amber-700" : "text-ink-950"}`}>
              {isGold ? "Gold" : "Basic"}
            </p>
            <p className="text-sm text-ink-700/60 mt-1">
              {user.requests_remaining} credits · {rematchTokens} rematch tokens · status{" "}
              {user.subscription_status || "none"}
            </p>
          </div>
          <Suspense fallback={null}>
            <MembershipActions
              isGold={isGold}
              activeSubscription={active || isGold}
              credits={user.requests_remaining}
            />
          </Suspense>
        </div>

        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-ink-700/80">
          <li className="rounded-xl bg-[#faf8f7] px-3 py-2">Who viewed you</li>
          <li className="rounded-xl bg-[#faf8f7] px-3 py-2">Saved profiles</li>
          <li className="rounded-xl bg-[#faf8f7] px-3 py-2">Advanced browse filters</li>
          <li className="rounded-xl bg-[#faf8f7] px-3 py-2">{GOLD_MONTHLY_CREDITS} match tokens / month</li>
        </ul>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-ink-900/6 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-900/6 font-semibold text-sm">Credit activity</div>
        {ledger.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-700/55">No ledger entries yet.</p>
        ) : (
          <ul className="divide-y divide-ink-900/6 max-h-64 overflow-y-auto">
            {ledger.map((row) => (
              <li key={row.id.toString()} className="px-4 py-2.5 flex justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{row.reason.replace(/_/g, " ")}</p>
                  <p className="text-xs text-ink-700/50">{row.created_at.toLocaleString()}</p>
                </div>
                <p className={`font-semibold ${row.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {row.amount >= 0 ? "+" : ""}
                  {row.amount} → {row.new_balance}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-ink-900/6 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-900/6 font-semibold text-sm">Payment history</div>
        {payments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-700/55">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {payments.map((p) => (
              <li key={p.id.toString()} className="px-4 py-3 flex justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium capitalize">
                    {p.plan_or_pack} · {p.type}
                  </p>
                  <p className="text-xs text-ink-700/50">{p.created_at.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${(p.amount_pence / 100).toFixed(2)}</p>
                  <p className="text-xs capitalize text-ink-700/50">{p.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-sm">
        <Link href="/settings" className="text-rose-600 font-semibold hover:underline">
          ← Back to settings
        </Link>
      </p>
    </SettingsShell>
  );
}
