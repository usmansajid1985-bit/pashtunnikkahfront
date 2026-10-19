"use client";

import Link from "next/link";
import type { HubCard } from "@/lib/requests-hub-shared";
import { useRequestActions, type RequestAction } from "@/components/matches/request-actions";
import { LocalTime, NameAge, PlaceLine, RequestPhoto, StatusPill, TimeLine } from "@/components/requests/request-cards";

export type RequestSub = "received" | "sent";

/** One row in Chats → Requests: blurred photo, ID + age, the intro preview and when it came in. */
export function RequestListRow({ card, active, onOpen }: { card: HubCard; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-ink-900/5 transition ${
        active ? "bg-rose-50/70" : "hover:bg-ink-900/[0.03]"
      }`}
    >
      <RequestPhoto card={card} className="w-12 h-12 !rounded-full" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <NameAge card={card} className="text-[15px] font-semibold" />
          <span className="text-[11px] text-ink-700/50 shrink-0">
            <LocalTime iso={card.requestedAt || card.createdAt} prefix="" />
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] truncate text-ink-700/65">
          {card.introMessage || "Sent you a Match Request"}
        </span>
      </span>
    </button>
  );
}

/**
 * The open request in Chats: who it's from, the full introduction message as a chat bubble, and
 * clear Decline / Accept (received) or Withdraw (sent). Accepting opens the new conversation.
 */
export function RequestChatPane({
  card,
  sub,
  onBack,
  onDone,
}: {
  card: HubCard;
  sub: RequestSub;
  onBack: () => void;
  onDone: (action: RequestAction | "block") => void;
}) {
  const { act, pending, error } = useRequestActions(card.requestId!, { onDone });
  const received = sub === "received";

  return (
    <>
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/6">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-2">
          <button
            type="button"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5"
            onClick={onBack}
            aria-label="Back to requests"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <RequestPhoto card={card} className="w-9 h-9 !rounded-full" />
          <div className="min-w-0 flex-1">
            <NameAge card={card} className="text-[15px]" />
            <p className="text-[11px] text-ink-700/55 truncate">{received ? "Match request" : "Your match request"}</p>
          </div>
          <Link
            href={`/p/${card.code}`}
            className="shrink-0 px-3 py-1.5 rounded-full border border-ink-900/12 text-[13px] font-semibold hover:bg-ink-900/[0.03]"
          >
            View profile
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-[#faf8f7] px-4 py-6">
        <Link
          href={`/p/${card.code}`}
          className="mx-auto max-w-md flex flex-col items-center text-center rounded-2xl bg-white border border-ink-900/6 px-5 py-5 hover:border-ink-900/12 transition"
        >
          <RequestPhoto card={card} className="w-24 h-24" />
          <NameAge card={card} className="mt-3 text-lg" />
          <div className="flex flex-col items-center">
            <PlaceLine card={card} />
            <TimeLine>
              <LocalTime iso={card.requestedAt || card.createdAt} prefix={received ? "Received" : "Sent"} />
            </TimeLine>
          </div>
        </Link>

        <div className="mx-auto max-w-2xl mt-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-700/45 mb-3">
            {received ? `${card.code}'s introduction message` : "Your introduction message"}
          </p>
          {card.introMessage ? (
            <div className={`flex ${received ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-snug shadow-sm whitespace-pre-wrap break-words ${
                  received ? "bg-[#f1eeef] text-ink-950 rounded-bl-md" : "bg-[#2a2427] text-white rounded-br-md"
                }`}
              >
                {card.introMessage}
              </div>
            </div>
          ) : (
            <p className="text-center text-[13px] text-ink-700/55">
              {received ? `${card.code} didn't include an introduction message.` : "You didn't include an introduction message."}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-ink-900/6 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {received ? (
          <>
            <p className="text-center text-[13px] text-ink-700/65 mb-3">
              Accept to start chatting with {card.code}.
            </p>
            <div className="flex gap-3 max-w-md mx-auto">
              <button
                type="button"
                disabled={pending}
                onClick={() => act("decline")}
                className="flex-1 h-12 rounded-full border border-rose-400 bg-white text-rose-600 text-[15px] font-semibold hover:bg-rose-50 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => act("accept")}
                className="flex-1 h-12 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[15px] font-semibold hover:bg-emerald-100 disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="flex items-center gap-2 text-[13px] text-ink-700/65">
              <StatusPill status="pending" /> Waiting for {card.code} to respond.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => act("withdraw")}
              className="w-full max-w-md h-12 rounded-full border border-ink-900/12 bg-white text-ink-900 text-[15px] font-semibold hover:bg-ink-900/[0.03] disabled:opacity-50"
            >
              Withdraw request
            </button>
          </div>
        )}
        {error ? <p className="mt-2 text-center text-xs text-rose-700">{error}</p> : null}
      </div>
    </>
  );
}
