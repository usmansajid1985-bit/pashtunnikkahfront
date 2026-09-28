import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SettingsShell } from "@/components/settings/settings-ui";
import { getNavCounts } from "@/lib/dashboard";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { NotificationCategoryToggles } from "@/components/notifications/notification-category-toggles";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const navCounts = await getNavCounts(BigInt(session.userId));

  return (
    <SettingsShell
      title="Notifications"
      backHref="/settings"
      profileCode={session.profileCode ?? undefined}
      unreadCount={navCounts.unreadMessages}
      userId={session.userId}
    >
      <h2 className="text-2xl font-bold text-ink-950">Notifications</h2>
      <p className="mt-1 text-sm text-ink-700/65">
        Choose what you&apos;re alerted about. Requests, messages and account or security
        notices always show in the app.
      </p>
      {/* S01: preferences and the inbox live together; the bell stays the quick shortcut. */}
      <a
        href="/notifications"
        className="mt-4 flex items-center justify-between rounded-2xl bg-white border border-ink-900/6 px-4 py-3.5 hover:bg-ink-900/[0.02]"
      >
        <span>
          <span className="block text-[15px] font-semibold text-ink-950">Notifications inbox</span>
          <span className="block text-[12.5px] text-ink-700/65">Recent alerts and activity — also on the bell icon</span>
        </span>
        <span aria-hidden className="text-[#c9a227] font-bold">›</span>
      </a>

      <NotificationSettings />
      <NotificationCategoryToggles />
    </SettingsShell>
  );
}
