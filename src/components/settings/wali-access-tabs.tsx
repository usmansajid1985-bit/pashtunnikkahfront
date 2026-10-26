"use client";

import { useEffect, useState } from "react";
import { GuardianContactManager } from "@/components/profile/guardian-contact-manager";
import { WaliAccessManager } from "@/components/profile/wali-access-manager";

type WaliTab = "contact" | "oversight";

/** Settings → Wali access: "Wali contact card" and "Wali oversight" as two top tabs. */
export function WaliAccessTabs() {
  const [tab, setTab] = useState<WaliTab>("contact");

  // Old links (#wali, #wali-oversight) open the oversight tab; #wali-contact the card.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "wali" || hash === "wali-oversight") setTab("oversight");
  }, []);

  function pick(next: WaliTab) {
    setTab(next);
    window.history.replaceState(null, "", next === "contact" ? "#wali-contact" : "#wali-oversight");
  }

  return (
    <div>
      <div role="tablist" className="flex gap-6 border-b border-ink-900/8">
        {(
          [
            { id: "contact", label: "Wali contact card", icon: <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /> },
            {
              id: "oversight",
              label: "Wali oversight",
              icon: (
                <>
                  <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </>
              ),
            },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => pick(t.id)}
              className={`relative -mb-px flex items-center gap-2 pb-3 text-[14px] transition ${
                selected ? "font-semibold text-[#e12d72]" : "font-medium text-ink-700/60 hover:text-ink-900"
              }`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                {t.icon}
              </svg>
              {t.label}
              {selected ? <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-[#e12d72]" /> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-5">{tab === "contact" ? <GuardianContactManager /> : <WaliAccessManager />}</div>
    </div>
  );
}
