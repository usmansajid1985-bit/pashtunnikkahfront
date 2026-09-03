"use client";

import { useState } from "react";

const faqs = [
  {
    q: "Who is Pashtun Nikah for?",
    a: "Pashtun Nikah is exclusively for individuals of Pashtun ethnicity who are genuinely seeking marriage in a respectful, safe and Islamic environment.",
  },
  {
    q: "Is the platform free to use?",
    a: "Creating an account and browsing profiles is free. Gold (£9.99/month) unlocks unlimited requests, messaging, wali contact details and advanced filters.",
  },
  {
    q: "How does verification work?",
    a: "Every profile is manually reviewed by our human moderators before becoming visible, to keep the community genuine and safe.",
  },
  {
    q: "Will my contact details be public?",
    a: "No. Contact info is never displayed publicly. Wali details are only shared with confirmed matches.",
  },
  {
    q: "Are profile photos public?",
    a: "No. Photos are blurred by default and only become visible once you and another member mutually match.",
  },
  {
    q: "Is family involvement required?",
    a: "Not mandatory, but strongly encouraged throughout — the platform supports, not bypasses, family involvement.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="max-w-3xl mx-auto px-5 sm:px-8 py-24 sm:py-32">
      <div className="reveal text-center">
        <span className="text-rose-600 text-xs font-semibold uppercase tracking-widest">FAQ</span>
        <h2 className="font-serif mt-3 text-4xl sm:text-5xl font-medium text-ink-950 tracking-tight">
          Questions, answered
        </h2>
      </div>

      <div className="reveal mt-12 divide-y divide-ink-900/8 border-t border-b border-ink-900/8">
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className={`faq-item ${isOpen ? "open" : ""}`}>
              <button
                type="button"
                className="w-full flex items-center justify-between text-left py-5"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="font-medium text-ink-950">{item.q}</span>
                <span className="faq-plus text-rose-600 text-xl leading-none shrink-0">+</span>
              </button>
              <div className="faq-a">
                <p className="pb-5 text-sm text-ink-700 leading-relaxed max-w-xl">{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
