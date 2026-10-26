import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView, statusLabel } from "@/lib/profile";
import { SettingsRow, SettingsShell } from "@/components/settings/settings-ui";
import { MobileNavStyleSettings } from "@/components/settings/mobile-nav-style-settings";
import { EmailVerificationBanner } from "@/components/settings/email-verification-banner";
import { GoldBadgeSettings } from "@/components/settings/gold-badge-settings";
import { ReferralsSettings } from "@/components/settings/referrals-settings";
import { LogoutRow } from "@/components/settings/logout-row";
import { readHideGoldBadge } from "@/lib/ensure-p2-schema";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { withOwnerPhotoUrls } from "@/lib/photos";
import { getPlanSettings } from "@/lib/plan-settings";

export const dynamic = "force-dynamic";

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="px-1 mb-2 text-[12px] font-bold uppercase tracking-widest text-ink-700/50">{title}</h3>
      <div className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] overflow-hidden divide-y divide-ink-900/6">
        {children}
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, profile, unreadCount, hideGoldBadge, blockedCount, warnings, waliLinks] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    getUnreadMessageCount(userId),
    readHideGoldBadge(userId),
    prisma.blocks.count({ where: { blocker_id: userId } }).catch(() => 0),
    prisma.$queryRaw<{ id: bigint; message: string; created_at: Date }[]>`
      SELECT id, message, created_at FROM member_warnings WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 10
    `.catch(() => [] as { id: bigint; message: string; created_at: Date }[]),
    prisma.wali_links.findMany({ where: { user_id: userId, revoked_at: null }, select: { accepted_at: true } }),
  ]);
  if (!user || !profile) redirect("/signup");

  const view = await withOwnerPhotoUrls(mapProfileView(profile, { ...user, hide_gold_badge: hideGoldBadge }));
  const { monthlyCredits: allowance } = await getPlanSettings(user.plan);
  const approved = view.status === "approved";
  const isSister = view.gender?.toLowerCase().startsWith("f") ?? false;
  const waliState = waliLinks.some((l) => l.accepted_at)
    ? "connected"
    : waliLinks.length > 0
      ? "invited"
      : "none";
  const waliLabel =
    waliState === "connected" ? "Wali Connected" : waliState === "invited" ? "Wali Invited" : "Wali Not Connected";

  const tokenBalance = view.credits;
  const isGold = view.plan === "gold";

  return (
    <SettingsShell title="Settings" backHref="/browse" profileCode={view.profileCode} unreadCount={unreadCount} userId={session.userId}>
      <div className="pt-2 pb-6 lg:pt-0">
        <h2 className="text-[28px] lg:text-[34px] leading-tight font-bold text-ink-950 tracking-tight">Settings</h2>
        <p className="mt-1.5 text-sm text-ink-700/65">Manage your account and profile preferences.</p>
      </div>

      {/* Dashboard: profile status · plan · Match Tokens · wali (sisters). */}
      <div
        className={`bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] px-2 py-4 lg:px-4 lg:py-5 grid divide-x divide-ink-900/6 ${
          isSister ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        <div className="flex flex-col items-center text-center px-1">
          {approved ? (
            <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[#e7f8ef] text-[#1fa463] flex items-center justify-center shadow-[0_0_0_6px_rgba(31,164,99,0.06)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="m8.3 12.2 2.5 2.5 5-5.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : (
            <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[#fff3e0] text-[#f59e0b] flex items-center justify-center shadow-[0_0_0_6px_rgba(245,158,11,0.07)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" strokeLinecap="round" />
              </svg>
            </span>
          )}
          <p className="mt-2.5 text-[11.5px] lg:text-[13px] font-semibold text-ink-950 leading-tight">
            {approved ? "Profile Approved" : view.status === "pending" ? "Pending Approval" : statusLabel(view.status)}
          </p>
        </div>

        <div className="flex flex-col items-center text-center px-1">
          {isGold ? (
            <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-[#f9b8d3] via-[#fcd3c4] to-[#fde3a7] flex items-center justify-center" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#e12d72">
                <path d="M14 6l1.6 4.4L20 12l-4.4 1.6L14 18l-1.6-4.4L8 12l4.4-1.6L14 6Z" />
                <path d="M7 3l.8 2.2L10 6l-2.2.8L7 9l-.8-2.2L4 6l2.2-.8L7 3Z" />
              </svg>
            </span>
          ) : (
            <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-ink-900/[0.05] text-ink-700/60 flex items-center justify-center" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
              </svg>
            </span>
          )}
          <p className="mt-1.5 text-[10.5px] text-ink-700/55">Plan</p>
          {isGold ? (
            <span className="mt-0.5 rounded-full bg-gradient-to-r from-[#f9b8d3] to-[#fde3a7] px-3 py-0.5 text-[11px] font-bold tracking-wide text-ink-950">
              GOLD
            </span>
          ) : (
            <span className="mt-0.5 rounded-full bg-ink-900/[0.06] px-3 py-0.5 text-[11px] font-semibold text-ink-700">Basic</span>
          )}
        </div>

        <Link href="/settings/membership" className="flex flex-col items-center text-center px-1">
          <span
            className="relative w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center"
            style={{
              background: isGold
                ? "conic-gradient(#e12d72 360deg, #e12d72 0deg)"
                : `conic-gradient(#9ca3af ${Math.min(tokenBalance / Math.max(allowance, 1), 1) * 360}deg, #ece9ea 0deg)`,
            }}
            aria-hidden
          >
            <span className="absolute inset-[3px] rounded-full bg-white flex items-center justify-center text-[14px] lg:text-[15px] font-bold text-ink-950 tabular-nums">
              {isGold ? tokenBalance : `${tokenBalance}/${allowance}`}
            </span>
          </span>
          <p className="mt-2.5 text-[11.5px] lg:text-[13px] font-semibold text-ink-950 leading-tight">Match Tokens</p>
        </Link>

        {isSister ? (
          <div className="flex flex-col items-center text-center px-1">
            <span
              className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center ${
                waliState === "connected" ? "bg-[#e7f8ef] text-[#1fa463]" : "bg-[#fff3e0] text-[#f59e0b]"
              }`}
              aria-hidden
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="9" cy="8" r="3" />
                <circle cx="17" cy="9" r="2.3" />
                <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M14.5 14.5c2.8-.4 5.5 1.2 5.5 4.5" />
              </svg>
            </span>
            <p className="mt-2 text-[11.5px] lg:text-[13px] font-semibold text-ink-950 leading-tight">{waliLabel}</p>
            <Link
              href="/settings/wali"
              className="mt-1 rounded-full border border-ink-900/10 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-ink-900 hover:border-ink-900/25"
            >
              {waliState === "connected" ? "Edit →" : "Connect wali →"}
            </Link>
          </div>
        ) : null}
      </div>

      {!user.email_verified ? (
        <div className="mt-5">
          <EmailVerificationBanner emailVerified={false} />
        </div>
      ) : null}

      <SettingsGroup title="Account &amp; Membership">
        <SettingsRow
          href="/settings/membership"
          title="Membership & billing"
          description={
            isGold
              ? `Gold · ${tokenBalance} Match Tokens`
              : `Basic · ${tokenBalance} Match Tokens · Upgrade to Gold`
          }
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h3" /></svg>}
        />
        <ReferralsSettings />
      </SettingsGroup>
      <GoldBadgeSettings initialHide={hideGoldBadge} isGold={isGold} />

      <SettingsGroup title="Notifications">
        <SettingsRow
          href="/settings/notifications"
          title="Notifications"
          description="Choose what you're alerted about"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>}
        />
      </SettingsGroup>

      {isSister ? (
        <SettingsGroup title="Wali">
          <SettingsRow
            href="/settings/wali"
            title="Wali access"
            description="Your wali's contact card and chat oversight"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M14.5 14.5c2.8-.4 5.5 1.2 5.5 4.5" /></svg>}
          />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Privacy &amp; Security">
        <SettingsRow
          href="/settings/security"
          title="Security"
          description="Password and recent sign-ins"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}
        />
        <SettingsRow
          href="/settings/privacy"
          title="Privacy &amp; data"
          description="Privacy controls and data export"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>}
        />
        <SettingsRow
          href="/settings/privacy#blocked"
          title="Blocked members"
          description={blockedCount === 0 ? "You haven't blocked anyone" : `${blockedCount} blocked · manage or unblock`}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>}
        />
        <SettingsRow
          href="/settings/visibility"
          title="Pause profile"
          description={profile.is_hidden ? "Paused — hidden from Browse" : "Temporarily hide your profile"}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>}
        />
      </SettingsGroup>
      {warnings.length ? (
        <div id="warnings" className="mt-3 bg-white rounded-2xl border border-amber-100 p-4">
          <p className="text-[13px] font-bold text-amber-800">Messages from the Pashtun Nikah team</p>
          <ul className="mt-2 space-y-2">
            {warnings.map((w) => (
              <li key={w.id.toString()} className="text-[13px] text-ink-800">
                <span className="text-ink-700/55">
                  {w.created_at.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} —{" "}
                </span>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MobileNavStyleSettings />

      <SettingsGroup title="Danger zone">
        <SettingsRow
          href="/settings/delete-account"
          title="Delete account"
          description="Permanently remove your account"
          iconBg="#fdf0f3"
          iconColor="#dc2626"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M19 6v14H5V6M10 11v5M14 11v5" /></svg>}
        />
      </SettingsGroup>

      <SettingsGroup title="Support">
        <SettingsRow
          href="/settings/feedback"
          title="Give us feedback"
          description="Suggestions, bug reports and ideas"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4Z" /><path d="M8 9.5h8M8 12.5h5" /></svg>}
        />
        <SettingsRow
          href="/support"
          title="Help &amp; support"
          description="Contact our team"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a3 3 0 1 1 5 2c0 2-3 2-3 4M12 17h.01" /></svg>}
        />
        <LogoutRow />
      </SettingsGroup>

      <div className="mt-6 flex gap-3">
        <Link
          href="/profile"
          className="flex-1 text-center py-3 rounded-full bg-[#e12d72] text-white text-sm font-semibold hover:bg-[#c41d5e]"
        >
          Preview my profile
        </Link>
        <Link
          href="/profile/edit"
          className="flex-1 text-center py-3 rounded-full border border-ink-900/12 text-sm font-semibold hover:border-rose-300"
        >
          Edit profile
        </Link>
      </div>
    </SettingsShell>
  );
}
