import Image from "next/image";
import Link from "next/link";
import { GetAppButton } from "@/components/home/get-app-button";

export function SignupAndAppButtons() {
  return (
    <div className="flex flex-col items-center gap-[18px]">
      <Link
        href="/signup"
        className="font-display inline-flex items-center justify-center w-[175px] h-[46px] rounded-full bg-brand text-white text-[16px] font-medium shadow-[0_6px_18px_-6px_rgba(225,45,114,0.6)] hover:bg-brand-700 transition"
      >
        Sign up
      </Link>
      <GetAppButton />
    </div>
  );
}

export function Hero() {
  return (
    <section className="bg-white">
      <div className="max-w-5xl mx-auto px-5 pt-14 pb-20 sm:pt-20 sm:pb-24 text-center">
        <Image
          src="/images/logo.png"
          alt=""
          width={220}
          height={220}
          priority
          className="mx-auto w-[150px] h-[150px] sm:w-[220px] sm:h-[220px] object-contain"
        />
        <h1 className="font-display mt-6 sm:mt-8 text-[44px] leading-[1.1] sm:text-[68px] font-semibold tracking-[-0.01em] text-black">
          Pashtun Nikah
        </h1>
        <p className="font-display mt-1 sm:mt-2 text-[27px] leading-tight sm:text-[56px] font-normal tracking-[-0.01em] text-black">
          Where <span className="text-brand">Pashtuns</span> marry.
        </p>
        <div className="mt-12 sm:mt-14">
          <SignupAndAppButtons />
        </div>
      </div>
    </section>
  );
}
