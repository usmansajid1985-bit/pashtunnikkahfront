import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { BlockedProfiles, type BlockedProfileRow } from "@/components/settings/blocked-profiles";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function BlockedMembersPage() {
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
    avatarSeed: Number(b.blocked_id % 70n),
  }));

  return (
    <SettingsShell
      title="Blocked members"
      backHref="/settings/privacy"
      profileCode={session.profileCode ?? undefined}
      unreadCount={unreadCount}
      userId={session.userId}
    >
      {/* Large title shows on desktop; on phones the sticky header already reads "Blocked members". */}
      <h2 className="hidden lg:block text-[28px] font-bold leading-tight text-ink-950">Blocked members</h2>
      <p className="mt-2 lg:mt-1 text-[14px] leading-relaxed text-ink-700/65">
        Blocked members cannot view or interact with each other.
      </p>

      <div className="mt-4">
        <BlockedProfiles initial={blockedRows} />
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-700/55">
        Block members from a chat&apos;s menu or when declining a request. They stay hidden from Browse and Requests
        until you unblock them here.
      </p>
    </SettingsShell>
  );
}
