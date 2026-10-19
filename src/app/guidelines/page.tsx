import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community Guidelines & Safety — Pashtun Nikah",
  description:
    "How members of Pashtun Nikah are expected to behave: respect, serious marriage intentions, halal conversations, privacy and safety.",
};

const LAST_UPDATED = "9 October 2026";

type Section = {
  title: string;
  emoji?: string;
  intro?: string[];
  bullets?: string[];
  /** Extra paragraphs and lists after the first list, in order. */
  more?: ({ p: string } | { list: string[] })[];
  closing?: string;
};

const SECTIONS: Section[] = [
  {
    title: "Respect Comes First",
    emoji: "🤝",
    intro: ["Behind every profile is a real person, someone's son or daughter, brother or sister.", "All members must:"],
    bullets: [
      "Communicate politely, honestly and respectfully.",
      "Respect another person's boundaries, beliefs and decisions.",
      "Accept rejection gracefully without pressure or repeated contact.",
      "Avoid insults, harassment, threats, bullying and offensive language.",
      "Never send sexually explicit, inappropriate or intimidating messages.",
    ],
    closing: "Your character matters, even when a conversation doesn't lead to marriage.",
  },
  {
    title: "Serious Marriage Intentions Only",
    emoji: "💍",
    intro: ["Pashtun Nikah is exclusively for adults who are genuinely seeking marriage.", "Members must:"],
    bullets: [
      "Be at least 18 years old.",
      "Have sincere intentions towards marriage (Nikah).",
      "Be honest about their readiness and expectations.",
      "Avoid casual dating, flirting for entertainment or inappropriate relationships.",
      "Never mislead another member about their marital intentions.",
      "Avoid wasting another person's time through dishonest or unserious behaviour.",
    ],
    closing: "If you're not genuinely looking for marriage, Pashtun Nikah is not the right platform for you.",
  },
  {
    title: "Keep Conversations Halal",
    emoji: "☪️",
    intro: ["We expect members to communicate in a manner consistent with Islamic etiquette and modesty."],
    bullets: [
      "Keep conversations respectful, purposeful and focused on marriage compatibility.",
      "Avoid sexual conversations, explicit content and inappropriate flirting.",
      "Do not request intimate photographs, videos or private calls of an inappropriate nature.",
      "Never pressure someone into conversations or behaviour that makes them uncomfortable.",
      "Respect Islamic boundaries while getting to know a potential spouse.",
      "Consider appropriate family or wali involvement as discussions progress.",
    ],
    closing: "The purpose of chatting is to explore marriage compatibility, not to build an inappropriate private relationship.",
  },
  {
    title: "No Sharing Personal Contact Details",
    emoji: "🔒",
    intro: [
      "For member safety, exchanging personal contact information through Pashtun Nikah profiles or chats is strictly prohibited.",
      "You must not request, send or share:",
    ],
    bullets: [
      "Phone numbers, including mobile numbers, WhatsApp numbers or contact numbers.",
      "Social media handles, including Snapchat, Instagram, TikTok, Facebook, Telegram or other accounts.",
      "Email addresses, including personal, work or alternative email accounts.",
      "External contact links, including social media profile links, messaging invitations or contact-sharing links.",
      "Alternative contact information intended to move a conversation away from Pashtun Nikah.",
    ],
    more: [
      { p: "This rule applies even if both members agree." },
      { p: "You must also not attempt to bypass these restrictions by:" },
      {
        list: [
          "Spelling out phone numbers in words.",
          "Splitting numbers or usernames across multiple messages.",
          "Adding spaces, symbols or emojis to disguise contact details.",
          "Asking another member to search for you on a different platform.",
        ],
      },
      { p: "Keep your conversations on the Pashtun Nikah app. Do not ask someone to continue chatting elsewhere." },
    ],
    closing:
      "Where appropriate, contact with a wali or family member should be arranged through Pashtun Nikah's designated family-involvement process, with the relevant member's consent.",
  },
  {
    title: "Be Honest About Who You Are",
    intro: ["Trust begins with an authentic profile.", "You must:"],
    bullets: [
      "Provide accurate information about your age, marital status, background and circumstances.",
      "Be honest about your Pashtun heritage.",
      "Only use photographs that genuinely belong to you.",
      "Never impersonate another person or create misleading profiles.",
      "Never create duplicate accounts to evade restrictions.",
      "Be truthful about important circumstances that could affect a marriage decision.",
    ],
    closing: "A marriage built on dishonesty cannot begin with trust.",
  },
  {
    title: "Respect Privacy and Photographs",
    emoji: "📷",
    intro: ["A member's personal information, messages and photographs must be treated with care."],
    bullets: [
      "Do not share or distribute another member's photographs.",
      "Do not record or publish private conversations without permission.",
      "Do not attempt to bypass photo privacy protections.",
      "Never use another person's information to embarrass, threaten or blackmail them.",
      "Do not disclose private information you learn about another member without their permission.",
    ],
    closing: "Being allowed to view someone's information does not give you permission to share it.",
  },
  {
    title: "Involve Family When You're Ready",
    emoji: "👨‍👩‍👧",
    intro: [
      "Pashtun Nikah encourages appropriate family involvement as conversations progress towards marriage.",
      "We expect members to:",
    ],
    bullets: [
      "Be transparent about marriage intentions.",
      "Respect each other's readiness to involve family.",
      "Use the platform's family-involvement process where appropriate.",
      "Never pressure someone to share their wali's details prematurely.",
      "Avoid prolonging conversations indefinitely without genuine intention to progress.",
    ],
    more: [
      {
        p: "Wali Oversight, when enabled, gives an invited wali read-only access to the relevant chat. It does not allow them to send messages on behalf of the member.",
      },
    ],
    closing: "The goal is a genuine path towards Nikah, with clarity, respect and family involvement.",
  },
  {
    title: "Respect Boundaries and Rejection",
    emoji: "❤️",
    intro: ["Every member has the right to decide who they wish to communicate with."],
    bullets: [
      "An accepted match does not create an obligation to continue talking.",
      "Respect someone's decision to end a conversation.",
      "Never repeatedly contact someone who has declined or blocked you.",
      "Do not pressure anyone to reveal photographs or private information.",
      "Never use guilt, emotional manipulation or threats to influence a marriage decision.",
    ],
    closing: "No one owes you a conversation, an explanation or an acceptance.",
  },
  {
    title: "No Scams, Money Requests or Exploitation",
    emoji: "🚫",
    intro: ["Pashtun Nikah has zero tolerance for fraud, financial exploitation or malicious activity.", "Members must not:"],
    bullets: [
      "Ask other members for money, loans, gifts or financial assistance.",
      "Promote investments, cryptocurrency, businesses or unrelated services.",
      "Attempt to obtain passwords, verification codes or banking information.",
      "Engage in blackmail, extortion or financial manipulation.",
      "Use the platform to advertise, recruit or solicit customers.",
    ],
    closing: "Never send money to someone you've met through the platform.",
  },
  {
    title: "Reporting and Member Safety",
    emoji: "🛡️",
    intro: ["If you encounter inappropriate, suspicious or disrespectful behaviour:"],
    bullets: [
      "Use Report on the member's profile or within the conversation.",
      "Use Block if you no longer want contact.",
      "Contact Pashtun Nikah Support through the app if you require assistance.",
    ],
    more: [
      { p: "Members should report genuine concerns honestly and must not use reporting tools to harass or target others." },
      {
        p: "Pashtun Nikah may review reported activity and relevant conversations for safety and moderation purposes, in accordance with our Privacy Policy.",
      },
    ],
    closing: "If you believe you are in immediate danger, contact your local emergency services.",
  },
  {
    title: "Breaking These Guidelines",
    emoji: "⚖️",
    intro: ["Violations may result in:"],
    bullets: [
      "A warning.",
      "Removal of prohibited or inappropriate messages.",
      "Temporary restrictions on messaging or account features.",
      "Account suspension.",
      "Permanent account removal.",
      "Escalation of serious threats or unlawful conduct to the relevant authorities where appropriate.",
    ],
    more: [
      {
        p: "Sharing prohibited contact details, harassment, sexual misconduct, fraud or repeated disregard for these rules may result in account enforcement action.",
      },
    ],
    closing: "Serious violations may lead to immediate suspension or removal.",
  },
];

