"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionHeading } from "@/components/home/section-heading";

const faqs = [
  {
    q: "Is the platform free to use?",
    a: [
      "Yes! Registration, browsing and chatting with your matches are free. Basic members receive 3 free Match Tokens every month to send Match Requests.",
      "Gold members receive 10 Match Tokens per month, plus exclusive features. Gold members can also purchase 5 additional Match Tokens for £6.99.",
    ],
    link: { href: "/gold", label: "Learn more about how Gold works here →" },
  },
  {
    q: "Who is Pashtun Nikah for?",
    a: [
      "Pashtun Nikah is designed exclusively for Pashtun Muslims seeking marriage. Our platform brings together members who share Pashtun heritage, culture and Islamic values.",
    ],
  },
  {
    q: "How does profile verification work?",
    a: [
      "Every profile is individually reviewed by our team before approval to help maintain a genuine and respectful community.",
      "You can explore the platform while your profile is awaiting approval.",
    ],
  },
  {
    q: "Will my contact or wali details be public?",
    a: [
      "No. Your personal contact details and your wali's information are never displayed publicly.",
      "You decide when to share your wali's contact details with a match, once you feel there is sufficient compatibility.",
    ],
  },
  {
    q: "Are my profile photos public?",
    a: [
      "No. All profile photos are blurred by default.",
      "Once matched, you can choose to share up to 3 photos privately in chat. Your match has a 60-second viewing session, after which the photos become blurred again.",
      "You can share your photos again whenever you choose.",
    ],
  },
  {
    q: "Is wali involvement required?",
    a: [
      "It's optional for females, however we strongly encourage wali involvement throughout the marriage process. Enabling Wali Oversight is also optional.",
    ],
  },
  {
    q: "What is Wali Oversight?",
    a: [
      "Wali Oversight allows your wali to view your conversations with matches through read-only access.",
      "Your wali cannot send messages or participate in the conversation. The feature is optional but strongly encouraged to support a respectful, marriage-focused experience.",
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
                    {"link" in item && item.link ? (
                      <Link href={item.link.href} className="inline-block font-semibold text-brand hover:underline">
                        {item.link.label}
                      </Link>
                    ) : null}
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
