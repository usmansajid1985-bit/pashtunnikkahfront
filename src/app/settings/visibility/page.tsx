import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { VisibilityToggle } from "@/components/settings/visibility-toggle";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function VisibilitySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = BigInt(session.userId);
  const [profile, unreadCount] = await Promise.all([
    prisma.profiles.findUnique({ where: { user_id: userId }, select: { is_hidden: true } }),
    getUnreadMessageCount(userId),
  ]);
  return (
    <SettingsShell
      title="Profile visibility"
      backHref="/settings"
      profileCode={session.profileCode ?? undefined}
      unreadCount={unreadCount}
      userId={session.userId}
    >
      <h2 className="text-[28px] font-bold leading-tight text-ink-950">Profile visibility</h2>
      <p className="mt-1.5 text-sm text-ink-700/65">Control who can see your profile when browsing on Pashtun Nikah.</p>
      <VisibilityToggle initialPaused={Boolean(profile?.is_hidden)} />
    </SettingsShell>
  );
}
