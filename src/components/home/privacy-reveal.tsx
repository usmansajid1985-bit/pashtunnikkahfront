import Image from "next/image";
import { SectionHeading } from "@/components/home/section-heading";

const steps = [
  {
    img: "/images/landing/phone-private.webp",
    alt: "A blurred profile photo with a lock icon",
    title: "Private by default",
    body: "Your photos stay blurred while browsing.",
  },
  {
    img: "/images/landing/phone-share.webp",
    alt: "The Share photos sheet in a chat, with two photos selected",
    title: "Share when matched",
    body: "Choose up to 3 photos to share in chat.",
  },
  {
    img: "/images/landing/phone-reveal.webp",
    alt: "A revealed photo with a 00:42 countdown",
    title: "60-second reveal",
    body: "Each photo is visible for up to 60 seconds, then blurs again.",
  },
];

export function PrivacyReveal() {
  return (
    <section id="privacy" className="bg-white scroll-mt-20 py-20 sm:py-28">
      <SectionHeading
        title={
          <>
            Your <span className="text-brand">photo</span>, your <span className="text-brand">call.</span>
          </>
        }
        subtitle="Blurred by default. Shared on your terms."
      />

      <div className="reveal max-w-6xl mx-auto px-5 sm:px-8 mt-14 sm:mt-20 grid gap-14 sm:gap-8 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center">
            <Image
              src={step.img}
              alt={step.alt}
              width={510}
              height={925}
              className="w-[230px] lg:w-[250px] h-auto"
            />
            <div className="mt-8 flex items-start gap-4 max-w-[270px]">
              <span className="font-display shrink-0 w-12 h-12 rounded-full bg-[#fde6ef] text-brand text-[22px] font-medium flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[19px] font-bold text-ink-950">{step.title}</h3>
                <p className="mt-1 text-[15px] leading-snug text-[#8b8e95]">{step.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
