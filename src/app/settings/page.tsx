import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView, statusLabel } from "@/lib/profile";
import { SettingsRow, SettingsShell } from "@/components/settings/settings-ui";
import { CommunicationModeSettings } from "@/components/settings/communication-mode-settings";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { EmailVerificationBanner } from "@/components/settings/email-verification-banner";
import { GoldBadgeSettings } from "@/components/settings/gold-badge-settings";
import { ReferralsSettings } from "@/components/settings/referrals-settings";
import { readHideGoldBadge } from "@/lib/ensure-p2-schema";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, profile, unreadCount, hideGoldBadge] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    getUnreadMessageCount(userId),
    readHideGoldBadge(userId),
  ]);
  if (!user || !profile) redirect("/signup");

  const view = mapProfileView(profile, { ...user, hide_gold_badge: hideGoldBadge });
  const planLabel = view.plan === "gold" ? "Gold" : "Basic";
  const approved = view.status === "approved";

  return (
    <SettingsShell title="Settings" backHref="/browse" profileCode={view.profileCode} unreadCount={unreadCount}>
      <div className="pt-2 pb-6 lg:pt-0">
        <p className="hidden lg:block text-xs font-semibold uppercase tracking-widest text-rose-600 mb-2">
          Dashboard
        </p>
        <h2 className="text-[28px] lg:text-[34px] leading-tight font-bold text-ink-950 tracking-tight">
          Account &amp; Profile
        </h2>
        <p className="mt-1.5 text-sm text-ink-700/65">Manage your account and profile preferences.</p>
      </div>

      {/* Status strip */}
      <div className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-3 lg:p-5 grid grid-cols-4 gap-1 lg:gap-3">
        <div className="text-center px-1 py-2">
          <span
            className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center ${
              approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {approved ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            )}
          </span>
          <p className="mt-2 text-[10px] font-semibold text-ink-950 leading-tight">
            {approved ? "Profile Approved" : statusLabel(view.status)}
          </p>
        </div>
        <div className="text-center px-1 py-2">
          <span className="mx-auto w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.2 4.5L19 7.3l-3.5 3.4.8 4.8L12 13.8 7.7 15.5l.8-4.8L5 7.3l4.8-.8L12 2Z" />
            </svg>
          </span>
          <p className="mt-2 text-[10px] text-ink-700/60">Plan</p>
          <p className={`text-[12px] font-bold ${view.plan === "gold" ? "text-amber-700" : "text-ink-950"}`}>
            {planLabel}
          </p>
        </div>
        <div className="text-center px-1 py-2">
          <span className="mx-auto w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2Z" />
            </svg>
          </span>
          <p className="mt-2 text-[12px] font-bold text-ink-950">{view.credits} Credits</p>
        </div>
        <div className="text-center px-1 py-2">
          <span className="mx-auto w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5 19c0-3.2 3-5.2 7-5.2s7 2 7 5.2" />
              <path d="M17 8h3M18.5 6.5v3" />
            </svg>
          </span>
          <p className="mt-2 text-[10px] font-semibold text-ink-950 leading-tight">
            {view.gender?.toLowerCase() === "female" ? "Wali Connected" : "Family ready"}
          </p>
        </div>
      </div>

      {!user.email_verified ? (
        <div className="mt-5">
          <EmailVerificationBanner emailVerified={false} />
        </div>
      ) : null}

      <div id="wali-settings">
        <CommunicationModeSettings
          initialMode={view.communicationMode}
          initialNiqabSub={view.niqabSubMode}
          gender={view.gender}
        />
      </div>

      <NotificationSettings />

      <GoldBadgeSettings initialHide={hideGoldBadge} isGold={view.plan === "gold"} />

      <ReferralsSettings />

      {/* Menu */}
      <div className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] overflow-hidden divide-y divide-ink-900/6">
        <SettingsRow
          href="/profile"
          title="View Profile"
          description="See your public profile preview"
          iconBg="#eef2ff"
          iconColor="#4338ca"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
            </svg>
          }
        />
        <SettingsRow
          href="/profile/edit"
          title="Account Details"
          description="View and update your account information"
          iconBg="#eef2ff"
          iconColor="#4338ca"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
            </svg>
          }
        />
        <SettingsRow
          href="/profile"
          title="Profile Status"
          description="View your profile approval status"
          iconBg="#ecfdf5"
          iconColor="#059669"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3 14.5 8.5 20.5 9.2 16 13.4 17.2 19.5 12 16.6 6.8 19.5 8 13.4 3.5 9.2 9.5 8.5 12 3Z" />
            </svg>
          }
        />
        <SettingsRow
          href="/settings/membership"
          title="Membership & Credits"
          description={
            view.plan === "gold"
              ? `Gold · ${view.credits} credits`
              : "Upgrade to Gold · Stripe test checkout"
          }
          iconBg="#fef3c7"
          iconColor="#b45309"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.2 4.5L19 7.3l-3.5 3.4.8 4.8L12 13.8 7.7 15.5l.8-4.8L5 7.3l4.8-.8L12 2Z" />
            </svg>
          }
        />
        <SettingsRow
          href="/notifications"
          title="Notifications inbox"
          description="View recent alerts and activity"
          iconBg="#fef3c7"
          iconColor="#b45309"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          }
        />
        <SettingsRow
          href="/settings/security"
          title="Security"
          description="Password and recent sign-ins"
          iconBg="#ecfdf5"
          iconColor="#059669"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3 14.5 8.5 20.5 9.2 16 13.4 17.2 19.5 12 16.6 6.8 19.5 8 13.4 3.5 9.2 9.5 8.5 12 3Z" />
            </svg>
          }
        />
        <SettingsRow
          href="/settings/privacy"
          title="Privacy &amp; data"
          description="Blocked list and data export"
          iconBg="#eff6ff"
          iconColor="#2563eb"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            </svg>
          }
        />
        <SettingsRow
          href="/settings/delete-account"
          title="Delete account"
          description="Schedule account removal"
          iconBg="#fef2f2"
          iconColor="#dc2626"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M8 6V4h8v2M19 6v14H5V6" />
            </svg>
          }
        />
        <SettingsRow
          href="mailto:support@pashtunnikah.com"
          title="Help &amp; support"
          description="Contact our team"
          iconBg="#f3f4f6"
          iconColor="#374151"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a3 3 0 1 1 5 2c0 2-3 2-3 4M12 17h.01" />
            </svg>
          }
        />
        <SettingsRow
          href="/profile/edit#visibility"
          title="Profile Visibility"
          description="Control who can view your profile"
          iconBg="#eff6ff"
          iconColor="#2563eb"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          }
        />
        <SettingsRow
          href="/profile/edit#pause"
          title="Pause Profile"
          description="Temporarily hide your profile"
          iconBg="#fef3c7"
          iconColor="#b45309"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="7" y="6" width="3.5" height="12" rx="1" />
              <rect x="13.5" y="6" width="3.5" height="12" rx="1" />
            </svg>
          }
        />
      </div>

      <div className="mt-8 flex items-start gap-2.5 px-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.8" className="shrink-0 mt-0.5">
          <path d="M12 3 5 6v5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z" />
        </svg>
        <p className="text-[12.5px] text-ink-700/60 leading-relaxed">
          Your privacy and security are important to us. You&apos;re in control.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/profile"
          className="flex-1 text-center py-3 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
        >
          Open my profile
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
