"use client";

import { useRouter } from "next/navigation";
import { openGoldUpsell } from "@/components/billing/gold-upsell";
import React, { FormEvent, useState, useTransition } from "react";
import type { MatchRelationStatus } from "@/lib/matches";
import { INTRO_MAX_CHARS, INTRO_MAX_WORDS, countWords } from "@/lib/intro-message";


export function MatchActions({
  profileCode,
  initial,
  layout = "fixed",
  blockedReason = null,
  trailing,
}: {
  profileCode: string;
  initial: MatchRelationStatus;
  /** "bar": the profile's own fixed bottom bar on phones (replaces the tab bar). */
  layout?: "fixed" | "inline" | "bar";
  /** Shown to the right of the buttons — the profile's Bookmark. */
  trailing?: React.ReactNode;
  /** Set when this member can't send/accept requests yet — buttons are disabled with this note. */
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showSendModal, setShowSendModal] = useState(false);
  const [introMessage, setIntroMessage] = useState("");

  async function sendRequest(intro?: string | null, rematch = false) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileCode,
          rematch: rematch || status.state === "ended",
          ...(intro ? { introMessage: intro } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "out_of_tokens") {
          setShowSendModal(false);
          openGoldUpsell("out_of_tokens");
          return;
        }
        setError(data.error || "Could not send request");
        return;
      }
      setShowSendModal(false);
      setIntroMessage("");
      if (data.status === "accepted") {
        setStatus({ state: "accepted", requestId: data.requestId });
        router.push(`/chats/${data.requestId}`);
        return;
      }
      setStatus({ state: "pending_sent", requestId: data.requestId });
      router.refresh();
    });
  }

  async function respond(action: "accept" | "decline") {
    if (status.state !== "pending_received") return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/matches/${status.requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update request");
        if (data.code === "stale_request") router.refresh();
        return;
      }
      if (action === "accept") {
        setStatus({ state: "accepted", requestId: data.requestId });
        router.push(`/chats/${data.requestId}`);
        return;
      }
      setStatus({ state: "declined", requestId: data.requestId });
      router.refresh();
    });
  }

  function onSendSubmit(e: FormEvent) {
    e.preventDefault();
    void sendRequest(introMessage.trim() || null, status.state === "ended");
  }

  const btn =
    "flex-1 inline-flex items-center justify-center gap-2 h-[52px] rounded-full font-semibold text-[15px] disabled:opacity-60 transition";
  const arrow = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );

  const actions = (
    <>
      <div className="flex gap-2 w-full items-center">
        {status.state === "none" ||
        status.state === "declined" ||
        status.state === "expired" ||
        status.state === "cancelled" ? (
          <button
            type="button"
            disabled={pending || Boolean(blockedReason)}
            onClick={() => setShowSendModal(true)}
            className={`${btn} bg-brand text-white hover:bg-brand-700 shadow-[0_12px_28px_-12px_rgba(225,45,114,0.55)] disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:bg-brand disabled:shadow-none`}
          >
            {pending ? "Sending…" : (
              <>
                Request match {arrow}
              </>
            )}
          </button>
        ) : null}

        {status.state === "pending_sent" ? (
          <button type="button" disabled className={`${btn} bg-ink-900/8 text-ink-700`}>
            Request sent — waiting
          </button>
        ) : null}

        {status.state === "pending_received" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("decline")}
              className={`${btn} border border-ink-900/12 text-ink-950 hover:border-rose-300`}
            >
              Decline
            </button>
            <button
              type="button"
              disabled={pending || Boolean(blockedReason)}
              onClick={() => respond("accept")}
              className={`${btn} bg-brand text-white hover:bg-brand-700`}
            >
              {pending ? "…" : "Accept & chat"}
            </button>
          </>
        ) : null}

        {status.state === "accepted" ? (
          <a
            href={`/chats/${status.requestId}`}
            className={`${btn} bg-brand text-white hover:bg-brand-700`}
          >
            Matched – go to chat
          </a>
        ) : null}

        {status.state === "ended" ? (
          <>
            <a
              href={`/chats/${status.requestId}`}
              className={`${btn} border border-ink-900/12 text-ink-950 hover:border-rose-300`}
            >
              View past chat
            </a>
            <button
              type="button"
              disabled={pending || Boolean(blockedReason)}
              onClick={() => setShowSendModal(true)}
              className={`${btn} bg-brand text-white hover:bg-brand-700 shadow-[0_12px_28px_-12px_rgba(225,45,114,0.55)] disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:bg-brand disabled:shadow-none`}
            >
              {pending ? "Sending…" : "Request Rematch"}
            </button>
          </>
        ) : null}
        {trailing}
      </div>
      {blockedReason &&
      ["none", "declined", "expired", "cancelled", "ended", "pending_received"].includes(status.state) ? (
        <p className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900">
          {blockedReason}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      {showSendModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onSendSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3"
          >
            <h3 className="text-lg font-bold text-ink-950">
              {status.state === "ended" ? "Request Rematch" : "Request Match"}
            </h3>
            <p className="text-sm text-ink-700/70">
              Uses 1 Match Token. Optional short introduction (up to {INTRO_MAX_WORDS} words).
            </p>
            <textarea
              value={introMessage}
              onChange={(e) => {
                const next = e.target.value.slice(0, INTRO_MAX_CHARS);
                // Stop at 30 words, but still let them delete or edit inside the limit.
                if (countWords(next) <= INTRO_MAX_WORDS || next.length < introMessage.length) setIntroMessage(next);
              }}
              rows={3}
              placeholder="Assalamu alaikum"
              className="w-full resize-none rounded-xl border border-ink-900/10 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-rose-300"
            />
            <p className="text-[11px] text-ink-700/45 text-right">
              {countWords(introMessage)}/{INTRO_MAX_WORDS} words
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 py-2.5 rounded-full bg-brand text-white text-sm font-semibold disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send request"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setShowSendModal(false);
                  setIntroMessage("");
                }}
                className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );

  if (layout === "inline") return <div className="w-full">{actions}</div>;

  if (layout === "bar") {
    return (
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-ink-900/[0.06] pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto px-4">{actions}</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[var(--pn-bottom-nav-h)] inset-x-0 z-30 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 lg:static lg:bg-none lg:pt-4 lg:pb-0">
      <div className="max-w-lg lg:max-w-none mx-auto px-4 lg:px-0">{actions}</div>
    </div>
  );
}
