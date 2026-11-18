import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SettingsShell } from "@/components/settings/settings-ui";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

/** Privacy & data — account data export. Blocked members has its own page, linked from Settings. */
export default async function PrivacySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const unreadCount = await getUnreadMessageCount(BigInt(session.userId));

  return (
    <SettingsShell title="Privacy & data" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-[28px] font-bold leading-tight text-ink-950">Privacy &amp; data</h2>
      <p className="mt-1 text-sm text-ink-700/65">Download a copy of your account data.</p>

      <div className="mt-6 rounded-2xl border border-ink-900/8 bg-white p-5">
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
