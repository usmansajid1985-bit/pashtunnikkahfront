"use client";

import { createPortal } from "react-dom";
import { ActivityDot } from "@/components/activity-dot";
import { useEffect, useRef, useState } from "react";
import { expiryCountdown, type HubCard } from "@/lib/requests-hub-shared";
import type { ProfileView } from "@/lib/profile";
import { ProfileDesktop } from "@/components/profile/profile-desktop";
import { useRequestActions, type RequestAction } from "@/components/matches/request-actions";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";
import { WithdrawDialog } from "@/components/requests/withdraw-dialog";
import {
  BlockIcon,
  FlagIcon,
  KebabMenu,
  LocalTime,
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
          <span className="truncate text-[15px] font-semibold text-ink-950">{card.code}</span>
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

const PANE_TRANSITION = "transform 260ms cubic-bezier(0.22, 0.8, 0.3, 1)";

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Centred "Expires in 6 days" pill with a pink clock — counts down without a refresh. */
function ExpiryBanner({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setLabel(expiryCountdown(expiresAt).label);
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!label) return null;
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/[0.05] px-3.5 py-1.5 text-[13px] text-ink-900">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e12d72" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        {label}
      </span>
    </div>
  );
}

function FamilyGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M16 14.2c2.6.2 4.5 2 4.5 4.8" />
    </svg>
  );
}

