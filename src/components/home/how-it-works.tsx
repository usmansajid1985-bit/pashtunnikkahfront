import Link from "next/link";
import { SectionHeading } from "@/components/home/section-heading";

const steps = [
  {
    title: "Create your profile",
    body: <>Set up your profile with your key details and preferences.</>,
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
      </>
    ),
  },
  {
    title: "Verify your email",
    body: <>Confirm your email so we can keep your account secure.</>,
    icon: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
  },
  {
    title: "Admin review",
    body: (
      <>
        Our team reviews every <span className="font-semibold text-ink-900">profile before approval.</span>
      </>
    ),
    icon: (
      <>
        <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
  {
    title: "Browse & connect",
    body: <>Explore profiles and send Match Requests to those who interest you.</>,
    icon: (
      <>
        <circle cx="9" cy="12" r="5.5" />
        <circle cx="15" cy="12" r="5.5" />
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-blush scroll-mt-20 py-20 sm:py-28">
      <SectionHeading title="How Pashtun Nikah works" subtitle="The first Pashtun marriage app." />

      <div className="reveal max-w-6xl mx-auto px-5 sm:px-8 mt-14 sm:mt-24">
        {/* Numbered rail above the cards (desktop only; mobile shows the number inside each card). */}
        <div className="hidden lg:grid relative grid-cols-4 gap-5 mb-4">
          <div className="absolute left-[12.5%] right-[12.5%] top-1/2 h-px bg-brand/30" />
          {steps.map((_, i) => (
            <div key={i} className="relative flex justify-center">
              <span
                className={`w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center ${
                  i === 0 ? "bg-brand text-white" : "bg-blush border border-brand text-brand"
                }`}
              >
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-[#f3eaec] bg-white/80 px-6 pt-5 pb-7 text-center shadow-[0_2px_14px_-8px_rgba(225,45,114,0.18)]"
            >
              <span className="lg:hidden absolute top-4 left-4 w-6 h-6 rounded-full border border-brand text-brand text-[11px] font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="mx-auto w-14 h-14 rounded-full bg-[#fdeef3] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.6">
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
          href="/signup"
          className="font-display inline-flex items-center gap-3 px-10 h-[48px] rounded-full bg-brand text-white text-[15px] font-medium shadow-[0_8px_20px_-8px_rgba(225,45,114,0.6)] hover:bg-brand-700 transition"
        >
          Get Started
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
