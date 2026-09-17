"use client";

import { useMobileNavStyle } from "@/lib/mobile-nav-preference";

export function MobileNavStyleSettings() {
  const [style, setStyle] = useMobileNavStyle();

  return (
    <section className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-4 lg:hidden">
      <h3 className="font-bold text-ink-950">Mobile navigation</h3>
      <p className="mt-1 text-[12.5px] text-ink-700/65 leading-relaxed">
        Choose how you get around the app on your phone. Desktop always keeps the sidebar.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f3f1f0]">
        <button
          type="button"
          aria-pressed={style === "bottomBar"}
          onClick={() => setStyle("bottomBar")}
          className={`py-2.5 rounded-lg text-[13px] font-semibold transition ${
            style === "bottomBar" ? "bg-white text-ink-950 shadow-sm" : "text-ink-700/60"
          }`}
        >
          Bottom bar
        </button>
        <button
          type="button"
          aria-pressed={style === "menu"}
          onClick={() => setStyle("menu")}
          className={`py-2.5 rounded-lg text-[13px] font-semibold transition ${
            style === "menu" ? "bg-white text-ink-950 shadow-sm" : "text-ink-700/60"
          }`}
        >
          Menu panel
        </button>
      </div>
    </section>
  );
}
