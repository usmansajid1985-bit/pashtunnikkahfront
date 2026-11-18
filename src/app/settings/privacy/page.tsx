import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsShell } from "@/components/settings/settings-ui";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [blockedCount, unreadCount] = await Promise.all([
    prisma.blocks.count({ where: { blocker_id: userId } }),
    getUnreadMessageCount(userId),
  ]);

  return (
    <SettingsShell title="Privacy & data" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-[28px] font-bold leading-tight text-ink-950">Privacy &amp; data</h2>
      <p className="mt-1 text-sm text-ink-700/65">Manage blocked members and download your account data.</p>

      <Link
        href="/settings/privacy/blocked"
        className="mt-6 flex items-center gap-3 rounded-2xl border border-ink-900/8 bg-white p-5 transition hover:border-ink-900/15"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4f2f3] text-[#e12d72]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="m5.6 5.6 12.8 12.8" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink-950">Blocked members</span>
          <span className="mt-0.5 block text-[13px] text-ink-700/65">
            {blockedCount === 0
              ? "You have not blocked anyone"
              : `${blockedCount} blocked member${blockedCount === 1 ? "" : "s"}`}
          </span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b5b0b3" strokeWidth="2.2" className="shrink-0" aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>

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
