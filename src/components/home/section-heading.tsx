import type { ReactNode } from "react";

export function SectionHeading({ title, subtitle }: { title: ReactNode; subtitle: ReactNode }) {
  return (
    <div className="reveal text-center px-5">
      <h2 className="font-display text-[36px] leading-[1.1] sm:text-[60px] lg:text-[68px] font-semibold tracking-[-0.02em] text-black">
        {title}
      </h2>
      <p className="font-display mt-3 sm:mt-4 text-[18px] sm:text-[28px] font-normal text-[#80838b]">{subtitle}</p>
    </div>
  );
}
