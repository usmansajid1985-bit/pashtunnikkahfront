import { SiteHeader } from "@/components/site-header";
import { RevealObserver } from "@/components/reveal-observer";
import { Hero } from "@/components/home/hero";
import { TrustMarquee } from "@/components/home/trust-marquee";
import { HowItWorks } from "@/components/home/how-it-works";
import { PrivacyReveal } from "@/components/home/privacy-reveal";
import { WhyUs } from "@/components/home/why-us";
import { About } from "@/components/home/about";
import { Stories } from "@/components/home/stories";
import { FAQ } from "@/components/home/faq";
import { FinalCTA, SiteFooter } from "@/components/home/cta-footer";
import { getCachedCtaBackground, getCachedHeroSlides } from "@/lib/hero-slides";

export default async function HomePage() {
  const [slides, ctaBg] = await Promise.all([getCachedHeroSlides(), getCachedCtaBackground()]);

  return (
    <>
      <RevealObserver />
      <SiteHeader />
      <main>
        <Hero slides={slides.map((s) => s.image_url)} />
        <TrustMarquee />
        <HowItWorks />
        <PrivacyReveal />
        <WhyUs />
        <About />
        <Stories />
        <FAQ />
        <FinalCTA backgroundUrl={ctaBg} />
      </main>
      <SiteFooter />
    </>
  );
}
