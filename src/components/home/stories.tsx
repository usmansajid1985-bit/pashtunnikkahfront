import Image from "next/image";
import { SectionHeading } from "@/components/home/section-heading";

// Screenshots of real member messages, shared with permission (names as given in the design).
const marriageMessages = [
  { img: "/images/landing/msg-waleed.webp", w: 984, h: 536, name: "Waleed", side: "left" },
  { img: "/images/landing/msg-anon.webp", w: 1096, h: 392, name: "Anonymous member", side: "right" },
  { img: "/images/landing/msg-sara.webp", w: 1216, h: 432, name: "Sara", side: "left" },
] as const;

// Kind-words testimonials — clean dark chat screenshots, each attributed to a member. Shown as a
// gently auto-scrolling carousel (cleaner than the old stacked masonry).
const kindWords = [
  { img: "/images/landing/kind-2.webp", w: 1064, h: 240, name: "Isa" },
  { img: "/images/landing/kind-5.webp", w: 1112, h: 328, name: "Mustafa" },
  { img: "/images/landing/kind-3.webp", w: 856, h: 360, name: "Sofia" },
  { img: "/images/landing/kind-1.webp", w: 888, h: 272, name: "Anonymous" },
  { img: "/images/landing/kind-4.webp", w: 1104, h: 296, name: "Bilal" },
];

function ChatBubbleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-3.9A7.5 7.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function TestimonialCard({ img, w, h, name }: { img: string; w: number; h: number; name: string }) {
  return (
    <figure className="mx-2.5 flex h-[360px] w-[300px] sm:w-[340px] shrink-0 flex-col rounded-[22px] bg-white border border-ink-900/5 shadow-[0_14px_40px_-22px_rgba(0,0,0,0.5)] p-5">
      <div className="flex flex-1 items-center overflow-hidden">
        <Image src={img} alt={`Message from ${name}`} width={w} height={h} className="w-full h-auto rounded-xl" />
      </div>
      <figcaption className="mt-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#fde4ef] px-5 py-2 text-[15px] font-semibold text-brand">
          <ChatBubbleIcon />
          {name}
        </span>
      </figcaption>
    </figure>
  );
}

function Screenshot({ img, w, h, alt }: { img: string; w: number; h: number; alt: string }) {
  return (
    <Image
      src={img}
      alt={alt}
      width={w}
      height={h}
      className="w-full h-auto rounded-[14px] sm:rounded-[18px] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)]"
    />
  );
}

export function Stories() {
  return (
    <>
      <section id="stories" className="bg-white scroll-mt-20 py-20 sm:py-28">
        <SectionHeading
          title={
            <>
              Real marriages. <span className="text-brand">Real messages.</span>
            </>
          }
          subtitle="Genuine messages from our users."
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-8 mt-12 sm:mt-20 flex flex-col gap-6 sm:gap-3">
          {marriageMessages.map((m) => (
            <figure
              key={m.name}
              className={`reveal flex flex-col gap-3 sm:items-center sm:gap-5 ${
                m.side === "left" ? "sm:flex-row" : "sm:flex-row-reverse"
              }`}
            >
              <div className={m.name === "Sara" ? "sm:w-[62%]" : m.side === "left" ? "sm:w-[50%]" : "sm:w-[55%]"}>
                <Screenshot img={m.img} w={m.w} h={m.h} alt={`Message from ${m.name}`} />
              </div>
              <figcaption
                className={`font-display text-[22px] sm:text-[32px] font-semibold text-brand ${
                  m.side === "right" ? "sm:text-right text-right" : ""
                }`}
              >
                {m.side === "left" ? (
                  <>
                    <span className="text-black">– </span>
                    {m.name}
                  </>
                ) : (
                  <>
                    {m.name}
                    <span className="text-black"> –</span>
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-blush py-20 sm:py-28">
        <SectionHeading
          title={
            <>
              What our <span className="text-brand">members</span> say.
            </>
          }
          subtitle="Kind words from our community."
        />

        {/* Auto-scrolling carousel of testimonial cards (duplicated once for a seamless loop;
            pauses on hover). Replaces the old stacked masonry (T3 testimonials redesign). */}
        <div className="mt-12 sm:mt-16 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <div className="marquee-track hover:[animation-play-state:paused] py-2">
            {[...kindWords, ...kindWords].map((k, i) => (
              <TestimonialCard key={`${k.img}-${i}`} img={k.img} w={k.w} h={k.h} name={k.name} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
