import Link from "next/link";
import { SectionHeading } from "@/components/home/section-heading";

const steps = [
  {
    title: "Discover",
    body: <>Browse reviewed Pashtun Muslim profiles.</>,
    icon: (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m20 20-5-5" />
      </>
    ),
  },
  {
    title: "Request and match",
    body: <>Send a Match Request and connect when accepted.</>,
    icon: (
      <>
        <circle cx="8" cy="9" r="2.6" />
        <circle cx="16" cy="9" r="2.6" />
        <path d="M3.5 19c0-3 2-4.6 4.5-4.6S12.5 16 12.5 19" />
        <path d="M11.5 19c0-3 2-4.6 4.5-4.6S20.5 16 20.5 19" />
      </>
    ),
  },
  {
    title: "Chat for free!",
    body: <>Get to know each other and share photos when ready.</>,
    icon: (
      <>
        <path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </>
    ),
  },
  {
    title: "Involve families",
    body: <>Request or share wali details when you both feel ready.</>,
    icon: (
      <>
        <circle cx="8" cy="9" r="2.6" />
        <circle cx="16" cy="9" r="2.6" />
        <path d="M3.5 19c0-3 2-4.6 4.5-4.6S12.5 16 12.5 19" />
        <path d="M11.5 19c0-3 2-4.6 4.5-4.6S20.5 16 20.5 19" />
      </>
    ),
  },
  {
    title: "Meet with families",
    body: <>Arrange a family-supported meeting.</>,
    icon: (
      <>
        <circle cx="8.5" cy="8" r="2.4" />
        <circle cx="15.5" cy="8" r="2.4" />
        <path d="M4 13h16v6H4z" />
        <path d="M4 13V12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      </>
    ),
  },
  {
    title: "Nikah!",
    body: <>Build your future together, Insha&apos;Allah.</>,
    icon: (
      <>
        <circle cx="9" cy="14" r="4.5" />
        <circle cx="15" cy="14" r="4.5" />
        <path d="M9 9.5 10.5 6h3L15 9.5" />
      </>
    ),
  },
];

export function HowItWorks({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section id="how-it-works" className="bg-blush scroll-mt-20 py-20 sm:py-28">
      <SectionHeading title="How Pashtun Nikah works" subtitle="The first Pashtun marriage app." />

      <div className="reveal max-w-6xl mx-auto px-5 sm:px-8 mt-14 sm:mt-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-[#f3eaec] bg-white/80 px-6 pt-5 pb-7 text-center shadow-[0_2px_14px_-8px_rgba(225,45,114,0.18)]"
            >
              <span className="absolute top-4 left-4 w-7 h-7 rounded-full bg-brand text-white text-[12px] font-semibold flex items-center justify-center">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mx-auto w-14 h-14 rounded-full bg-[#fdeef3] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {step.icon}
                </svg>
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-ink-950">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-700/90">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          href={loggedIn ? "/browse" : "/signup"}
          className="font-display inline-flex items-center gap-3 px-10 h-[48px] rounded-full bg-brand text-white text-[15px] font-medium shadow-[0_8px_20px_-8px_rgba(225,45,114,0.6)] hover:bg-brand-700 transition"
        >
          {loggedIn ? "Find your match" : "Get Started"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
