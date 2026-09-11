import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureP3Schema } from "@/lib/ensure-p3-schema";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
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
      <h2 className="text-2xl font-bold text-ink-950">Security</h2>
      <p className="mt-1 text-sm text-ink-700/65">Password, sessions, and recent sign-ins.</p>

      <div className="mt-6 card p-4 space-y-3">
        <ChangePasswordForm />
        <p className="text-xs text-ink-700/55">
          Sign out on this device from the sidebar. Multi-device session revoke requires a future session store.
        </p>
      </div>

      <div className="mt-6 card overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-900/6 font-semibold text-sm">Recent sign-ins</div>
        {logins.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-700/55">No login history recorded yet.</p>
        ) : (
          <ul className="divide-y divide-ink-900/6">
            {logins.map((row, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                <p className="font-medium text-ink-950">{row.created_at.toLocaleString()}</p>
                <p className="text-xs text-ink-700/55 truncate">{row.ip || "Unknown IP"} · {row.user_agent?.slice(0, 80) || "Unknown device"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsShell>
  );
}