function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((b) => (
        <li key={b} className="flex gap-3 text-[15px] leading-relaxed text-ink-900/85">
          <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" aria-hidden />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

/** Public page (no sign-in needed) — linked from the chat guidelines prompt, warnings and the footer. */
export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900">
      <header className="sticky top-0 z-20 bg-[#faf8f7]/90 backdrop-blur border-b border-ink-900/6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.jpeg" alt="" width={28} height={28} className="rounded-md object-cover" />
            <span className="font-semibold text-ink-950">Pashtun Nikah</span>
          </Link>
          <Link href="/chats" className="text-sm font-semibold text-rose-600 hover:text-rose-700">
            Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Pashtun Nikah</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-ink-950 leading-tight">Community Guidelines &amp; Safety</h1>
        <p className="mt-2 text-sm text-ink-700/60">Last updated: {LAST_UPDATED}</p>

        <div className="mt-6 rounded-2xl bg-white border border-rose-100 p-5 sm:p-6 space-y-3 text-[15px] leading-relaxed text-ink-900/85">
          <p>
            Pashtun Nikah is a matrimonial platform built to help Pashtun Muslims find a compatible spouse while upholding
            Islamic values, cultural values, modesty, respect and family involvement.
          </p>
          <p className="font-semibold text-ink-950">This is strictly a Pashtun marriage platform, not a dating app.</p>
          <p>
            Every member is expected to behave with sincerity and respect. By using Pashtun Nikah, you agree to follow these
            guidelines.
          </p>
        </div>

        <nav aria-label="Contents" className="mt-6 rounded-2xl bg-white border border-ink-900/6 p-5 sm:p-6">
          <p className="text-sm font-bold text-ink-950">Contents</p>
          <ol className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[14px]">
            {SECTIONS.map((s, i) => (
              <li key={s.title}>
                <a href={`#${slug(s.title)}`} className="text-ink-700 hover:text-rose-600">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 space-y-4">
          {SECTIONS.map((s, i) => (
            <section
              key={s.title}
              id={slug(s.title)}
              className="scroll-mt-20 rounded-2xl bg-white border border-ink-900/6 p-5 sm:p-6"
            >
              <h2 className="text-lg sm:text-xl font-bold text-ink-950 flex items-start gap-2">
                <span className="text-rose-600 tabular-nums">{i + 1}.</span>
                <span>
                  {s.title}
                  {s.emoji ? <span className="ml-1.5" aria-hidden>{s.emoji}</span> : null}
                </span>
              </h2>
              {s.intro?.map((p) => (
                <p key={p} className="mt-3 text-[15px] leading-relaxed text-ink-900/85">
                  {p}
                </p>
              ))}
              {s.bullets ? <Bullets items={s.bullets} /> : null}
              {s.more?.map((m, j) =>
                "p" in m ? (
                  <p key={j} className="mt-3 text-[15px] leading-relaxed text-ink-900/85">
                    {m.p}
                  </p>
                ) : (
                  <Bullets key={j} items={m.list} />
                )
              )}
              {s.closing ? (
                <p className="mt-4 rounded-xl bg-rose-50/70 border border-rose-100 px-4 py-3 text-[15px] font-medium text-ink-950">
                  {s.closing}
                </p>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl bg-ink-950 text-white p-6 sm:p-8">
          <h2 className="text-xl font-bold">Our Commitment to You</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">
            Pashtun Nikah was created to provide a more respectful, private and purposeful way for Pashtun Muslims to seek
            marriage.
          </p>
          <p className="mt-3 text-[15px] text-white/80">We ask every member to remember:</p>
          <ul className="mt-3 space-y-1.5 text-[15px] font-medium">
            <li>Your intention should be marriage.</li>
            <li>Your conversations should remain halal.</li>
            <li>Your behaviour should reflect respect, honesty and good character.</li>
            <li>And your actions should honour the trust another person places in you.</li>
            <li>Bring in your wali when you feel there is genuine compatibility.</li>
          </ul>
          <p className="mt-5 text-[15px] leading-relaxed text-white/80">
            May Allah guide us towards what is best and grant those sincerely seeking marriage a righteous and compatible
            spouse. Ameen. <span aria-hidden>🤲</span>
          </p>
          <p className="mt-5 text-[15px] text-white/90">
            Manana,
            <br />
            <span className="font-semibold">Pashtun Nikah team</span>
          </p>
        </section>

        <div className="mt-6 rounded-2xl bg-white border border-ink-900/6 p-5 sm:p-6 text-[14px] leading-relaxed text-ink-700">
          <p className="font-semibold text-ink-950">Need help or want to report a concern?</p>
          <p className="mt-1">
            Visit{" "}
            <Link href="/settings" className="text-rose-600 font-semibold hover:underline">
              Settings
            </Link>{" "}
            → Help &amp; Support.
          </p>
          <p className="mt-3 text-ink-700/70">
            These Community Guidelines should be read alongside our Terms &amp; Conditions and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
