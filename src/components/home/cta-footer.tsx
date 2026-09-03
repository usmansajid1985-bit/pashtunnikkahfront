import Link from "next/link";
import Image from "next/image";

export function FinalCTA({ backgroundUrl }: { backgroundUrl?: string | null }) {
  return (
    <section className="relative overflow-hidden border-t border-ink-900/5">
      {backgroundUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${backgroundUrl}')` }}
          />
          <div className="absolute inset-0 bg-rose-50/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-rose-50/60" />
      )}
      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 py-24 sm:py-32 text-center reveal">
        <h2 className="font-serif text-4xl sm:text-6xl font-medium text-ink-950 tracking-tight leading-[1.05]">
          Start your journey
          <br />
          <span className="italic">today.</span>
        </h2>
        <p className="mt-5 text-ink-700 max-w-md mx-auto">
          Register your profile and connect with Pashtun families through a trusted, verified platform.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-9 px-8 py-4 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
        >
          Get Started — It&apos;s Free
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink-950">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-20 pb-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10 lg:gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/images/logo.png" alt="Pashtun Nikah logo" width={36} height={36} className="rounded-lg object-cover" />
              <span className="text-lg font-semibold text-white">Pashtun Nikah</span>
            </Link>
            <p className="mt-4 text-sm text-white/50 leading-relaxed max-w-xs">
              The first dedicated Pashtun Nikah platform — connecting families with trust, tradition, and transparency.
            </p>
          </div>

          <div>
            <h3 className="text-rose-300 font-semibold text-sm uppercase tracking-wide">Quick Links</h3>
            <ul className="mt-5 space-y-3 text-sm text-white/55">
              <li><Link href="/" className="hover:text-white transition">Home</Link></li>
              <li><Link href="/#how-it-works" className="hover:text-white transition">How It Works</Link></li>
              <li><Link href="/#trust" className="hover:text-white transition">Why Us</Link></li>
              <li><Link href="/#stories" className="hover:text-white transition">Success Stories</Link></li>
              <li><Link href="/#faq" className="hover:text-white transition">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-rose-300 font-semibold text-sm uppercase tracking-wide">Support</h3>
            <ul className="mt-5 space-y-3 text-sm text-white/55">
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><a href="mailto:info@pashtunnikah.com" className="hover:text-white transition">Contact Us</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-rose-300 font-semibold text-sm uppercase tracking-wide">Contact</h3>
            <ul className="mt-5 space-y-3 text-sm text-white/55">
              <li>
                <a href="mailto:info@pashtunnikah.com" className="hover:text-white transition">
                  info@pashtunnikah.com
                </a>
              </li>
              <li>Worldwide · Remote-first</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 text-center sm:text-left">
          <p className="text-xs text-white/40">© 2026 Pashtun Nikah. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
