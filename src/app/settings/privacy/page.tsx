import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { BlockedProfiles, type BlockedProfileRow } from "@/components/settings/blocked-profiles";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [blocks, unreadCount] = await Promise.all([
    prisma.blocks.findMany({
      where: { blocker_id: userId },
      orderBy: { created_at: "desc" },
      take: 60,
    }),
    getUnreadMessageCount(userId),
  ]);

  const blockedUsers = blocks.length
    ? await prisma.profiles.findMany({
        where: { user_id: { in: blocks.map((b) => b.blocked_id) } },
        select: { user_id: true, profile_code: true },
      })
    : [];

  const codeByUser = new Map(blockedUsers.map((p) => [p.user_id.toString(), p.profile_code]));
  const blockedRows: BlockedProfileRow[] = blocks.map((b) => ({
    id: b.id.toString(),
    peerUserId: b.blocked_id.toString(),
    code: codeByUser.get(b.blocked_id.toString()) || b.blocked_id.toString(),
    blockedAt: b.created_at.toISOString(),
  }));

  return (
    <SettingsShell title="Privacy" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-2xl font-bold text-ink-950">Privacy &amp; safety</h2>
      <p className="mt-1 text-sm text-ink-700/65">Blocked members and safety tools.</p>

      <div className="mt-6 card p-4">
        <h3 className="font-semibold text-ink-950">Blocked profiles</h3>
        <BlockedProfiles initial={blockedRows} />
        <p className="mt-3 text-xs text-ink-700/50">
          Block someone when declining an incoming request, or from a chat&apos;s menu.
          They&apos;ll disappear from Browse and Requests until you unblock them here.
        </p>
      </div>

      <div className="mt-6 card p-4">
        <h3 className="font-semibold text-ink-950">Download your data</h3>
        <p className="mt-1 text-sm text-ink-700/65">Export profile, credits, and ledger as JSON.</p>
        <a
          href="/api/account/export"
          className="mt-3 inline-flex px-4 py-2 rounded-full border border-ink-900/12 text-sm font-semibold hover:border-rose-300"
        >
          Download data
        </a>
      </div>
    </SettingsShell>
  );
}
