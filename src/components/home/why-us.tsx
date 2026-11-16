import { SectionHeading } from "@/components/home/section-heading";

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

      <div className="reveal max-w-3xl mx-auto px-5 sm:px-8 mt-14 sm:mt-20">
        <h3 className="font-display text-[22px] sm:text-[26px] font-semibold text-ink-950">
          Plenty of Muslim marriage apps. But where was the one built for Pashtuns?
        </h3>

        <p className="mt-6 text-[16px] sm:text-[17px] leading-relaxed text-[#8b8e95]">
          That&apos;s the gap we wanted to address. In our community, marriage isn&apos;t just about finding someone
          compatible. Our faith, culture, traditions and families all matter, yet few platforms were built with these in
          mind. So we created Pashtun Nikah, the first dedicated marriage platform that understands what matters to our
          people.
        </p>

        <p className="mt-6 text-[16px] sm:text-[17px] leading-relaxed text-[#8b8e95]">
          <span className="font-semibold text-ink-950">Built by Pashtuns, for Pashtuns.</span> Every profile is manually
          reviewed before approval, your photos stay blurred until you choose to share them, and optional wali oversight
          lets you involve family when you&apos;re ready. Whether you&apos;re back home or living abroad, our aim is
          simple: to make it easier for Pashtuns to find a spouse without compromising the values and traditions we grew
          up with.
        </p>
      </div>
    </section>
  );
}
