import { SiteHeader } from "@/components/site-header";
import { RevealObserver } from "@/components/reveal-observer";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { PrivacyReveal } from "@/components/home/privacy-reveal";
import { WhyUs } from "@/components/home/why-us";
import { Stories } from "@/components/home/stories";
import { FAQ } from "@/components/home/faq";
import { FinalCTA, SiteFooter } from "@/components/home/cta-footer";
import { poppins } from "@/components/home/landing-font";

export const metadata = {
  title: "Pashtun Nikah — Where Pashtuns marry",
};

export default function HomePage() {
  return (
    <div className={poppins.variable}>
      <RevealObserver />
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <PrivacyReveal />
        <WhyUs />
        <Stories />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
