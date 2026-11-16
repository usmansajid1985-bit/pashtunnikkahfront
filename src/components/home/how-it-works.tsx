import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/home/section-heading";

const steps: { title: string; body: ReactNode; icon: ReactNode }[] = [
  {
    title: "Discover",
    body: (
      <>
        Browse reviewed Pashtun
        <br className="hidden sm:block" /> Muslim profiles.
      </>
    ),
    icon: (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m20 20-5-5" />
      </>
    ),
  },
  {
    title: "Request and match",
    body: (
      <>
        Send a Match Request and
        <br className="hidden sm:block" /> connect when accepted.
      </>
    ),
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
    body: (
      <>
        Get to know each other
        <br className="hidden sm:block" /> and share photos when ready.
      </>
    ),
    icon: (
      <>
        <path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </>
    ),
  },
  {
    title: "Involve families",
    body: (
      <>
        Request or share wali details
        <br className="hidden sm:block" /> when you both feel ready.
      </>
    ),
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
    body: (
      <>
        Arrange a family-supported
        <br className="hidden sm:block" /> meeting.
      </>
    ),
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
    body: (
      <>
        Build your future together,
        <br className="hidden sm:block" /> Insha&apos;Allah.
      </>
    ),
    icon: (
      <>
        <circle cx="9" cy="14" r="4.5" />
        <circle cx="15" cy="14" r="4.5" />
        <path d="M9 9.5 10.5 6h3L15 9.5" />
      </>
    ),
  },
];

const BRAND = "#e12d72";

/** One flow step: pink number circle, light-pink icon badge, bold title, slate body. Left-aligned. */
function Step({ index }: { index: number }) {
  const step = steps[index];
  return (
    <div className="flex flex-col items-start text-left">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e12d72] text-[15px] font-bold text-white">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdeef3]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {step.icon}
        </svg>
      </span>
      <h3 className="mt-4 text-[20px] font-extrabold tracking-tight text-ink-950">{step.title}</h3>
      <p className="mt-1.5 text-[14.5px] leading-snug text-slate-500">{step.body}</p>
    </div>
  );
}

/** Horizontal connector arrow, aligned with the number circles. `dir` = flow direction. */
function ArrowH({ dir }: { dir: "right" | "left" }) {
  return (
    <div className="flex items-start pt-[18px]" aria-hidden>
      <svg width="46" height="14" viewBox="0 0 46 14" fill="none" className={dir === "left" ? "rotate-180" : ""}>
        <path d="M0 7h38" stroke={BRAND} strokeWidth="2.2" />
        <path d="M36 2l7 5-7 5" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function HowItWorks({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section id="how-it-works" className="bg-blush scroll-mt-20 py-20 sm:py-28">
      <SectionHeading title="How Pashtun Nikah works" subtitle="The first Pashtun marriage app." />

      <div className="reveal mx-auto mt-14 max-w-5xl px-5 sm:px-8 sm:mt-20">
        {/* Desktop / tablet: the snaking flow (01→02→03 ↓ 04←05←06). */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-x-3">
            <Step index={0} />
            <ArrowH dir="right" />
            <Step index={1} />
            <ArrowH dir="right" />
            <Step index={2} />
          </div>

          {/* Down connector from 03 to 04 (rightmost column). */}
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] my-5">
            <div />
            <div />
            <div />
            <div />
            <div className="flex justify-center" aria-hidden>
              <svg width="14" height="40" viewBox="0 0 14 40" fill="none">
                <path d="M7 0v31" stroke={BRAND} strokeWidth="2.2" />
                <path d="M2 29l5 7 5-7" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-x-3">
            <Step index={5} />
            <ArrowH dir="left" />
            <Step index={4} />
            <ArrowH dir="left" />
            <Step index={3} />
          </div>
        </div>

        {/* Mobile: a single vertical column, 01→06, with down connectors. */}
        <div className="sm:hidden flex flex-col items-start gap-0">
          {steps.map((_, i) => (
            <div key={i} className="w-full">
              <Step index={i} />
              {i < steps.length - 1 ? (
                <div className="my-3 ml-5" aria-hidden>
                  <svg width="14" height="30" viewBox="0 0 14 30" fill="none">
                    <path d="M7 0v21" stroke={BRAND} strokeWidth="2.2" />
                    <path d="M2 19l5 7 5-7" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-14 flex justify-center">
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
