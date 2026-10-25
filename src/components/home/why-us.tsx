import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/home/section-heading";

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="w-[60px] h-[60px] rounded-xl bg-[#fdeef3] flex items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5">
        {children}
      </svg>
    </span>
  );
}

const features: { title: string; body: string; badge: ReactNode; link?: boolean }[] = [
  {
    title: "Chat for Free",
    body: "Browse profiles, send free monthly match requests and chat with your matches at no extra cost.",
    badge: (
      <IconTile>
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20l1.1-4.3A8.4 8.4 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5Z" />
      </IconTile>
    ),
  },
  {
    title: "Wali involvement",
    body: "We strongly encourage wali (guardian) involvement throughout the marriage process.",
    badge: (
      <IconTile>
        <circle cx="12" cy="7.5" r="2.6" />
        <circle cx="5.5" cy="10" r="2" />
        <circle cx="18.5" cy="10" r="2" />
        <path d="M7.5 19c0-2.8 2-4.8 4.5-4.8s4.5 2 4.5 4.8M2.5 18c0-2 1.3-3.5 3-3.5 1 0 1.8.4 2.3 1M21.5 18c0-2-1.3-3.5-3-3.5-1 0-1.8.4-2.3 1" />
      </IconTile>
    ),
  },
  {
    title: "Every profile reviewed",
    body: "Every profile is individually reviewed by our team before approval, helping to keep our community genuine and safe.",
    badge: (
      <IconTile>
        <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </IconTile>
    ),
  },
  {
    title: "Dedicated wali oversight",
    body: "Give your wali read-only access to chats, so they can stay informed and support you throughout.",
    badge: (
      <IconTile>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </IconTile>
    ),
  },
  {
    title: "Culturally appropriate",
    body: "Designed for Pashtun Muslims, our platform celebrates our culture while upholding Islamic values.",
    badge: (
      <IconTile>
        <path d="M12 7.2s-2.6-1.7-2.6-3.3A1.4 1.4 0 0 1 12 3.3a1.4 1.4 0 0 1 2.6.6c0 1.6-2.6 3.3-2.6 3.3Z" fill="var(--brand)" />
        <circle cx="12" cy="11.5" r="2.2" />
        <circle cx="6" cy="13" r="1.8" />
        <circle cx="18" cy="13" r="1.8" />
        <path d="M8 21c0-2.6 1.8-4.5 4-4.5s4 1.9 4 4.5M2.8 20c0-1.8 1.3-3.2 3.2-3.2M21.2 20c0-1.8-1.3-3.2-3.2-3.2" />
      </IconTile>
    ),
  },
  {
    title: "More with Gold",
    body: "Upgrade to Gold for 10 monthly Match Tokens, personalised Match Insights and more premium features.",
    link: true,
    badge: (
      <span className="font-display inline-flex items-center h-[38px] px-4 rounded-full bg-gradient-to-r from-[#f9cfe0] to-[#fbe3c4] text-[15px] font-medium text-ink-950">
        Gold
      </span>
    ),
  },
];

export function WhyUs() {
  return (
    <section id="why-us" className="bg-blush scroll-mt-20 py-20 sm:py-28">
      <SectionHeading
        title={
          <>
            Nikah, the <span className="text-brand">Pashtun</span> way.
          </>
        }
        subtitle="Built for our people."
      />

      {/* The 1px gap over a tinted background draws the dividers between cells. */}
      <div className="reveal max-w-6xl mx-auto px-5 sm:px-8 mt-14 sm:mt-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-ink-900/8">
          {features.map((f) => (
            <div key={f.title} className="bg-blush py-7 sm:px-6 lg:px-8">
              <div className="h-[60px] flex items-center">{f.badge}</div>
              <h3 className="font-display mt-5 text-[22px] sm:text-[24px] font-semibold text-ink-950">{f.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-[#8b8e95]">{f.body}</p>
              {f.link ? (
                <Link href="/settings/membership" className="mt-2 inline-block text-[16px] text-brand hover:underline">
                  Learn more about Gold →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
