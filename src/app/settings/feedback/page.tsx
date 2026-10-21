import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SettingsShell } from "@/components/settings/settings-ui";
import { FeedbackForm } from "@/components/settings/feedback-form";
import { getUnreadMessageCount } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const unreadCount = await getUnreadMessageCount(BigInt(session.userId));

  return (
    <SettingsShell title="Feedback" backHref="/settings" profileCode={session.profileCode ?? undefined} unreadCount={unreadCount} userId={session.userId}>
      <h2 className="text-3xl font-bold text-ink-950">Feedback</h2>
      <p className="mt-1.5 text-[15px] text-ink-700/65 leading-relaxed">
        Help us improve Pashtun Nikah. Share your suggestions, report a bug, or give general feedback.
      </p>
      <FeedbackForm />
    </SettingsShell>
  );
}
