"use client";

import Link from "next/link";
import { useState } from "react";
import {
  SUPPORT_DETAILS_MAX,
  SUPPORT_TOPICS,
  type SupportChannel,
  type SupportTopic,
} from "@/lib/support-shared";

type Ticket = { reference: string; topic: SupportTopic; reason: string; details: string; channel: SupportChannel };

function messageFor(t: Ticket) {
  return `Assalamu alaikum, I'm contacting Pashtun Nikah about support request ${t.reference}.\nIssue: ${t.reason}${
    t.details ? `\nDetails: ${t.details}` : ""
  }\n\nThank you.`;
}

function WhatsAppLogo() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="w-[27px] h-[27px] shrink-0">
      <circle cx="16" cy="16" r="15" fill="#25D366" />
      <path d="M9.3 22.2 10.7 18.4a8.4 8.4 0 1 1 3.1 3.1L9.3 22.2Z" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M13 12.1c-.3-.3-.6-.3-.8 0-.4.4-.7 1.1-.5 1.9.5 1.7 2.8 4 4.7 4.8 1 .4 1.8.1 2.3-.4.3-.3.3-.6 0-.8l-1.4-.8c-.2-.1-.4-.1-.6.1l-.6.6c-1.3-.5-2.2-1.4-2.8-2.7l.6-.6c.1-.2.1-.4 0-.6L13 12.1Z" fill="#fff" />
    </svg>
  );
}

