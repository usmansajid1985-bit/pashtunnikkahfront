"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useChatSocket } from "@/hooks/use-chat-socket";
import type { FamilyView, WaliDetails } from "@/lib/family-flow";

export type { FamilyView };

const PN_PINK = "#E12D72";

type ActResult = { ok: boolean; error?: string };
export type FamilyAct = (action: string, extra?: Record<string, string>) => Promise<ActResult>;

/**
 * Involve Family state for the open chat. One source for the header icon, the modal, the card
 * above the composer and the in-chat status lines — all kept live over the thread channel.
 */
export function useFamilyFlow(requestId: string | null, enabled: boolean) {
  const [family, setFamily] = useState<FamilyView | null>(null);
  const [busy, setBusy] = useState(false);
  const { on } = useChatSocket(true);

  const load = useCallback(async () => {
    if (!requestId || !enabled) return;
    const res = await fetch(`/api/chats/${requestId}/family`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json().catch(() => null);
    setFamily(data?.family ?? null);
  }, [requestId, enabled]);

  useEffect(() => {
    setFamily(null);
    if (!requestId || !enabled) return;
    void load();
    const off = on("family:update", (e: { requestId?: string }) => {
      if (!e?.requestId || e.requestId === requestId) void load();
    });
    // Prompts become due with time (24h after sharing, a week after "Not now"), not only on events.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void load(), 5 * 60 * 1000);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [requestId, enabled, load, on]);

  const act: FamilyAct = useCallback(
    async (action, extra) => {
      if (!requestId) return { ok: false };
      setBusy(true);
      try {
        const res = await fetch(`/api/chats/${requestId}/family`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.family !== undefined) setFamily(data.family);
        if (!res.ok) return { ok: false, error: data.error || "Something went wrong — please try again." };
        return { ok: true };
      } catch {
        return { ok: false, error: "You appear to be offline — please try again." };
      } finally {
        setBusy(false);
      }
    },
    [requestId]
  );

  return { family, busy, act };
}

/** Two people, outline only — the Involve Family mark. */
export function FamilyIcon({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9.5" cy="7.5" r="4" />
      <path d="M2 20.5a7.5 7.5 0 0 1 15 0" />
      <path d="M16 3.8a4 4 0 0 1 0 7.4" />
      <path d="M19 14.6a7.5 7.5 0 0 1 3 5.9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

const primaryBtn =
  "w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition hover:brightness-95";
const secondaryBtn =
  "w-full py-2.5 rounded-xl border border-ink-900/15 bg-white text-sm font-semibold text-ink-900 disabled:opacity-50 hover:bg-ink-900/[0.03]";

/* ───────────────────────────── wali contact card ───────────────────────────── */

function waDigits(contact: string) {
  return contact.replace(/[^\d]/g, "");
}

/**
 * The wali's details as they appear in the chat and in the Family popup.
 * Actions are WhatsApp · Email · Copy (no Call, by design).
 */
export function WaliContactCard({
  wali,
  contacted,
  onAction,
  className = "",
}: {
  wali: Pick<WaliDetails, "name" | "contact" | "email"> & { relation?: string | null };
  contacted?: boolean;
  /** Called when WhatsApp / Email / Copy is used. */
  onAction?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const actionBtn =
    "flex-1 min-w-0 inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-ink-900/12 bg-white px-2 py-2 text-[11.5px] font-semibold text-ink-800 hover:bg-ink-900/[0.03]";

  return (
    <div className={`rounded-2xl border border-ink-900/10 bg-white px-4 py-3.5 text-left shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: PN_PINK }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10.5" r="2" />
            <path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M15 10h3M15 13.5h3" />
          </svg>
          Wali Contact
        </p>
        {contacted ? (
          <span className="text-[11.5px] font-semibold text-emerald-700">✓ Contacted</span>
        ) : null}
      </div>
      <p className="mt-2 font-bold text-ink-950 break-words">{wali.name}</p>
      {wali.relation ? <p className="text-[13px] text-ink-700/70">{wali.relation}</p> : null}
      {wali.contact ? (
        <p className="mt-1 text-sm font-semibold break-all" style={{ color: PN_PINK }}>
          {wali.contact}
        </p>
      ) : null}
      {wali.email ? <p className="text-[12.5px] text-ink-700/60 break-all">{wali.email}</p> : null}

      {wali.contact ? (
        <div className="mt-3 flex gap-2">
          <a
            href={`https://wa.me/${waDigits(wali.contact)}`}
            target="_blank"
            rel="noreferrer"
            onClick={onAction}
            className={actionBtn}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1L3.5 20.5Z" />
              <path d="M9 9.2c0 3 2.8 5.8 5.8 5.8l1-1.3-1.900-1-.8.7c-.9-.4-1.7-1.2-2.100-2.100l.7-.8-1-1.900L9 9.2Z" />
            </svg>
            WhatsApp
          </a>
          {wali.email ? (
            <a href={`mailto:${wali.email}`} onClick={onAction} className={actionBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={PN_PINK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              Email
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(wali.contact || "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
              onAction?.();
            }}
            className={actionBtn}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
            </svg>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] text-ink-700/60">Contact details are no longer available.</p>
      )}
    </div>
  );
}

/* ───────────────────────────── in-chat status lines ───────────────────────────── */

export type FamilyEvent = { key: string; at: string; kind: "requested" | "declined" | "contacted" };

/** Status lines that sit in the conversation at the moment they happened. */
export function familyEvents(family: FamilyView | null): FamilyEvent[] {
  if (!family) return [];
  const events: FamilyEvent[] = [];
  if (family.role === "male" && family.request.state === "pending" && family.request.requestedAt) {
    events.push({ key: "fam-requested", at: family.request.requestedAt, kind: "requested" });
  }
  if (family.role === "male" && family.request.state === "declined" && family.request.declinedAt && family.request.canRequestAt) {
    events.push({ key: "fam-declined", at: family.request.declinedAt, kind: "declined" });
  }
  if (family.role === "female" && family.contacted && family.contactedAt) {
    events.push({ key: "fam-contacted", at: family.contactedAt, kind: "contacted" });
  }
  return events;
}

export function FamilyStatusLine({ kind, peerCode }: { kind: FamilyEvent["kind"]; peerCode: string }) {
  if (kind === "requested") {
    return (
      <div className="py-2 text-center" role="status">
        <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: PN_PINK }}>
          <ClockIcon />
          Family involvement requested
        </p>
        <p className="text-[11.5px] text-ink-700/55">Waiting for {peerCode}</p>
      </div>
    );
  }
  return (
    <p className="py-2 text-center text-[12px] text-ink-700/60" role="status">
      {kind === "declined"
        ? `${peerCode} isn't ready to involve family yet.`
        : `${peerCode} has confirmed he's contacted your wali.`}
    </p>
  );
}

/* ───────────────────────────── card above the composer ───────────────────────────── */

export function FamilyPromptCard({
  family,
  busy,
  act,
  onShare,
  onInvolve,
}: {
  family: FamilyView;
  busy: boolean;
  act: FamilyAct;
  /** Opens the final "these details will be shared" confirmation. */
  onShare: (via: "manual" | "auto") => void;
  /** Opens the same popup as the Family icon. */
  onInvolve: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const peer = family.peerCode;
  const male = family.role === "male";
  if (!family.card) return null;

  async function run(action: string, extra?: Record<string, string>) {
    setError(null);
    const res = await act(action, extra);
    if (!res.ok && res.error) setError(res.error);
  }

  let title: string;
  let body: string | null = null;
  let primary: { label: string; onClick: () => void };
  let secondary: { label: string; onClick: () => void };

  switch (family.card) {
    case "incoming_request":
      title = `${peer} wants to involve family`;
      body = "He's asked if you're comfortable sharing your wali's contact details.";
      primary = { label: "Share wali details", onClick: () => onShare("manual") };
      secondary = { label: "Not now", onClick: () => void run("decline") };
      break;
    case "auto_first":
      title = male ? "Ready to involve family? ❤️" : "Ready to involve your wali? ❤️";
      body = male
        ? `You've been getting to know ${peer} for a while. If you're ready, you can ask her to involve her wali.`
        : `You've been getting to know ${peer} for a while. You can involve your wali whenever you're ready.`;
      primary = male
        ? { label: "Send request", onClick: () => void run("request", { via: "auto" }) }
        : { label: "Share wali details", onClick: () => onShare("auto") };
      secondary = { label: "Not now", onClick: () => void run("dismiss_auto") };
      break;
    case "auto_final":
      title = `Still getting to know ${peer}? ❤️`;
      body = "If things are progressing, you can involve family whenever you're ready.";
      primary = { label: "Involve family", onClick: onInvolve };
      secondary = { label: "Not now", onClick: () => void run("dismiss_auto") };
      break;
    case "contact_prompt":
    case "contact_followup":
      title =
        family.card === "contact_prompt"
          ? `Have you contacted ${peer}'s wali?`
          : `Have you had a chance to contact ${peer}'s wali?`;
      primary = { label: "Yes, I have", onClick: () => void run("contacted", { answer: "yes" }) };
      secondary = { label: "Not yet", onClick: () => void run("contacted", { answer: "not_yet" }) };
      break;
  }

  return (
    <div className="mb-2 rounded-2xl border border-ink-900/10 bg-white px-3.5 py-3 shadow-[0_6px_20px_-12px_rgba(15,13,14,0.35)] animate-[chatIn_160ms_ease-out]">
      <p className="text-[14px] font-bold text-ink-950">{title}</p>
      {body ? <p className="mt-0.5 text-[12.5px] leading-snug text-ink-700/75">{body}</p> : null}
      {error ? <p className="mt-1 text-[12px] font-semibold text-red-600">{error}</p> : null}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={primary.onClick}
          className="flex-1 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50"
          style={{ background: PN_PINK }}
        >
          {primary.label}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={secondary.onClick}
          className="flex-1 py-2 rounded-xl border border-ink-900/15 text-[13px] font-semibold text-ink-900 disabled:opacity-50"
        >
          {secondary.label}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────── popup ───────────────────────────── */

export type FamilyModalState = { step: "main" | "confirm"; via: "manual" | "auto" } | null;

export function FamilyModal({
  family,
  state,
  busy,
  act,
  onStep,
  onClose,
  onWaliAction,
}: {
  family: FamilyView;
  state: NonNullable<FamilyModalState>;
  busy: boolean;
  act: FamilyAct;
  onStep: (next: NonNullable<FamilyModalState>) => void;
  onClose: () => void;
  onWaliAction: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const peer = family.peerCode;
  const male = family.role === "male";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(action: string) {
    setError(null);
    const res = await act(action, { via: state.via });
    if (res.ok) onClose();
    else setError(res.error || "Something went wrong — please try again.");
  }

  let content: React.ReactNode;

  if (family.shared) {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">
          {male ? `${peer}'s wali` : "Wali details shared"}
        </h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          {male
            ? "She has shared her wali's contact details with you."
            : `Your wali's contact details have been shared with ${peer}.`}
        </p>
        {family.wali ? (
          <WaliContactCard
            wali={family.wali}
            contacted={family.contacted}
            onAction={male ? onWaliAction : undefined}
            className="mt-4"
          />
        ) : null}
        <button type="button" onClick={onClose} className={`${secondaryBtn} mt-4`}>
          Close
        </button>
      </>
    );
  } else if (male && family.request.state === "pending") {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">Family involvement requested</h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          Waiting for {peer}. You&apos;ll be notified when she shares her wali&apos;s contact details.
        </p>
        <button type="button" onClick={onClose} className={`${secondaryBtn} mt-5`}>
          Close
        </button>
      </>
    );
  } else if (male && family.request.canRequestAt) {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">{peer} isn&apos;t ready to involve family yet</h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          You can keep getting to know each other, and ask again from{" "}
          {new Date(family.request.canRequestAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })}.
        </p>
        <button type="button" onClick={onClose} className={`${secondaryBtn} mt-5`}>
          Close
        </button>
      </>
    );
  } else if (male) {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">Ready to involve family?</h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          Ask {peer} if she&apos;s comfortable sharing her wali&apos;s contact details.
        </p>
        {error ? <p className="mt-2 text-[12.5px] font-semibold text-red-600">{error}</p> : null}
        <div className="mt-5 space-y-2">
          <button type="button" disabled={busy} onClick={() => void run("request")} className={primaryBtn} style={{ background: PN_PINK }}>
            {busy ? "Sending…" : "Send request"}
          </button>
          <button type="button" disabled={busy} onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
        </div>
      </>
    );
  } else if (state.step === "main") {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">Ready to involve your wali?</h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          Share your wali&apos;s contact details with {peer} when you&apos;re ready.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => onStep({ step: "confirm", via: state.via })}
            className={primaryBtn}
            style={{ background: PN_PINK }}
          >
            Share wali details
          </button>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
        </div>
      </>
    );
  } else if (!family.wali?.contact) {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">Add your wali&apos;s contact first</h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          Save your wali&apos;s name and phone number on your profile, then come back here to share them
          with {peer}.
        </p>
        <div className="mt-5 space-y-2">
          <Link href="/profile/edit#wali-contact" className={`${primaryBtn} block text-center`} style={{ background: PN_PINK }}>
            Add wali contact
          </Link>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <h3 className="text-[17px] font-bold text-ink-950">Share your wali&apos;s details?</h3>
        <p className="mt-1.5 text-[13px] text-ink-700/70 leading-relaxed">
          These details will be shared with {peer}.
        </p>
        <div className="mt-4 rounded-2xl border border-ink-900/10 bg-[#faf8f7] px-4 py-3 text-left">
          <p className="font-bold text-ink-950 break-words">{family.wali.name}</p>
          {family.wali.relation ? <p className="text-[13px] text-ink-700/70">{family.wali.relation}</p> : null}
          <p className="mt-1.5 text-sm font-semibold break-all" style={{ color: PN_PINK }}>
            {family.wali.contact}
          </p>
          {family.wali.email ? (
            <p className="text-[12.5px] text-ink-700/65 break-all">{family.wali.email}</p>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-[12.5px] font-semibold text-red-600">{error}</p> : null}
        <div className="mt-5 space-y-2">
          <button type="button" disabled={busy} onClick={() => void run("share")} className={primaryBtn} style={{ background: PN_PINK }}>
            {busy ? "Sharing…" : "Share details"}
          </button>
          <button type="button" disabled={busy} onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
        </div>
      </>
    );
  }

  // Rendered on <body>: the chat panes sit on a transformed track, which would otherwise become
  // the containing block and push a "fixed" popup off-centre.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Involve family"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 pt-6 text-center shadow-xl animate-[chatIn_160ms_ease-out]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center rounded-full text-ink-700/50 hover:bg-ink-900/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <span
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "#fde8f0", color: PN_PINK }}
        >
          <FamilyIcon size={22} />
        </span>
        {content}
      </div>
    </div>,
    document.body
  );
}
