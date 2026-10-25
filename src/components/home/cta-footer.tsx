import Link from "next/link";
import Image from "next/image";
import { SignupAndAppButtons } from "@/components/home/hero";

export function FinalCTA() {
  return (
    <section className="bg-blush py-24 sm:py-32 text-center">
      <h2 className="reveal font-display font-semibold tracking-[-0.02em] leading-[1.05]">
        <span className="block text-[48px] sm:text-[76px] text-black">Join</span>
        <span className="block text-[44px] sm:text-[76px] text-brand">Pashtun Nikah</span>
      </h2>
      <div className="mt-12 sm:mt-14">
        <SignupAndAppButtons />
      </div>
    </section>
  );
}

export function LogoTile({ size }: { size: number }) {
  return (
    <Image
      src="/images/landing/logo-tile.webp"
      alt=""
      width={size}
      height={size}
      className="rounded-[24%] shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: "Quick Links",
    links: [
      ["/", "Home"],
      ["/#how-it-works", "How It Works"],
      ["/#privacy", "Why Us"],
      ["/#stories", "Success Stories"],
      ["/#faq", "FAQ"],
    ],
  },
  {
    title: "Product",
    links: [
      ["/signup", "Sign up"],
      ["/settings/membership", "Gold"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/terms", "Terms of Service"],
      ["/privacy", "Privacy Policy"],
      ["/refund-policy", "Refund Policy"],
      ["/guidelines", "Community Guidelines"],
    ],
  },
  {
    title: "Help & Support",
    links: [
      ["/support", "Support"],
      ["/settings/delete-account", "Account deletion"],
    ],
  },
];

// TODO: swap in the real social profile URLs.
const socials = [
  {
    label: "Instagram",
    href: "#",
    icon: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    label: "Facebook",
    href: "#",
    icon: <path d="M14 8.5h2.5V5H14c-2.2 0-3.5 1.5-3.5 3.7V11H8v3.5h2.5V21H14v-6.5h2.5L17 11h-3V9.2c0-.4.3-.7.7-.7Z" fill="currentColor" stroke="none" />,
  },
  {
    label: "TikTok",
    href: "#",
    icon: (
      <path
        d="M16.6 3h-3.2v12.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .5 0 .8.1V9.2a6 6 0 1 0 5.2 6V9.1a7.4 7.4 0 0 0 4.4 1.4V7.3a4.4 4.4 0 0 1-4.4-4.3Z"
        fill="currentColor"
        stroke="none"
      />
    ),
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#0b0b10] text-white">
      {/* Soft pink glows top-left and bottom-right, as in the design. */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full bg-brand/25 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 w-[460px] h-[460px] rounded-full bg-[#7b2cbf]/20 blur-[120px]" />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.75fr_0.6fr_0.85fr_0.75fr] lg:gap-6">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <LogoTile size={52} />
              <span className="font-display text-[26px] text-white">Pashtun Nikah</span>
            </Link>
            <p className="mt-4 text-[15px] text-white/70">The first dedicated Pashtun marriage app.</p>
            <div className="mt-6 flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-10 h-10 rounded-full border border-white/25 flex items-center justify-center text-white hover:border-brand hover:text-brand transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    {s.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:contents">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-brand text-[12px] font-semibold uppercase tracking-[0.14em]">{col.title}</h3>
                <ul className="mt-4 space-y-2.5 text-[14px] text-white/85">
                  {col.links.map(([href, label]) => (
                    <li key={label}>
                      <Link href={href} className="hover:text-white hover:underline transition">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 h-px bg-gradient-to-r from-transparent via-brand/60 to-[#7b2cbf]/50" />
        <p className="mt-6 text-[13px] text-white/70">© 2026 Pashtun Nikah. All rights reserved.</p>
      </div>
    </footer>
  );
}
