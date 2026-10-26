import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { SettingsShell } from "@/components/settings/settings-ui";
import { WaliAccessTabs } from "@/components/settings/wali-access-tabs";

export const dynamic = "force-dynamic";

/** Settings → Wali access (sisters): the wali contact card and wali oversight, as two tabs. */
export default async function WaliAccessPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = BigInt(session.userId);
  const [profile, unreadCount] = await Promise.all([
    prisma.profiles.findUnique({ where: { user_id: userId }, select: { gender: true } }),
    getUnreadMessageCount(userId),
  ]);
  // The wali contact card and oversight are for sisters' profiles (the APIs refuse brothers).
  if (!(profile?.gender || "").toLowerCase().startsWith("f")) redirect("/settings");

  return (
    <SettingsShell
      title="Wali access"
      backHref="/settings"
      wide
      profileCode={session.profileCode ?? undefined}
      unreadCount={unreadCount}
      userId={session.userId}
    >
      <h2 className="text-[28px] lg:text-[34px] leading-tight font-bold text-ink-950 tracking-tight">Wali access</h2>
      <p className="mt-1.5 mb-6 text-sm text-ink-700/65">Manage your wali&apos;s contact details and chat access.</p>
      <WaliAccessTabs />
    </SettingsShell>
  );
}
