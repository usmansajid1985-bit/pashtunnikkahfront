import { SectionHeading } from "@/components/home/section-heading";
import { PrivacySlider } from "@/components/home/privacy-slider";

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

      <PrivacySlider steps={steps} />
    </section>
  );
}
