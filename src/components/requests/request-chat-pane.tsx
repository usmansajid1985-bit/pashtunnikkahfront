"use client";

import Link from "next/link";
import { useState } from "react";
import { relativeStamp, type HubCard } from "@/lib/requests-hub-shared";
import { useRequestActions, type RequestAction } from "@/components/matches/request-actions";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";
import { WithdrawDialog } from "@/components/requests/withdraw-dialog";
import {
  BlockIcon,
  FlagIcon,
  KebabMenu,
  LocalTime,
  NameAge,
  RequestPhoto,
  StatusPill,
} from "@/components/requests/request-cards";

export type RequestSub = "received" | "sent";

/** One row in Chats → Requests: blurred photo, ID + age, the intro preview and when it came in. */
export function RequestListRow({
  card,
  active,
  sent = false,
  onOpen,
}: {
  card: HubCard;
  active: boolean;
  /** Chats → Requests → Sent: your intro (or "You sent a match request") and a Pending pill. */
  sent?: boolean;
  onOpen: () => void;
}) {
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
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-[13px] truncate text-ink-700/65">
            {card.introMessage || (sent ? "You sent a match request" : "Sent you a match request")}
          </span>
          {sent ? <StatusPill status={card.status || "pending"} /> : null}
        </span>
      </span>
    </button>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e12d72" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * The open request in Chats, laid out like a conversation: the member's photo, ID and activity in
 * the header (⋮ Report / Block), "Request sent today at 15:57", the introduction message as a chat
 * bubble, and Decline / Accept (received) or Pending + Withdraw (sent). Read-only until accepted —
 * no composer, photo sharing or wali controls.
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
  const { act, block, pending, error } = useRequestActions(card.requestId!, { onDone });
  const received = sub === "received";
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const sentAt = card.requestedAt || card.createdAt;

  return (
    <>
      <ReportDialog
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onDone={(ok, alsoBlock) => {
          setReportTarget(null);
          if (ok && alsoBlock) block(card.peerUserId);
        }}
      />
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/6">
        <div className="px-3 sm:px-4 h-16 flex items-center gap-2.5">
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
          <RequestPhoto card={card} className="w-10 h-10 !rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-ink-950 truncate">{card.code}</p>
            {card.activity ? (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-700/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                {card.activity}
              </p>
            ) : null}
          </div>
          <Link
            href={`/p/${card.code}`}
            className="shrink-0 px-3.5 py-1.5 rounded-full border border-ink-900/12 text-[13px] font-semibold hover:bg-ink-900/[0.03]"
          >
            View profile
          </Link>
          <KebabMenu
            label={`More options for ${card.code}`}
            items={[
              {
                label: "Report member",
                icon: FlagIcon,
                onClick: () => setReportTarget({ userId: card.peerUserId, code: card.code, requestId: card.requestId }),
              },
              { label: "Block member", icon: BlockIcon, onClick: () => setConfirmBlock(true), danger: true },
            ]}
          />
        </div>
        {confirmBlock ? (
          <div className="px-4 pb-3 flex flex-wrap items-center justify-end gap-2 text-[13px]">
            <span className="text-ink-700/70 mr-auto">Block {card.code}? They won&apos;t be able to contact you.</span>
            <button type="button" onClick={() => setConfirmBlock(false)} className="px-3 py-1.5 rounded-full font-semibold text-ink-700/70 hover:bg-ink-900/5">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => block(card.peerUserId)}
              className="px-3.5 py-1.5 rounded-full bg-[#e12d72] text-white font-semibold disabled:opacity-50"
            >
              Block
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-[#faf8f7] px-4 py-6">
        <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-ink-700/65">
          <ClockIcon />
          <span>
            {received ? "Request received" : "Request sent"} {relativeStamp(sentAt)}
          </span>
        </p>

        <div className="mx-auto max-w-2xl mt-5">
          {card.introMessage ? (
            <div className={`flex ${received ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-[18px] px-3.5 pt-2.5 pb-1.5 text-[14.5px] leading-snug shadow-sm whitespace-pre-wrap break-words ${
                  received ? "bg-[#f1eeef] text-ink-950 rounded-bl-md" : "bg-[#2a2427] text-white rounded-br-md"
                }`}
              >
                {card.introMessage}
                <span className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${received ? "text-ink-700/50" : "text-white/60"}`}>
                  {timeOnly(sentAt)}
                  {received ? null : (
                    // The introduction is delivered with the request; there is no read receipt for it yet.
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-label="Sent">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-[13px] text-ink-700/55">
              {received ? `${card.code} sent you a match request without an introduction message.` : "You sent a match request."}
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
              onClick={() => setConfirmWithdraw(true)}
              className="w-full max-w-md h-12 rounded-full border border-ink-900/12 bg-white text-ink-900 text-[15px] font-semibold hover:bg-ink-900/[0.03] disabled:opacity-50"
            >
              Withdraw request
            </button>
          </div>
        )}
        {error ? <p className="mt-2 text-center text-xs text-rose-700">{error}</p> : null}
      </div>

      <WithdrawDialog
        open={confirmWithdraw}
        code={card.code}
        busy={pending}
        onKeep={() => setConfirmWithdraw(false)}
        onWithdraw={() => {
          setConfirmWithdraw(false);
          act("withdraw");
        }}
      />
    </>
  );
}
