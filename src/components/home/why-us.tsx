export function WhyUs() {
  return (
    <section id="trust" className="max-w-7xl mx-auto px-5 sm:px-8 py-24 sm:py-32">
      <div className="reveal max-w-lg">
        <span className="text-rose-600 text-xs font-semibold uppercase tracking-widest">Why Us</span>
        <h2 className="font-serif mt-3 text-4xl sm:text-5xl font-medium text-ink-950 tracking-tight">
          Built on trust &amp; principle
        </h2>
      </div>

      <div className="reveal mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 lg:row-span-2 p-8 rounded-3xl bg-rose-600 text-white card-hover flex flex-col justify-between min-h-[220px]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6">
            <path d="M12 21c-4.97-2.5-8-6.5-8-10.5A5.5 5.5 0 0 1 9.5 5c1.03 0 2.02.35 2.5 1 0 0 1.47-1 2.5-1A5.5 5.5 0 0 1 20 10.5c0 4-3.03 8-8 10.5Z" />
          </svg>
          <div>
            <h3 className="font-serif text-2xl mt-6">Shariah Compliant</h3>
            <p className="mt-2 text-white/75 text-sm leading-relaxed">
              Every step is designed in accordance with Islamic principles. Wali involvement is encouraged and the
              process remains halal throughout.
            </p>
          </div>
        </div>
        <div className="p-7 rounded-3xl border border-ink-900/8 card-hover">
          <h3 className="font-semibold text-ink-950">Guaranteed Anonymity</h3>
          <p className="mt-2 text-sm text-ink-700 leading-relaxed">
            Contact details are never publicly displayed — shared only through verified channels.
          </p>
        </div>
        <div className="p-7 rounded-3xl border border-ink-900/8 card-hover">
          <h3 className="font-semibold text-ink-950">100% Verified</h3>
          <p className="mt-2 text-sm text-ink-700 leading-relaxed">
            Every profile is manually reviewed before going live. Zero fake profiles.
          </p>
        </div>
        <div className="p-7 rounded-3xl border border-ink-900/8 card-hover">
          <h3 className="font-semibold text-ink-950">Family Involvement</h3>
          <p className="mt-2 text-sm text-ink-700 leading-relaxed">
            Wali (guardian) involvement is encouraged at every stage — not a dating app.
          </p>
        </div>
        <div className="p-7 rounded-3xl border border-ink-900/8 card-hover">
          <h3 className="font-semibold text-ink-950">Profile ID Verification</h3>
          <p className="mt-2 text-sm text-ink-700 leading-relaxed">
            Every approved member gets a unique ID anyone can verify.
          </p>
        </div>
        <div className="lg:col-span-2 p-7 rounded-3xl border border-ink-900/8 card-hover flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-ink-950">Free to Register</h3>
            <p className="mt-2 text-sm text-ink-700 leading-relaxed">
              No hidden fees — accessible to all Pashtun families worldwide.
            </p>
          </div>
          <span className="font-serif text-4xl text-ink-950/10 shrink-0">£0</span>
        </div>
      </div>
    </section>
  );
}
