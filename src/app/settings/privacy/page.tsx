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
    <SettingsShell title="Privacy & data" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-[28px] font-bold leading-tight text-ink-950">Privacy &amp; data</h2>
      <p className="mt-1 text-sm text-ink-700/65">Manage blocked members and download your account data.</p>

      <div id="blocked" className="mt-6 scroll-mt-20 rounded-2xl border border-ink-900/8 bg-white p-5">
        <h3 className="font-bold text-ink-950">Blocked members</h3>
        <BlockedProfiles initial={blockedRows} />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-700/55">
          Block members from a chat&apos;s menu or when declining a request. They stay hidden from Browse and Requests
          until you unblock them here.
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-ink-900/8 bg-white p-5">
        <h3 className="font-bold text-ink-950">Download your data</h3>
        <p className="mt-1 text-sm text-ink-700/65">
          Download your profile details, Match Token balance and transaction history in a JSON file.
        </p>
        <p className="mt-1 text-[13px] text-ink-700/50">JSON is a structured file format for storing data.</p>
        <a
          href="/api/account/export"
          className="mt-4 inline-flex h-11 items-center rounded-full border border-[#e12d72] px-5 text-sm font-semibold text-[#e12d72] hover:bg-rose-50"
        >
          Download data
        </a>
      </div>
    </SettingsShell>
  );
}
