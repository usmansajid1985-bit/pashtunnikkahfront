import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureP3Schema } from "@/lib/ensure-p3-schema";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { SignInList } from "@/components/settings/sign-in-list";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  await ensureP3Schema();
  const userId = BigInt(session.userId);
  const [logins, unreadCount] = await Promise.all([
    prisma.$queryRaw<{ created_at: Date; ip: string | null; user_agent: string | null }[]>`
      SELECT created_at, ip, user_agent FROM login_events
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 10
    `.catch(() => []),
    getUnreadMessageCount(userId),
  ]);

  return (
    <SettingsShell title="Security" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-[28px] font-bold leading-tight text-ink-950">Security</h2>
      <p className="mt-1 text-sm text-ink-700/65">Manage your password and review recent sign-ins.</p>

      <div className="mt-6 rounded-2xl border border-ink-900/8 bg-white p-5">
        <ChangePasswordForm />
        <p className="mt-3 text-sm text-ink-700/55">To sign out of this device, use Sign out in the sidebar.</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-ink-900/8 bg-white">
        <div className="border-b border-ink-900/6 px-5 py-4">
          <h3 className="font-bold text-ink-950">Recent sign-ins</h3>
          <p className="text-[13px] text-ink-700/55">A record of when your account was accessed.</p>
        </div>
        <SignInList
          rows={logins.map((row) => ({
            at: row.created_at.toISOString(),
            ip: row.ip,
            userAgent: row.user_agent,
          }))}
        />
      </div>
    </SettingsShell>
  );
}