/** "Decline this request?" bottom sheet over a blurred, dimmed backdrop (Tweaks p91). */
function DeclineSheet({ open, busy, onCancel, onDecline }: { open: boolean; busy: boolean; onCancel: () => void; onDecline: () => void }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/35 backdrop-blur-sm sm:items-center sm:p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-label="Decline this request?"
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-[pnSheetUp_240ms_ease-out] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink-900/15 sm:hidden" />
        <div className="flex justify-end">
          <button type="button" onClick={onCancel} aria-label="Close" className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-700/60 hover:bg-ink-900/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <h3 className="text-center text-[19px] font-bold text-ink-950">Decline this request?</h3>
        <p className="mx-auto mt-2 max-w-xs text-center text-[14px] leading-relaxed text-ink-700/70">
          This will decline the match request and remove it from your Received list.
        </p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-full bg-ink-900/[0.07] text-[15px] font-semibold text-ink-950 hover:bg-ink-900/10">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="h-12 flex-1 rounded-full bg-[#e5383b] text-[15px] font-semibold text-white hover:bg-[#d02f32] disabled:opacity-60"
          >
            {busy ? "Declining…" : "Decline"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * The open request in Chats, laid out exactly like a conversation (Tweaks p87–91): header with the
 * member's blurred photo, ID and activity, greyed-out Involve family + camera (enabled once
 * accepted), Chat / Profile tabs with the same swipe, a live "Expires in X days" pill, the
 * introduction as a left-hand bubble with its time, and Decline / Accept. Accepting switches
 * straight into the live chat in place; declining asks first in a bottom sheet.
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
  const { act, block, pending, error } = useRequestActions(card.requestId!, { onDone, inPlace: true });
  const received = sub === "received";
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  /** Accepted — the chat is loading in place; keep both buttons locked until it takes over. */
  const [accepting, setAccepting] = useState(false);
  useEffect(() => {
    if (error) setAccepting(false);
  }, [error]);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [tab, setTab] = useState<"chat" | "profile">("chat");
  const [profile, setProfile] = useState<ProfileView | null | undefined>(undefined);
  const sentAt = card.requestedAt || card.createdAt;
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const swipe = useRef<{ x: number; y: number; t: number; lock: "h" | "v" | null } | null>(null);

  // Profile tab loads on first visit.
  useEffect(() => {
    if (tab !== "profile" || profile !== undefined) return;
    let cancelled = false;
    fetch(`/api/matches/${card.requestId}/profile`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setProfile(d?.profile ?? null))
      .catch(() => !cancelled && setProfile(null));
    return () => {
      cancelled = true;
    };
  }, [tab, profile, card.requestId]);

  function paneWidth() {
    return (trackRef.current?.parentElement?.clientWidth ?? window.innerWidth) || 1;
  }
  function onTouchStart(e: React.TouchEvent) {
    if (window.innerWidth >= 1024) return;
    if ((e.target as HTMLElement).closest("button, a, [data-no-pane-swipe]")) return;
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, t: performance.now(), lock: null };
  }
  function onTouchMove(e: React.TouchEvent) {
    const s = swipe.current;
    const track = trackRef.current;
    if (!s || !track) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      s.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? "h" : "v";
    }
    if (s.lock !== "h") return;
    const w = paneWidth();
    const base = tabRef.current === "profile" ? -w : 0;
    track.style.transition = "none";
    track.style.transform = `translateX(${Math.min(0, Math.max(-w, base + dx))}px)`;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = swipe.current;
    swipe.current = null;
    const track = trackRef.current;
    if (!s || !track || s.lock !== "h") return;
    const dx = e.changedTouches[0].clientX - s.x;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - s.t);
    const passed = Math.abs(dx) > paneWidth() / 3 || (velocity > 0.5 && Math.abs(dx) > 40);
    let next = tabRef.current;
    if (passed && dx < 0 && next === "chat") next = "profile";
    else if (passed && dx > 0 && next === "profile") next = "chat";
    track.style.transition = PANE_TRANSITION;
    track.style.transform = next === "profile" ? "translateX(-50%)" : "translateX(0)";
    if (next !== tabRef.current) setTab(next);
  }

  const disabledHint = received ? "Available once you accept" : "Available once they accept";

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
      {/* Header — identical layout to an active chat. */}
      <div className="sticky top-0 z-20 border-b border-ink-900/6 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-1.5 px-2.5 sm:gap-2 sm:px-4">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-ink-900/5 sm:h-10 sm:w-10 lg:hidden"
            onClick={onBack}
            aria-label="Back to requests"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <RequestPhoto card={card} className="h-9 w-9 !rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-950">{card.code}</p>
            {card.activity ? (
              <p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-ink-700/55">
                <ActivityDot label={card.activity} />
                {card.activity}
              </p>
            ) : null}
          </div>
          {/* Greyed out until accepted (then the live chat header takes over with them enabled). */}
          <span
            title={disabledHint}
            aria-disabled
            className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center gap-1 rounded-full bg-ink-900/[0.04] text-ink-700/40 min-[400px]:w-auto min-[400px]:px-2.5"
          >
            <FamilyGlyph />
            <span className="hidden whitespace-nowrap text-[12px] font-semibold min-[400px]:inline sm:hidden">Family</span>
            <span className="hidden whitespace-nowrap text-[12px] font-semibold sm:inline">Involve family</span>
          </span>
          <span title={disabledHint} aria-disabled className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full text-ink-700/35 sm:h-10 sm:w-10">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l1.3-2h7.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
              <circle cx="12" cy="13" r="3.3" />
            </svg>
          </span>
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
        <div className="flex gap-8 px-4 text-[15px]">
          {(["chat", "profile"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2.5 font-semibold ${tab === t ? "border-b-[3px] border-ink-950 text-ink-950" : "text-ink-700/45"}`}
            >
              {t === "chat" ? "Chat" : "Profile"}
            </button>
          ))}
        </div>
        {confirmBlock ? (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 pb-3 text-[13px]">
            <span className="mr-auto text-ink-700/70">Block {card.code}? They won&apos;t be able to contact you.</span>
            <button type="button" onClick={() => setConfirmBlock(false)} className="rounded-full px-3 py-1.5 font-semibold text-ink-700/70 hover:bg-ink-900/5">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => block(card.peerUserId)}
              className="rounded-full bg-[#e12d72] px-3.5 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              Block
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={trackRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex h-full w-[200%] touch-pan-y"
          style={{ transform: tab === "profile" ? "translateX(-50%)" : "translateX(0)", transition: PANE_TRANSITION }}
        >
          {/* Chat pane */}
          <div className="flex h-full w-1/2 min-h-0 flex-col" inert={tab !== "chat" || undefined}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-3 py-4 sm:px-5">
              {card.expiresAt ? <ExpiryBanner expiresAt={card.expiresAt} /> : null}
              {card.introMessage ? (
                <div className={`flex ${received ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-snug shadow-sm sm:max-w-[70%] ${
                      received ? "rounded-bl-md bg-[#f1eeef] text-ink-950" : "rounded-br-md bg-[#2a2427] text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {card.introMessage}
                      <span className="inline-block w-[3.25rem]" aria-hidden />
                    </p>
                    <span className={`float-right -mt-3.5 ml-2 text-[10.5px] leading-none ${received ? "text-ink-700/45" : "text-white/60"}`}>
                      {timeOnly(sentAt)}
                    </span>
                  </div>
                </div>
              ) : received ? null : (
                <p className="text-center text-[13px] text-ink-700/55">You sent a match request.</p>
              )}
            </div>

            <div className="border-t border-ink-900/6 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              {received ? (
                <div className="mx-auto flex max-w-md gap-3">
                  <button
                    type="button"
                    disabled={pending || accepting}
                    onClick={() => setConfirmDecline(true)}
                    className="h-12 flex-1 rounded-full border border-[#e12d72] bg-white text-[15px] font-semibold text-[#e12d72] hover:bg-rose-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={pending || accepting}
                    onClick={() => {
                      setAccepting(true);
                      act("accept");
                    }}
                    className="h-12 flex-1 rounded-full border border-emerald-300 bg-emerald-50 text-[15px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {accepting && !error ? "Opening chat…" : pending ? "…" : "Accept"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="flex items-center gap-2 text-[13px] text-ink-700/65">
                    <StatusPill status="pending" /> Waiting for {card.code} to respond.
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirmWithdraw(true)}
                    className="h-12 w-full max-w-md rounded-full border border-ink-900/12 bg-white text-[15px] font-semibold text-ink-900 hover:bg-ink-900/[0.03] disabled:opacity-50"
                  >
                    Withdraw request
                  </button>
                </div>
              )}
              {error ? <p className="mt-2 text-center text-xs text-rose-700">{error}</p> : null}
            </div>
          </div>

          {/* Profile pane */}
          <div className="flex h-full w-1/2 min-h-0 flex-col" inert={tab !== "profile" || undefined}>
            <div className="flex-1 overflow-y-auto">
              {profile === undefined ? (
                <p className="py-16 text-center text-sm text-ink-700/50">Loading profile…</p>
              ) : profile ? (
                <ProfileDesktop profile={profile} embedded hideNav photoOverrideVisible={false} />
              ) : (
                <p className="py-16 text-center text-sm text-ink-700/50">Profile unavailable.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <DeclineSheet
        open={confirmDecline}
        busy={pending}
        onCancel={() => setConfirmDecline(false)}
        onDecline={() => {
          setConfirmDecline(false);
          act("decline");
        }}
      />
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