function MailLogo() {
  return (
    <span aria-hidden className="w-[27px] h-[27px] shrink-0 rounded-[7px] bg-gradient-to-br from-[#60ccff] via-[#249efa] to-[#0874ec] flex items-center justify-center">
      <svg viewBox="0 0 26 26" className="w-[23px] h-[23px]">
        <rect x="4" y="6.5" width="18" height="13" rx="2.6" fill="#fff" />
        <path d="M5.1 8.3 13 14.2l7.9-5.9" fill="none" stroke="#218beb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.25" />
      </svg>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 first:mt-4 mb-3 text-[13px] font-bold text-ink-950">{children}</p>;
}

export function SupportForm({
  signedIn,
  supportEmail,
  whatsappNumber,
}: {
  signedIn: boolean;
  supportEmail: string;
  whatsappNumber: string | null;
}) {
  const [topic, setTopic] = useState<SupportTopic>("account");
  const [reason, setReason] = useState<string>(SUPPORT_TOPICS.account.reasons[0]);
  const [details, setDetails] = useState("");
  const [channel, setChannel] = useState<SupportChannel>(whatsappNumber ? "whatsapp" : "email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [copied, setCopied] = useState<"ref" | "msg" | null>(null);

  function handoffUrl(t: Ticket) {
    const msg = messageFor(t);
    if (t.channel === "whatsapp" && whatsappNumber) {
      return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
    }
    return `mailto:${supportEmail}?subject=${encodeURIComponent(`Pashtun Nikah Support - ${t.reference}`)}&body=${encodeURIComponent(msg)}`;
  }

  function pickTopic(next: SupportTopic) {
    setTopic(next);
    setReason(SUPPORT_TOPICS[next].reasons[0]);
    setTicket(null);
    setError(null);
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setTicket(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, reason, details, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reference) throw new Error(data.error || "We could not create your request. Please try again.");
      const t: Ticket = { reference: data.reference, topic, reason, details: details.trim(), channel };
      setTicket(t);
      // Only hand off once the server has saved the reference. Top-level navigation avoids popup blockers.
      window.location.href = handoffUrl(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not create your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "ref" | "msg") {
    if (!ticket) return;
    const text = kind === "ref" ? ticket.reference : messageFor(ticket);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      window.prompt("Copy this", text);
    }
  }

  const topicKeys = Object.keys(SUPPORT_TOPICS) as SupportTopic[];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.85fr)] items-start">
      <div className="bg-white rounded-[20px] border border-[#eceaed] shadow-[0_7px_30px_rgba(17,17,24,0.025)] p-5 sm:p-8">
        <h2 className="text-[19px] font-bold tracking-tight text-ink-950">Contact support</h2>
        <p className="mt-1.5 text-[13px] text-[#7d7c82]">A few details are all we need to get started.</p>

        <SectionTitle>What do you need help with?</SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          {topicKeys.map((key) => {
            const t = SUPPORT_TOPICS[key];
            const selected = key === topic;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => pickTopic(key)}
                className={`min-h-[78px] rounded-[13px] px-3.5 sm:px-4 py-3.5 text-left flex flex-col justify-center gap-1.5 bg-white transition ${
                  selected
                    ? "border-[1.5px] border-brand shadow-[0_0_0_3px_rgba(225,45,114,0.055)]"
                    : "border border-[#e9e8eb] hover:border-[#d8d6da]"
                }`}
              >
                <strong className="text-[13px] font-bold text-ink-950">{t.label}</strong>
                <span className="text-[11px] leading-snug text-[#95929a]">{t.hint}</span>
              </button>
            );
          })}
        </div>

        <SectionTitle>Tell us about your issue</SectionTitle>
        <label htmlFor="support-reason" className="block text-[12px] font-bold mb-2">
          Reason
        </label>
        <select
          id="support-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full min-h-[46px] rounded-xl border border-[#e9e8eb] bg-white px-3.5 text-[14px] outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(225,45,114,0.1)]"
        >
          {SUPPORT_TOPICS[topic].reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <label htmlFor="support-details" className="block text-[12px] font-bold mt-4 mb-2">
          Additional details <span className="font-normal text-[#a09ba1]">(optional)</span>
        </label>
        <textarea
          id="support-details"
          value={details}
          maxLength={SUPPORT_DETAILS_MAX}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Briefly explain what happened, so we can help you."
          className="w-full min-h-[96px] resize-y rounded-xl border border-[#e9e8eb] bg-white px-3.5 py-3 text-[14px] leading-relaxed outline-none placeholder:text-[#a7a5ac] focus:border-brand focus:shadow-[0_0_0_3px_rgba(225,45,114,0.1)]"
        />
        <p className="mt-2 text-[11px] text-[#96929a]">Never include passwords or card details.</p>

        <SectionTitle>Choose a contact method</SectionTitle>
        <div className={`grid gap-2.5 ${whatsappNumber ? "grid-cols-2" : "grid-cols-1"}`}>
          {(whatsappNumber ? (["whatsapp", "email"] as const) : (["email"] as const)).map((c) => {
            const active = c === channel;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setChannel(c)}
                className={`min-h-[60px] rounded-[13px] px-3 sm:px-4 flex items-center justify-between gap-2 bg-white text-[13px] font-bold text-ink-950 transition ${
                  active ? "border-[1.5px] border-[#d9d5da]" : "border border-[#e9e8eb] hover:border-[#bdbbc1]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {c === "whatsapp" ? <WhatsAppLogo /> : <MailLogo />}
                  {c === "whatsapp" ? "WhatsApp" : "Email"}
                </span>
                <span
                  className={`w-[17px] h-[17px] rounded-full shrink-0 ${
                    active ? "border-[5px] border-brand" : "border border-[#c8c5c8]"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] text-[#99959d]">
          {channel === "whatsapp"
            ? "We’ll open WhatsApp with your reference number and message prefilled."
            : "We’ll open your email app with your reference number and message prefilled."}
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-[12px] text-[#b52f52]">
            {error}
          </p>
        ) : null}

        {signedIn ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="mt-6 w-full min-h-[49px] rounded-xl bg-brand text-white text-[14px] font-bold shadow-[0_7px_17px_rgba(225,45,114,0.13)] hover:bg-brand-700 disabled:opacity-70 disabled:cursor-progress transition"
          >
            {busy ? "Creating your reference…" : "Create support request →"}
          </button>
        ) : (
          <Link
            href="/login"
            className="mt-6 flex items-center justify-center w-full min-h-[49px] rounded-xl bg-brand text-white text-[14px] font-bold hover:bg-brand-700 transition"
          >
            Log in to create a request →
          </Link>
        )}

        {ticket ? (
          <div role="status" className="mt-3.5 rounded-[13px] border border-[#e8e8ed] bg-white px-4 py-4 shadow-[0_3px_15px_rgba(20,20,30,0.025)]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-[#e4f7ed] text-[#19895c] font-extrabold flex items-center justify-center">✓</span>
              <div>
                <strong className="block text-[12px]">Your request reference is ready</strong>
                <small className="block text-[11px] text-[#86838a] mt-0.5">
                  {SUPPORT_TOPICS[ticket.topic].label} · {ticket.reason}
                </small>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2">
              <span className="text-[14px] font-extrabold tracking-wide text-ink-950">{ticket.reference}</span>
              <button type="button" onClick={() => void copy("ref")} className="text-[11px] font-bold text-brand underline">
                {copied === "ref" ? "Copied ✓" : "Copy reference"}
              </button>
              <button type="button" onClick={() => void copy("msg")} className="text-[11px] font-bold text-brand underline">
                {copied === "msg" ? "Copied ✓" : "Copy message"}
              </button>
              <a href={handoffUrl(ticket)} className="text-[11px] font-bold text-brand underline">
                Open app again ↗
              </a>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#77737c]">
              If your app did not open, select “Open app again”. Your message includes this reference. You still need to
              press Send.
            </p>
          </div>
        ) : (
          <p className="mt-3.5 rounded-[11px] border border-[#f0eef0] bg-[#fafafa] px-3.5 py-3 text-[11px] leading-relaxed text-[#8b858d]">
            We&apos;ll create your reference, then open your selected app with your message ready to send.
          </p>
        )}
      </div>

      <aside className="grid gap-3.5">
        <div className="bg-white rounded-[20px] border border-[#eceaed] p-6">
          <h3 className="text-[14px] font-extrabold text-ink-950 mb-4">What happens next</h3>
          <ol className="grid gap-5">
            {[
              ["Your request is logged", "We create a reference number for your request."],
              [
                "Your selected app opens",
                `${whatsappNumber ? "WhatsApp or email" : "Your email app"} opens with your reference. Press Send to contact us.`,
              ],
              ["We review your request", "Our team uses your reference to find your case."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="w-[25px] h-[25px] shrink-0 rounded-full bg-[#f6f5f7] border border-[#eae8ec] text-[#666069] text-[11px] font-extrabold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-[12px] font-bold leading-normal">
                  {title}
                  <small className="block mt-0.5 text-[11px] font-normal leading-relaxed text-[#939099]">{body}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-white rounded-[20px] border border-[#eceaed] p-6">
          <h3 className="text-[14px] font-extrabold text-ink-950 mb-3">Can&apos;t access your account?</h3>
          <p className="text-[12px] leading-relaxed text-[#89858d]">
            You can still email{" "}
            <a href={`mailto:${supportEmail}`} className="font-bold text-brand">
              {supportEmail}
            </a>{" "}
            if you can&apos;t sign in. We&apos;ll verify your account securely.
          </p>
        </div>
      </aside>
    </div>
  );
}
