import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { getTokenSettings } from "@/lib/tokens";
import { GOLD_PRICE_LABEL } from "@/lib/gold-offer";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/home/cta-footer";
import { poppins } from "@/components/home/landing-font";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gold | Pashtun Nikah",
  description: "How Pashtun Nikah Gold works: more Match Tokens, advanced filters, Match Insights and more.",
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        {children}
      </svg>
    </span>
  );
}

function Benefit({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-7 border-b border-ink-900/8 last:border-b-0">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-ink-950">{title}</h2>
        <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-ink-700/75">{children}</div>
      </div>
      {icon}
    </div>
  );
}

/** "How Gold works" — public page linked from the footer (Product), the FAQ and Membership & Billing. */
export default async function GoldPage() {
  const [session, tokens] = await Promise.all([getSession(), getTokenSettings()]);
  const topupPrice = `£${(tokens.topupPricePence / 100).toFixed(2)}`;
  // Members go straight to Membership & Billing (Upgrade → Stripe); visitors sign up first.
  const ctaHref = session ? "/settings/membership" : "/signup";

  return (
    <div className={`${poppins.variable} min-h-screen bg-white`}>
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-5 pt-14 pb-20 sm:pt-20">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#f7a8c4] to-[#fcd6a4] px-6 py-2 text-[17px] font-semibold text-ink-950/80">
            Gold
          </span>
          <h1 className="font-display mt-6 text-[34px] sm:text-[46px] font-semibold leading-tight tracking-[-0.02em] text-black">
            A little more, <span className="text-[#e12d72]">with Gold.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-700/70 max-w-lg mx-auto">
            More opportunities to connect, more ways to find people who share your values, and a clearer view of potential
            matches.
          </p>
        </div>

        <div className="mt-12">
          <Benefit
            title={`${tokens.goldMonthly} Match Tokens every month`}
            icon={
              <Icon>
                <ellipse cx="12" cy="6" rx="7" ry="2.8" />
                <path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" />
              </Icon>
            }
          >
            <p>
              Gold gives you <strong className="text-ink-950">{tokens.goldMonthly} Match Tokens per month</strong> to send
              Match Requests.
            </p>
            <p>
              <strong className="text-ink-950">Important:</strong> these {tokens.goldMonthly} tokens replace the{" "}
              {tokens.basicMonthly} free monthly tokens on Basic. You receive {tokens.goldMonthly} in total, not{" "}
              {tokens.goldMonthly + tokens.basicMonthly}.
            </p>
            <p>
              Need more? Gold members can purchase {tokens.topupTokens} additional Match Tokens for {topupPrice}.
            </p>
          </Benefit>
          <Benefit
            title="See who viewed your profile"
            icon={
              <Icon>
                <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </Icon>
            }
          >
            <p>See which members have visited your profile, giving you a better understanding of who has taken an interest.</p>
          </Benefit>
          <Benefit
            title="Advanced filters"
            icon={
              <Icon>
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="10" cy="17" r="2" />
              </Icon>
            }
          >
            <p>Refine your search with more detailed preferences and find members who better align with what matters to you.</p>
          </Benefit>
          <Benefit
            title="Personalised Match Insights"
            icon={
              <Icon>
                <path d="M6 20v-6M12 20V9M18 20V4" />
              </Icon>
            }
          >
            <p>
              Understand where you and another member align, what may be worth discussing, and thoughtful questions to ask
              before taking things further.
            </p>
          </Benefit>
          {tokens.rolloverEnabled ? (
            <Benefit
              title={`Up to ${tokens.rolloverMax} unused tokens roll over`}
              icon={
                <Icon>
                  <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" />
                </Icon>
              }
            >
              <p>
                Unused Gold tokens (up to {tokens.rolloverMax}) carry over to your next paid month. Purchased tokens never
                expire.
              </p>
            </Benefit>
          ) : null}
          <Benefit
            title="Gold member badge"
            icon={
              <span className="shrink-0 mt-0.5 rounded-full bg-gradient-to-r from-[#f7a8c4] to-[#fcd6a4] px-3 py-1 text-[12px] font-semibold text-ink-950/80">
                Gold
              </span>
            }
          >
            <p>Your profile displays a distinctive Gold badge, so other members can recognise that you have Gold membership.</p>
          </Benefit>
        </div>

        <div className="mt-10 rounded-3xl bg-gradient-to-br from-rose-50 via-[#fff5f0] to-[#fff8e8] px-6 py-10 text-center">
          <h2 className="font-display text-[22px] font-semibold text-ink-950">Make more of your search.</h2>
          <p className="mt-2 text-[14px] text-ink-700/70 max-w-sm mx-auto">
            Enjoy additional Match Tokens, advanced filters and personalised insights with Gold membership.
          </p>
          <Link
            href={ctaHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#e12d72] px-7 py-3 text-[15px] font-semibold text-white hover:bg-[#c41d5e]"
          >
            Get Gold →
          </Link>
          <p className="mt-3 text-[12px] text-ink-700/55">{GOLD_PRICE_LABEL}/month · cancel anytime. Pricing is shown before you subscribe.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
