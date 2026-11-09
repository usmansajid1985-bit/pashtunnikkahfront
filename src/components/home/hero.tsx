import Image from "next/image";
import Link from "next/link";
import { GetAppButton } from "@/components/home/get-app-button";

/** Members already have an account, so the primary CTA takes them to Browse instead of Sign up. */
export function SignupAndAppButtons({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="flex flex-col items-center gap-[18px]">
      <Link
        href={loggedIn ? "/browse" : "/signup"}
        className="font-display inline-flex items-center justify-center min-w-[175px] px-6 h-[46px] rounded-full bg-brand text-white text-[16px] font-medium shadow-[0_6px_18px_-6px_rgba(225,45,114,0.6)] hover:bg-brand-700 transition"
      >
        {loggedIn ? "Find your match" : "Sign up"}
      </Link>
      <GetAppButton />
    </div>
  );
}

export function Hero({ loggedIn }: { loggedIn: boolean }) {
  // Pure-white hero that fills the first screen on desktop and mobile (100svh so mobile browser
  // chrome doesn't let the next section peek). Just the PN logo, the headline and the CTAs.
  return (
    <section className="relative bg-white min-h-[100svh] flex flex-col items-center justify-center px-5 py-12 text-center">
      <Image
        src="/images/logo.png"
        alt=""
        width={240}
        height={240}
        priority
        className="w-[168px] h-[168px] sm:w-[240px] sm:h-[240px] object-contain"
      />
      <p className="font-display mt-7 text-[30px] leading-tight sm:text-[60px] font-normal tracking-[-0.01em] text-black">
        Where <span className="text-brand">Pashtuns</span> marry.
      </p>
      <div className="mt-11 sm:mt-14">
        <SignupAndAppButtons loggedIn={loggedIn} />
      </div>
      <span aria-hidden className="absolute bottom-6 left-1/2 -translate-x-1/2 text-ink-900/25">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </section>
  );
}
