const photos = [
  "https://images.unsplash.com/photo-1758141248347-85f72b9c6e78?q=80&w=700&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1762708550230-1018abb0a30d?q=80&w=700&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1762709412829-2bf47bb5c6a5?q=80&w=700&auto=format&fit=crop",
];

const features = [
  {
    title: "You're in control",
    body: "Decide who gets to see you.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    ),
  },
  {
    title: "Privacy by default",
    body: "Your photos stay hidden until there's a match.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.9 2.9-5.17 5.21-6.43" />
        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.6 11.6 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
        <path d="M1 1l22 22" />
      </svg>
    ),
  },
  {
    title: "Built on respect",
    body: "Safe, intentional connections only.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M12 21s-7-4.35-9-8.5C1.4 9 3 5.5 6.5 5.5c2 0 3.7 1.2 5.5 3.3 1.8-2.1 3.5-3.3 5.5-3.3 3.5 0 5.1 3.5 3.5 7C19 16.65 12 21 12 21Z" />
      </svg>
    ),
  },
];

const steps = [
  {
    title: "Hidden by default",
    body: "Your photo is blurred to protect your privacy.",
    blur: "blur-[22px] scale-110",
    badge: "lock" as const,
    photo: photos[0],
  },
  {
    title: "Reveal when it's mutual",
    body: "Photos unlock only when there's mutual interest.",
    blur: "blur-[8px] scale-105",
    badge: "eye" as const,
    photo: photos[1],
  },
  {
    title: "Matched ✓",
    body: "You've matched. Here's the real you.",
    blur: "",
    badge: "check" as const,
    photo: photos[2],
  },
];

function StepBadge({ kind }: { kind: "lock" | "eye" | "check" }) {
  const ring =
    kind === "check"
      ? "bg-rose-600 text-white border-rose-600"
      : "bg-black/25 text-white border-rose-500/80 backdrop-blur-sm";
  return (
    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full border ${ring}`}>
      {kind === "lock" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      ) : kind === "eye" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12.5 10 17.5 19 7.5" />
        </svg>
      )}
    </span>
  );
}

function Chevron() {
  return (
    <span className="hidden lg:flex shrink-0 text-rose-500" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export function PrivacyReveal() {
  return (
    <section className="bg-black">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] gap-12 lg:gap-16 items-center">
          <div className="reveal">
            <p className="inline-flex items-center gap-2 text-rose-500 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Privacy
            </p>
            <h2 className="mt-4 text-4xl sm:text-5xl lg:text-[3.35rem] font-semibold text-white tracking-tight leading-[1.08]">
              Your photo,{" "}
              <span className="bg-gradient-to-r from-rose-500 to-rose-300 bg-clip-text text-transparent">your call</span>
            </h2>
            <p className="mt-4 text-white/45 text-[15px] leading-relaxed max-w-md">
              Photos stay blurred by default. Reveal only when the feeling is mutual.
            </p>

            <ul className="mt-9 divide-y divide-white/10">
              {features.map((f) => (
                <li key={f.title} className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
                  <span className="mt-0.5 text-white/80">{f.icon}</span>
                  <div>
                    <p className="text-white font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-sm text-white/40">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2.5">
            {steps.map((step, i) => (
              <div key={step.title} className="contents">
                {i > 0 ? <Chevron /> : null}
                <article className="flex-1 min-w-0 rounded-[22px] border border-white/10 bg-white/[0.04] p-2.5 shadow-[0_0_0_1px_rgba(170,25,69,0.12)]">
                  <div className="relative overflow-hidden rounded-[16px] aspect-[3/4] bg-ink-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={step.photo}
                      alt=""
                      className={`absolute inset-0 h-full w-full object-cover ${step.blur}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <StepBadge kind={step.badge} />
                    </div>
                  </div>
                  <div className="px-2.5 pt-3.5 pb-3">
                    <p className="text-white text-sm font-semibold leading-snug">{step.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/40">{step.body}</p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
