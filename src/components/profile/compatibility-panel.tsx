import type { CompatBreakdown, CompatItem } from "@/lib/compat-engine";

export type ViewerCompat = {
  breakdown: CompatBreakdown;
  /** Optional AI-written note, built only from the breakdown below. */
  summary: string | null;
};

const SECTIONS: {
  key: keyof CompatBreakdown;
  title: string;
  icon: string;
  tone: string;
  empty: string;
}[] = [
  { key: "aligned", title: "Aligned", icon: "✓", tone: "text-emerald-700 bg-emerald-50 border-emerald-100", empty: "Nothing clearly aligned yet from what you've both shared." },
  { key: "discuss", title: "Worth discussing", icon: "💬", tone: "text-amber-800 bg-amber-50 border-amber-100", empty: "No differences found in what you've both shared." },
  { key: "unknown", title: "Not enough information", icon: "?", tone: "text-ink-700 bg-ink-900/[0.03] border-ink-900/8", empty: "" },
];

function ItemRow({ item }: { item: CompatItem }) {
  return (
    <li className="text-sm leading-relaxed text-ink-800">
      <span className="font-semibold text-ink-950">{item.topic}: </span>
      {item.text}
    </li>
  );
}

/**
 * B27: AI Compatibility for Gold members — a written breakdown into Aligned / Worth discussing /
 * Not enough information, from both members' real profile and preference data. No percentages.
 */
export function CompatibilityPanel({ compat, compact = false }: { compat: ViewerCompat; compact?: boolean }) {
  return (
    <section className={`rounded-2xl border border-rose-100 bg-rose-50/30 ${compact ? "p-4" : "p-6"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-rose-600">AI Compatibility</p>
      {compat.summary ? (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-900">{compat.summary}</p>
      ) : null}

      <div className="mt-4 space-y-3">
        {SECTIONS.map((s) => {
          const items = compat.breakdown[s.key];
          if (items.length === 0 && !s.empty) return null;
          return (
            <div key={s.key} className={`rounded-xl border px-3.5 py-3 ${s.tone}`}>
              <p className="text-[13px] font-bold flex items-center gap-1.5">
                <span aria-hidden>{s.icon}</span> {s.title}
                {items.length ? <span className="font-semibold opacity-60">· {items.length}</span> : null}
              </p>
              {items.length ? (
                <ul className="mt-2 space-y-1.5">
                  {items.map((item) => (
                    <ItemRow key={item.topic} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm text-ink-700/70">{s.empty}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11.5px] leading-snug text-ink-700/55">
        Based only on what you&apos;ve both shared on Pashtun Nikah, checked both ways. It isn&apos;t a judgement
        of anyone&apos;s character — take time to get to know each other and involve your families.
      </p>
    </section>
  );
}
