import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SettingsShell } from "@/components/settings/settings-ui";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const unreadCount = await getUnreadMessageCount(BigInt(session.userId));

  return (
    <SettingsShell title="Delete account" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <div className="mx-auto max-w-lg">
        <h2 className="text-center text-[26px] font-bold text-ink-950 sm:text-3xl">Delete your account?</h2>
        <p className="mx-auto mt-2 max-w-sm text-center text-[15px] leading-relaxed text-ink-700/75">
          This is permanent. Read the account deletion terms before continuing.
        </p>
        <div className="mt-7">
          <DeleteAccountForm />
        </div>
      </div>
    </SettingsShell>
  );
}
