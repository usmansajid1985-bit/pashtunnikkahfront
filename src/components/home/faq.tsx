"use client";

import { useState } from "react";
import { SectionHeading } from "@/components/home/section-heading";

const faqs = [
  {
    q: "Is the platform free to use?",
    a: [
      "Yes! Registration, browsing and chatting with your matches are free. Basic members receive 3 free Match Tokens every month to send Match Requests.",
      "For more opportunities, Gold offers 10 Match Tokens per month and additional premium features. Gold members can also purchase 5 extra Match Tokens for £6.99.",
    ],
  },
  {
    q: "Who is Pashtun Nikah for?",
    a: [
      "Pashtun Nikah is for Pashtun Muslims who are genuinely seeking marriage in a respectful, safe and Islamic environment.",
    ],
  },
  {
    q: "How does profile verification work?",
    a: [
      "After you verify your email, every profile is individually reviewed by our team before it is approved and becomes visible to other members.",
    ],
  },
  {
    q: "Will my contact or wali details be public?",
    a: ["No. Contact and wali details are never shown publicly on your profile."],
  },
  {
    q: "Are my profile photos public?",
    a: [
      "No. Your photos stay blurred while members browse. Once you match, you choose up to 3 photos to share in chat, and each one can be viewed for up to 60 seconds before it blurs again.",
    ],
  },
  {
    q: "Can someone screenshot my photos?",
    a: [
      "Photos are only ever shown unblurred during a 60-second viewing session that you start by sharing them with a match. No app can fully stop a screenshot on every device, so only share photos with matches you trust.",
    ],
  },
  {
    q: "Is wali involvement required?",
    a: [
      "It isn't mandatory, but we strongly encourage wali (guardian) involvement throughout the marriage process.",
    ],
  },
  {
    q: "What is Wali Oversight?",
    a: [
      "Wali Oversight lets you give your wali read-only access to your chats, so they can stay informed and support you throughout.",
    ],
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white scroll-mt-20 py-20 sm:py-28">
      <SectionHeading
        title={
          <>
            Questions, <span className="text-brand">answered.</span>
          </>
        }
        subtitle="Everything you need to know about Pashtun Nikah"
      />

      <div className="reveal max-w-[680px] mx-auto px-5 sm:px-8 mt-10 sm:mt-14">
        <div className="divide-y divide-ink-900/8">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`faq-item ${isOpen ? "open" : ""}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 text-left py-6"
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="text-[17px] sm:text-[19px] font-semibold text-ink-950">{item.q}</span>
                  <span className="shrink-0 text-brand text-2xl leading-none w-5 text-center">
                    {isOpen ? "–" : "+"}
                  </span>
                </button>
                <div className="faq-a">
                  <div className="pb-6 space-y-4 text-[15px] text-[#80838b] leading-relaxed">
                    {item.a.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
