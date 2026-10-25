import Image from "next/image";
import { SectionHeading } from "@/components/home/section-heading";

// Screenshots of real member messages, shared with permission (names as given in the design).
const marriageMessages = [
  { img: "/images/landing/msg-waleed.webp", w: 984, h: 536, name: "Waleed", side: "left" },
  { img: "/images/landing/msg-anon.webp", w: 1096, h: 392, name: "Anonymous member", side: "right" },
  { img: "/images/landing/msg-sara.webp", w: 1216, h: 432, name: "Sara", side: "left" },
] as const;

const kindWords = [
  { img: "/images/landing/kind-1.webp", w: 888, h: 272 },
  { img: "/images/landing/kind-2.webp", w: 1064, h: 240 },
  { img: "/images/landing/kind-3.webp", w: 856, h: 360 },
  { img: "/images/landing/kind-4.webp", w: 1104, h: 296 },
  { img: "/images/landing/kind-5.webp", w: 1112, h: 328 },
];

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

        <div className="reveal max-w-6xl mx-auto px-5 sm:px-8 mt-12 sm:mt-20 columns-1 md:columns-2 gap-3 [&>*]:mb-3">
          {kindWords.map((k, i) => (
            <div key={k.img} className="break-inside-avoid">
              <Screenshot img={k.img} w={k.w} h={k.h} alt={`Message from a member ${i + 1}`} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
