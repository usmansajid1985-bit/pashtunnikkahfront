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
    <SettingsShell title="Close account" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-2xl font-bold text-ink-950">Close account</h2>
      <p className="mt-1 text-sm text-ink-700/65 leading-relaxed">
        We&apos;re sorry to see you go. Your profile is hidden straight away, and your account is deleted after 30
        days — log in before then to reactivate it.
      </p>
      <div className="mt-6 card p-4">
        <DeleteAccountForm />
      </div>
    </SettingsShell>
  );
}
