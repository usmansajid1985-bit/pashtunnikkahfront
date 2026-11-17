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
      <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-[#e12d72] text-[15px] font-bold text-white">
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

/** A single right/left/down chevron drawn on the connector pipe. */
function Chevron({ dir, className }: { dir: "right" | "left" | "down"; className?: string }) {
  const rot = dir === "left" ? "rotate-180" : dir === "down" ? "rotate-90" : "";
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 11 13"
      fill="none"
      aria-hidden
      className={`absolute ${rot} ${className ?? ""}`}
    >
      <path d="M2 2l6 4.5-6 4.5" stroke={BRAND} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HowItWorks({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section id="how-it-works" className="bg-blush scroll-mt-20 py-20 sm:py-28">
      <SectionHeading title="How Pashtun Nikah works" subtitle="The first Pashtun marriage app." />

      <div className="reveal mx-auto mt-14 max-w-5xl px-5 sm:px-8 sm:mt-20">
        {/* Desktop / tablet: one continuous rounded pipe — 01→02→03, round the right edge, 04←05←06. */}
        <div className="hidden sm:block relative">
          {/* Top row */}
          <div className="relative grid grid-cols-3 gap-x-3">
            {/* Continuous line from the 01 circle across to the right edge (where the elbow begins). */}
            <div className="pointer-events-none absolute left-[22px] right-[17px] top-[21px] h-[2.4px] rounded bg-[#e12d72]" aria-hidden />
            <Chevron dir="right" className="top-[15px] left-[16.666%] -translate-x-1/2" />
            <Chevron dir="right" className="top-[15px] left-[50%] -translate-x-1/2" />
            <Step index={0} />
            <Step index={1} />
            <Step index={2} />
          </div>

          {/* Right elbow: rounded pipe wrapping from the top row down to the bottom row. */}
          <div
            className="pointer-events-none absolute right-[17px] top-[21px] h-[228px] w-[34px] rounded-r-[17px] border-[2.4px] border-l-0 border-[#e12d72]"
            aria-hidden
          />
          <Chevron dir="down" className="right-[14px] top-[122px]" />

          {/* Bottom row */}
          <div className="relative mt-8 grid grid-cols-3 gap-x-3">
            {/* Continuous line from the right edge back to the 06 circle. */}
            <div className="pointer-events-none absolute left-[22px] right-[17px] top-[21px] h-[2.4px] rounded bg-[#e12d72]" aria-hidden />
            <Chevron dir="left" className="top-[15px] left-[16.666%] -translate-x-1/2" />
            <Chevron dir="left" className="top-[15px] left-[50%] -translate-x-1/2" />
            <Step index={5} />
            <Step index={4} />
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
