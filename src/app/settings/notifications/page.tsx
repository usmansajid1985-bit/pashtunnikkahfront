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
    >
      <h2 className="text-2xl font-bold text-ink-950">Notifications</h2>
      <p className="mt-1 text-sm text-ink-700/65">
        Choose what you&apos;re alerted about. Requests, messages and account or security
        notices always show in the app.
      </p>

      <NotificationSettings />
      <NotificationCategoryToggles />
    </SettingsShell>
  );
}
