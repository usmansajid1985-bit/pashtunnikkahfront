import Link from "next/link";

const steps = [
  {
    title: "Create Your Profile",
    body: "Confidential registration covering personal, family & educational background.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.6">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
      </svg>
    ),
  },
  {
    title: "Verify Your Email",
    body: "Secure your account — no spam, only important status updates.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.6">
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    ),
  },
  {
    title: "Admin Review",
    body: "Our team reviews every submission for authenticity and safety.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.6">
        <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Receive Your Profile ID",
    body: "Your unique, verified identity on the platform.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.6">
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <circle cx="8" cy="11" r="2" />
        <path d="M5.5 15.5c0-1.5 1.2-2.5 2.5-2.5s2.5 1 2.5 2.5" />
        <path d="M14 9.5h5M14 13h5" />
      </svg>
    ),
  },
  {
    title: "Browse & Connect",
    body: "Send connection requests to profiles that catch your interest.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.6">
        <circle cx="9" cy="12" r="5.5" />
        <circle cx="15" cy="12" r="5.5" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-cream py-20 sm:py-24">
      <div className="deco-blob w-72 h-72 -top-10 -right-10 bg-rose-200/50" />
      <div className="deco-blob w-56 h-56 -bottom-10 -left-10 bg-rose-200/40" />
      <svg
        className="hidden sm:block absolute top-6 right-6 w-40 h-40 text-gold/40"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
      >
        <circle cx="70" cy="30" r="28" />
        <circle cx="70" cy="30" r="18" />
        <circle cx="70" cy="30" r="8" />
        <path d="M42 30h56M70 2v56M50.4 9.6l39.2 40.8M89.6 9.6 50.4 50.4" />
      </svg>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 reveal">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#aa1945">
            <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z" />
          </svg>
          <span className="text-rose-600 text-xs font-bold uppercase tracking-widest">Process</span>
        </div>
        <h2 className="font-serif mt-3 text-4xl sm:text-5xl font-medium text-ink-950 tracking-tight">
          From registration to Nikah
        </h2>
        <p className="mt-3 text-ink-700 max-w-md">
          A private, verified and thoughtful journey toward meaningful connection.
        </p>
        <div className="dash-divider mt-4">
          <span className="line" />
          <span className="diamond" />
        </div>
      </div>

      <div className="hidden lg:block max-w-7xl mx-auto px-5 sm:px-8 mt-14 reveal">
        <div className="relative grid grid-cols-5 gap-6 mb-6">
          <div className="absolute left-[9%] right-[9%] top-4 h-px bg-rose-600/40" />
          {steps.map((_, i) => (
            <div key={i} className="relative z-10 flex justify-center">
              <div
                className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${
                  i === 0
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "bg-white border-2 border-rose-600 text-rose-600"
                }`}
              >
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-6">
          {steps.map((step) => (
            <div
              key={step.title}
              className="card-hover bg-white/70 backdrop-blur-sm rounded-2xl border border-rose-100 shadow-sm p-6 text-center"
            >
              <div className="step-icon-badge mx-auto">{step.icon}</div>
              <h3 className="font-serif mt-4 text-lg font-semibold text-ink-950">{step.title}</h3>
              <div className="dash-divider mt-2 mb-2 justify-center">
                <span className="line" />
                <span className="diamond" />
              </div>
              <p className="text-xs text-ink-700 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end pr-2">
          <div className="flex items-center gap-2 text-rose-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="font-serif italic text-sm">Toward Nikah</span>
          </div>
        </div>
      </div>

      <div id="steps-scroller" className="lg:hidden relative mt-10 flex gap-3 overflow-x-auto px-5 pb-2">
        {steps.map((step) => (
          <div
            key={step.title}
            className="step-card shrink-0 w-[68vw] rounded-2xl border border-rose-100 bg-white p-5 text-center"
          >
            <div className="step-icon-badge mx-auto w-12 h-12">{step.icon}</div>
            <h3 className="font-serif mt-3 font-semibold text-ink-950">{step.title}</h3>
            <p className="mt-1.5 text-xs text-ink-700 leading-relaxed">{step.body}</p>
          </div>
        ))}
        <div className="shrink-0 w-1" />
      </div>
      <p className="lg:hidden text-center text-xs text-ink-900/35 mt-2">← swipe →</p>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 mt-12 flex flex-col items-center reveal">
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-semibold shadow-lg shadow-rose-900/20"
          style={{ background: "linear-gradient(135deg, #aa1945, #7a1236)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2Z" />
          </svg>
          Begin Your Journey
        </Link>
        <div className="dash-divider mt-4">
          <span className="line" />
          <span className="diamond" />
          <span className="line" />
        </div>
      </div>
    </section>
  );
}
