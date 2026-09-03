const items = [
  "10,000+ Active Members",
  "100% Verified Profiles",
  "2,400+ Successful Matches",
  "Shariah Compliant",
  "Free to Register",
];

function Row() {
  return (
    <div className="flex items-center gap-3 pr-10 shrink-0">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-3">
          <span>{item}</span>
          {i < items.length - 1 && <span className="w-1 h-1 rounded-full bg-rose-600" />}
        </span>
      ))}
      <span className="w-1 h-1 rounded-full bg-rose-600" />
    </div>
  );
}

export function TrustMarquee() {
  return (
    <section className="bg-white border-y border-ink-900/5 py-5 overflow-hidden">
      <div className="marquee-track text-ink-900/40 text-sm font-medium">
        <Row />
        <Row />
      </div>
    </section>
  );
}
