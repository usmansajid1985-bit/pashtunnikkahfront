import { getSession } from "@/lib/auth";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { SUPPORT_EMAIL, supportWhatsAppNumber } from "@/lib/support";
import { SettingsShell } from "@/components/settings/settings-ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/home/cta-footer";
import { poppins } from "@/components/home/landing-font";
import { SupportForm } from "@/components/support/support-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Help & Support | Pashtun Nikah",
};

function Intro() {
  return (
    <div className="mb-7">
      <h1 className="text-[30px] sm:text-[36px] font-extrabold tracking-[-0.04em] leading-tight text-ink-950">
        How can we help?
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[#85828a] max-w-2xl">
        Tell us what you need help with. We’ll create a reference for your request.
      </p>
    </div>
  );
}

/** Help & Support. Members get the app chrome; logged-out visitors get the public site header. */
export default async function SupportPage() {
  const session = await getSession();
  const form = (
    <SupportForm signedIn={Boolean(session)} supportEmail={SUPPORT_EMAIL} whatsappNumber={supportWhatsAppNumber()} />
  );

  if (session) {
    const unreadCount = await getUnreadMessageCount(BigInt(session.userId));
    return (
      <SettingsShell
        title="Help & Support"
        backHref="/settings"
        wide
        profileCode={session.profileCode ?? undefined}
        unreadCount={unreadCount}
        userId={session.userId}
      >
        <Intro />
        {form}
      </SettingsShell>
    );
  }

  return (
    <div className={`${poppins.variable} min-h-screen bg-[#f8f8fa]`}>
      <SiteHeader />
      <main className="max-w-[1120px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <Intro />
        {form}
      </main>
      <SiteFooter />
    </div>
  );
}
