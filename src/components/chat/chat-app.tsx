"use client";

import Link from "next/link";
import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";
import {
  FamilyIcon,
  FamilyModal,
  FamilyPromptCard,
  FamilyStatusLine,
  WaliContactCard,
  familyEvents,
  useFamilyFlow,
  type FamilyEvent,
  type FamilyModalState,
} from "@/components/chat/family-involvement";
import { outboxAdd, outboxAll, outboxFor, outboxRemove, readDrafts, saveDraft } from "@/lib/chat-outbox";
import type { ChatMessageDTO, ChatThreadDTO, PhotoOnceStatus, ReactionSummary } from "@/lib/chat";
import type { ProfileView } from "@/lib/profile";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { MobileBottomNavGate } from "@/components/browse/mobile-bottom-nav-gate";
import { PrivatePhotoShare, openPrivatePhotos } from "@/components/chat/private-photo-share";
import { PrivatePhotoStatusWatcher } from "@/components/chat/private-photo-status-watcher";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { MessageActionMenu } from "@/components/chat/message-action-menu";
import { ProfileDesktop } from "@/components/profile/profile-desktop";
import { ChatNotifyBanner } from "@/components/notifications/chat-notify-banner";
import type { HubCard } from "@/lib/requests-hub-shared";
import { RequestChatPane, RequestListRow, type RequestSub } from "@/components/requests/request-chat-pane";

type Peer = {
  userId: string;
  code: string;
  name: string;
  verified: boolean;
  avatarSeed: number;
};

function avatarUrl(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Local HH:MM inside a bubble; rendered client-side so server/browser timezones can't clash. */
function MessageTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }));
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}

const REPLY_THRESHOLD_PX = 56;
/** Room the action menu (reactions row + actions) needs above a bubble before it flips below. */
const MENU_SPACE_PX = 260;
const REPLY_MAX_PX = 84;

/** Where "Pashtun Nikah" in the chat guidelines prompt points. */
const COMMUNITY_GUIDELINES_HREF = "/guidelines";

const PANE_TRANSITION = "transform 260ms cubic-bezier(0.22, 0.8, 0.3, 1)";

type SendStatus = "pending" | "failed" | "sent" | "delivered" | "read";

function sendStatus(msg: ChatMessageDTO): SendStatus {
  if (msg.failed) return "failed";
  if (msg.id.startsWith("c_")) return "pending";
  if (msg.isRead) return "read";
  if (msg.delivered) return "delivered";
  return "sent";
}

/** C02: clock → ✓ sent → grey ✓✓ delivered → crimson ✓✓ read. Never ✓ before the server confirms. */
function StatusIcon({ status, onDark }: { status: SendStatus; onDark: boolean }) {
  const grey = onDark ? "rgba(255,255,255,0.6)" : "#9ca3af";
  if (status === "pending") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={grey} strokeWidth="2.2" aria-label="Sending">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.4" aria-label="Not sent">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
    );
  }
  if (status === "sent") {
    return (
      <svg width="12" height="10" viewBox="0 0 16 10" aria-label="Sent">
        <path d="M3 5.2 5.6 7.8 12 1.6" fill="none" stroke={grey} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const color = status === "read" ? (onDark ? "#fb7ea4" : "#aa1945") : grey;
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-label={status === "read" ? "Read" : "Delivered"}>
      <path d="M1.2 5.2 3.6 7.6 8.2 2.2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.4 5.2 7.8 7.6 14 1.4" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LocalStamp({ iso, variant }: { iso: string | null; variant: "list" | "day" }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!iso) {
      setLabel("");
      return;
    }
    setLabel(variant === "list" ? formatTime(iso) : dayLabel(iso));
  }, [iso, variant]);
  return <span suppressHydrationWarning>{label}</span>;
}

function DoubleCheck({ read }: { read: boolean }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" className="inline-block ml-1 shrink-0">
      <path
        d="M1.2 5.2 3.6 7.6 8.2 2.2"
        fill="none"
        stroke={read ? "#aa1945" : "#9ca3af"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.4 5.2 7.8 7.6 14 1.4"
        fill="none"
        stroke={read ? "#aa1945" : "#9ca3af"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MessageBubble({
  msg,
  mine,
  peerName,
  currentUserId,
  onReply,
  onReact,
  onCopy,
  onReport,
  onRetry,
  waliContacted,
  onWaliAction,
  locked = false,
}: {
  /** N53: ended match — read-only (no reply / react); copy and report still work. */
  locked?: boolean;
  onRetry?: (m: ChatMessageDTO) => void;
  /** Wali contact card only: he has confirmed contacting her wali. */
  waliContacted?: boolean;
  onWaliAction?: () => void;
  msg: ChatMessageDTO;
  mine: boolean;
  peerName: string;
  currentUserId: string;
  onReply: (m: ChatMessageDTO) => void;
  onReact: (m: ChatMessageDTO, emoji: string) => void;
  onCopy: (m: ChatMessageDTO) => void;
  onReport: (m: ChatMessageDTO) => void;
}) {
  const [menuOpen, setMenuOpenRaw] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below">("above");
  const bubbleRef = useRef<HTMLDivElement>(null);
  function setMenuOpen(open: boolean) {
    if (open && bubbleRef.current) {
      const scroller = bubbleRef.current.closest(".overflow-y-auto");
      const top = bubbleRef.current.getBoundingClientRect().top;
      const limit = scroller ? scroller.getBoundingClientRect().top : 0;
      setMenuPlacement(top - limit < MENU_SPACE_PX ? "below" : "above");
    }
    setMenuOpenRaw(open);
  }
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // C04: WhatsApp-style drag-right-to-reply that follows the finger.
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; y: number; lock: "h" | "v" | null; buzzed: boolean } | null>(null);

  function onDragStart(e: React.TouchEvent) {
    const t = e.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, lock: null, buzzed: false };
    startLongPress();
  }
  function onDragMove(e: React.TouchEvent) {
    const d = drag.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.lock) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.lock = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3 ? "h" : "v";
      cancelLongPress();
    }
    if (d.lock !== "h") return;
    const x = Math.max(0, Math.min(REPLY_MAX_PX, dx * 0.8));
    setDragX(x);
    if (x >= REPLY_THRESHOLD_PX && !d.buzzed) {
      d.buzzed = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    }
  }
  function onDragEnd() {
    cancelLongPress();
    const d = drag.current;
    drag.current = null;
    if (!locked && d?.lock === "h" && dragX >= REPLY_THRESHOLD_PX) onReply(msg);
    setDragX(0);
  }

  function startLongPress() {
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 450);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const quoteName = msg.replyTo
    ? msg.replyTo.senderId === msg.senderId
      ? mine
        ? "You"
        : peerName
      : mine
        ? peerName
        : "You"
    : null;

  // simplify quote label
  const replyLabel = msg.replyTo
    ? msg.replyTo.senderId === (mine ? msg.receiverId : msg.senderId)
      ? peerName.split(" ")[0]
      : "You"
    : null;

  return (
    <div
      className={`group flex ${mine ? "justify-end" : "justify-start"} animate-[chatIn_220ms_ease-out]`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      onTouchStart={onDragStart}
      onTouchEnd={onDragEnd}
      onTouchCancel={onDragEnd}
      onTouchMove={onDragMove}
    >
      {dragX > 0 ? (
        <span
          className="self-center mr-1 text-rose-600"
          style={{ opacity: Math.min(1, dragX / REPLY_THRESHOLD_PX), transform: `scale(${0.6 + Math.min(0.4, dragX / 150)})` }}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 14 4 9l5-5" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </span>
      ) : null}
      <div
        ref={bubbleRef}
        className={`relative max-w-[82%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragX ? "none" : "transform 180ms ease-out",
        }}
      >
        {msg.type === "contact_card" && msg.card ? (
          <div className="w-[min(280px,74vw)]">
            <WaliContactCard wali={msg.card} contacted={waliContacted} onAction={mine ? undefined : onWaliAction} />
            {mine ? (
              <span className="float-right mt-1">
                <DoubleCheck read={msg.isRead} />
              </span>
            ) : null}
          </div>
        ) : (
          <div
            className={`rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-snug shadow-sm ${
              mine
                ? "bg-[#2a2427] text-white rounded-br-md"
                : "bg-[#f1eeef] text-ink-950 rounded-bl-md"
            }`}
          >
            {msg.replyTo ? (
              <div
                className={`mb-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                  mine ? "bg-black/25 text-white/85" : "bg-white/80 text-ink-700"
                }`}
                style={{ borderLeft: "3px solid #aa1945" }}
              >
                <p className="font-semibold text-[11px]" style={{ color: "#aa1945" }}>
                  {replyLabel || quoteName}
                </p>
                <p className="line-clamp-2 opacity-90">{msg.replyTo.body}</p>
              </div>
            ) : null}
            <p className="whitespace-pre-wrap break-words">
              {msg.body}
              {/* Spacer so the time/ticks never overlap the last line of text. */}
              <span className="inline-block w-[4.25rem]" aria-hidden />
            </p>
            <span
              className={`float-right -mt-3.5 ml-2 flex items-center gap-1 text-[10.5px] leading-none ${
                mine ? "text-white/60" : "text-ink-700/45"
              }`}
            >
              <MessageTime iso={msg.createdAt} />
              {mine ? <StatusIcon status={sendStatus(msg)} onDark /> : null}
            </span>
          </div>
        )}
        {mine && msg.failed ? (
          <button
            type="button"
            onClick={() => onRetry?.(msg)}
            className="mt-1 block ml-auto text-[11px] font-semibold text-rose-600 hover:underline"
          >
            Not sent — tap to retry
          </button>
        ) : null}

        {msg.reactions && msg.reactions.length > 0 ? (
          // C05: reactions tuck under the bubble's bottom edge — outgoing under the time/ticks
          // (right), incoming overlapping the bottom-left corner.
          <div
            className={`relative z-[1] flex flex-wrap gap-1 -mt-2.5 ${
              mine ? "justify-end pr-2.5" : "justify-start pl-2.5"
            }`}
          >
            {msg.reactions.map((r) => {
              const reactedByMe = r.userIds.includes(currentUserId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  disabled={locked}
                  onClick={() => onReact(msg, r.emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[13px] leading-5 border shadow-sm transition ${
                    reactedByMe
                      ? "bg-white border-rose-300 text-rose-700"
                      : "bg-white border-ink-900/10 text-ink-700"
                  }`}
                >
                  <span>{r.emoji}</span>
                  {r.userIds.length > 1 ? <span className="font-semibold">{r.userIds.length}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition ${
            mine ? "-left-9" : "-right-9"
          } w-7 h-7 rounded-full bg-white border border-ink-900/10 shadow-sm flex items-center justify-center text-ink-700/70 hover:text-rose-600`}
          aria-label="Message actions"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>

        <MessageActionMenu
          placement={menuPlacement}
          mine={mine}
          open={menuOpen}
          canReport={!mine}
          locked={locked}
          onClose={() => setMenuOpen(false)}
          onReact={(emoji) => onReact(msg, emoji)}
          onReply={() => onReply(msg)}
          onCopy={() => onCopy(msg)}
          onReport={() => onReport(msg)}
        />
      </div>
    </div>
  );
}

/**
 * "End this match?" — rendered on <body>: the Chat/Profile panes sit on a transformed (and, for the
 * hidden pane, inert) track, which clipped a fixed popup in half and made Cancel unclickable.
 */
function EndMatchConfirm({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="end-match-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl animate-[chatIn_160ms_ease-out]"
      >
        <h3 id="end-match-title" className="text-lg font-bold text-ink-950">
          End this match?
        </h3>
        <p className="mt-2 text-sm text-ink-700/70 leading-relaxed">
          The conversation will become read-only. You can still view past messages. This cannot be undone.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Ending…" : "Yes, end match"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ChatApp({
  initialThreads,
  userId,
  profileCode,
  initialRequestId = null,
  unreadCount = 0,
  userRealtimeTopic,
  initialInboxTab = "chats",
  initialRequestSub = "received",
  initialOpenRequestId = null,
}: {
  initialThreads: ChatThreadDTO[];
  userId: string;
  profileCode?: string | null;
  initialRequestId?: string | null;
  unreadCount?: number;
  userRealtimeTopic: string;
  /** Chats → Requests tab (opened from the Requests page's introduction message). */
  initialInboxTab?: "chats" | "requests";
  initialRequestSub?: RequestSub;
  initialOpenRequestId?: string | null;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [inboxTab, setInboxTab] = useState<"chats" | "requests">(initialInboxTab);
  const [requestSub, setRequestSub] = useState<RequestSub>(initialRequestSub);
  const [requestLists, setRequestLists] = useState<{ received: HubCard[]; sent: HubCard[] } | null>(null);
  const [openRequestId, setOpenRequestId] = useState<string | null>(initialOpenRequestId);
  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/requests", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json().catch(() => null);
    if (data) setRequestLists({ received: data.received ?? [], sent: data.sent ?? [] });
  }, []);
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);
  const [activeId, setActiveId] = useState<string | null>(initialRequestId);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [tab, setTab] = useState<"chat" | "profile">("chat");
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [unreadMarker, setUnreadMarker] = useState<{ id: string; count: number } | null>(null);
  const activeIdRef = useRef<string | null>(initialRequestId);
  const inFlightRef = useRef<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => setDrafts(readDrafts()), []);
  function clearDraft(requestId: string) {
    setDrafts(saveDraft(requestId, ""));
  }
  const [replyTo, setReplyTo] = useState<ChatMessageDTO | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [typingByThread, setTypingByThread] = useState<Record<string, boolean>>({});
  const [loadingThread, setLoadingThread] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [photoShared, setPhotoShared] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [canSharePhoto, setCanSharePhoto] = useState(false);
  const [isFemaleViewer, setIsFemaleViewer] = useState(false);
  const [peerProfile, setPeerProfile] = useState<ProfileView | null>(null);
  const [photoOnceStatus, setPhotoOnceStatus] = useState<PhotoOnceStatus>("none");
  const [canSendPhotoOnce, setCanSendPhotoOnce] = useState(false);
  const [canRevealPhotoOnce, setCanRevealPhotoOnce] = useState(false);
  const [photoOnceBusy, setPhotoOnceBusy] = useState(false);
  const [revealedPhotoUrl, setRevealedPhotoUrl] = useState<string | null>(null);
  const [revealedAvatarSeed, setRevealedAvatarSeed] = useState<number | null>(null);
  const [incomingPrivatePhotoStatus, setIncomingPrivatePhotoStatus] = useState<
    "none" | "shared" | "active" | "expired"
  >("none");
  const [commMode, setCommMode] = useState<string>("standard");
  const [shareConfirm, setShareConfirm] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<"photo" | "more" | null>(null);
  const [familyModal, setFamilyModal] = useState<FamilyModalState>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [blockArmed, setBlockArmed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [chatWarning, setChatWarning] = useState<string | null>(null);
  const [matchEnded, setMatchEnded] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [endedByMe, setEndedByMe] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  // null = not known yet for this chat (no prompt, no sending) until the server says.
  const [chatConsent, setChatConsent] = useState<boolean | null>(null);
  const [, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<ChatMessageDTO[]>([]);
  const hasMoreOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const prependAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const bootScrollDoneRef = useRef(false);
  const canPageOlderRef = useRef(false);
  const swipeStart = useRef<{ x: number; y: number; t: number; lock: "h" | "v" | null } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  /**
   * Chat ↔ Profile pane drag (C11 / M04 / M05). The track follows the finger once the gesture is
   * clearly horizontal; vertical movement locks to scrolling and never switches panes. Releasing
   * past a third of the width (or with a quick flick) switches, otherwise it springs back.
   */
  function onPaneTouchStart(e: React.TouchEvent) {
    if (!activeId || window.innerWidth >= 1024) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [data-no-pane-swipe]")) return;
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY, t: performance.now(), lock: null };
  }

  function paneWidth() {
    return (trackRef.current?.parentElement?.clientWidth ?? window.innerWidth) || 1;
  }

  function onPaneTouchMove(e: React.TouchEvent) {
    const start = swipeStart.current;
    const track = trackRef.current;
    if (!start || !track) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (!start.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      start.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? "h" : "v";
    }
    if (start.lock !== "h") return;
    const w = paneWidth();
    const base = tabRef.current === "profile" ? -w : 0;
    // Only drag towards the other pane. A rightward drag in Chat belongs to swipe-to-reply.
    const offset = Math.min(0, Math.max(-w, base + dx));
    if (offset === base) return;
    track.style.transition = "none";
    track.style.transform = `translateX(${offset}px)`;
  }

  function onPaneTouchEnd(e: React.TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    const track = trackRef.current;
    if (!start || !track || start.lock !== "h") return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - start.t);
    const passed = Math.abs(dx) > paneWidth() / 3 || (velocity > 0.5 && Math.abs(dx) > 40);
    let next = tabRef.current;
    if (passed && dx < 0 && next === "chat") next = "profile";
    else if (passed && dx > 0 && next === "profile") next = "chat";
    // Animate to the resting position (switch or spring back), then hand control back to React.
    track.style.transition = PANE_TRANSITION;
    track.style.transform = next === "profile" ? "translateX(-50%)" : "translateX(0)";
    if (next !== tabRef.current) setTab(next);
  }
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerMenu !== "more") setBlockArmed(false);
    if (!headerMenu) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Element | null;
      // Dialogs opened from a header dropdown (photo picker, Start Viewing, the viewer) render at
      // <body>. Closing the dropdown here would unmount them mid-click, so nothing in them worked.
      if (target?.closest?.("[data-chat-overlay]")) return;
      if (headerRef.current && !headerRef.current.contains(target)) {
        setHeaderMenu(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [headerMenu]);

  const {
    connected,
    joinThread,
    leaveThread,
    joinUser,
    sendMessage,
    emitTyping,
    markRead,
    toggleReaction,
    on,
  } = useChatSocket(true, userId);

  useEffect(() => {
    void joinUser(userRealtimeTopic);
  }, [joinUser, userRealtimeTopic]);
  // A request was sent / answered / withdrawn / expired elsewhere — keep the Requests tab current.
  useEffect(() => on("request:update", () => void loadRequests()), [on, loadRequests]);

  const isNearBottom = useCallback((el: HTMLElement, threshold = 80) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
      atBottomRef.current = true;
      setAtBottom(true);
      setUnseenCount(0);
    });
  }, []);

  // Keep a ref copy so scroll handlers read the latest messages without re-binding.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadOlderMessages = useCallback(async () => {
    const el = scrollerRef.current;
    if (!el || !activeId || loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const oldest = messagesRef.current.find((m) => !String(m.id).startsWith("c_"));
    if (!oldest) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    try {
      const res = await fetch(`/api/chats/${activeId}?before=${oldest.id}&limit=25`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.messages)) return;

      hasMoreOlderRef.current = Boolean(data.hasMore);
      setHasMoreOlder(Boolean(data.hasMore));

      if (data.messages.length > 0) {
        // Preserve the reading position: after the older batch renders, add back the
        // height that grew above the viewport (applied in a layout effect, pre-paint).
        prependAdjustRef.current = { prevHeight, prevTop };
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const older = (data.messages as ChatMessageDTO[]).filter((m) => !seen.has(m.id));
          return older.length ? [...older, ...prev] : prev;
        });
      }
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [activeId]);

  const onScrollThread = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const near = isNearBottom(el);
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setUnseenCount(0);
    // Only page in older history after the thread has settled at the bottom (canPageOlderRef
    // is armed a beat after the initial pin) and the list is actually scrollable — otherwise
    // the initial render sitting at scrollTop 0 would pull page after page on its own.
    if (
      canPageOlderRef.current &&
      el.scrollHeight > el.clientHeight + 40 &&
      el.scrollTop < 140 &&
      hasMoreOlderRef.current &&
      !loadingOlderRef.current
    ) {
      void loadOlderMessages();
    }
  }, [isNearBottom, loadOlderMessages]);

  const openThread = useCallback(
    async (requestId: string, opts?: { soft?: boolean }) => {
      if (!opts?.soft) setLoadingThread(true);
      // K08/C12: restore this conversation's unsent draft when switching to it.
      if (requestId !== activeIdRef.current) setText(readDrafts()[requestId] ?? "");
      // Guidelines prompt: known on this device → instant; otherwise wait for the server's answer.
      setChatConsent(localStorage.getItem(`chat-consent-${requestId}`) === "1" ? true : null);
      setTab("chat");
      setReplyTo(null);
      setPeerTyping(false);
      setTypingByThread((prev) => ({ ...prev, [requestId]: false }));
      setUnseenCount(0);
      setAtBottom(true);
      atBottomRef.current = true;
      setLoadingOlder(false);
      loadingOlderRef.current = false;
      setHasMoreOlder(false);
      hasMoreOlderRef.current = false;
      prependAdjustRef.current = null;
      bootScrollDoneRef.current = false;
      canPageOlderRef.current = false;
      try {
        const res = await fetch(`/api/chats/${requestId}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) showToast("This conversation is no longer available.");
          return;
        }
        setPeer(data.peer);
        // C14: show any still-queued (unconfirmed) messages for this conversation after history.
        const history: ChatMessageDTO[] = data.messages || [];
        const confirmed = new Set(history.map((m) => m.clientId).filter(Boolean));
        const queued = outboxFor(requestId).filter((m) => !confirmed.has(m.clientId));
        for (const q of outboxFor(requestId)) if (confirmed.has(q.clientId)) outboxRemove(q.clientId);
        const loaded = [...history, ...queued];
        setMessages(loaded);
        messagesRef.current = loaded;
        // C08: remember where unread starts so we can show an "N unread messages" divider.
        const firstUnread = history.findIndex((m) => m.senderId !== userId && !m.isRead);
        setUnreadMarker(
          firstUnread >= 0
            ? { id: history[firstUnread].id, count: history.length - firstUnread }
            : null
        );
        setHasMoreOlder(Boolean(data.hasMore));
        hasMoreOlderRef.current = Boolean(data.hasMore);
        setActiveId(requestId);
        setPhotoShared(Boolean(data.photoShared));
        setPhotoVisible(Boolean(data.photoVisible));
        setCanSharePhoto(Boolean(data.canSharePhoto));
        setIsFemaleViewer(Boolean(data.isFemaleViewer));
        setCommMode(data.communicationMode || "standard");
        setShareConfirm(false);
        setHeaderMenu(null);
        setFamilyModal(null);
        setPeerProfile(data.peerProfile || null);
        setPhotoOnceStatus(data.photoOnceStatus || "none");
        setCanSendPhotoOnce(Boolean(data.canSendPhotoOnce));
        setCanRevealPhotoOnce(Boolean(data.canRevealPhotoOnce));
        setRevealedPhotoUrl(null);
        setRevealedAvatarSeed(null);
        setIncomingPrivatePhotoStatus("none");
        setMatchEnded(Boolean(data.matchEnded));
        // N39: the acknowledgement is stored per member on the server, so a new device or
        // incognito tab doesn't ask again. An "I understand" saved only on this device before the
        // server kept it is sent up once.
        {
          const local = localStorage.getItem(`chat-consent-${requestId}`) === "1";
          if (data.chatConsent) localStorage.setItem(`chat-consent-${requestId}`, "1");
          else if (local) void fetch(`/api/chats/${requestId}/consent`, { method: "POST" }).catch(() => {});
          setChatConsent(Boolean(data.chatConsent) || local);
        }
        setEndReason(data.endReason ?? null);
        setEndedByMe(Boolean(data.endedByMe));
        setShowEndConfirm(false);
        setThreads((prev) =>
          prev.map((t) => (t.requestId === requestId ? { ...t, unread: 0 } : t))
        );
        await joinThread(requestId, data.realtimeTopic);
        markRead(requestId);
        await fetch(`/api/chats/${requestId}/read`, { method: "POST" });
        scrollToBottom(false);
      } finally {
        setLoadingThread(false);
      }
    },
    [joinThread, markRead, scrollToBottom, userId]
  );

  // Re-join active thread after reconnect
  useEffect(() => {
    if (!connected || !activeId) return;
    void joinThread(activeId);
  }, [connected, activeId, joinThread]);

  useEffect(() => {
    if (initialRequestId) {
      void openThread(initialRequestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach realtime listeners (re-bind when active thread changes).
  useEffect(() => {
    if (!connected) return;

    const onNew = (msg: ChatMessageDTO) => {
      if (msg.requestId !== activeId) {
        setThreads((prev) => {
          const next = prev.map((t) => {
            if (t.requestId !== msg.requestId) return t;
            return {
              ...t,
              lastMessage: msg.body,
              lastAt: msg.createdAt,
              unread: msg.senderId === userId ? t.unread : t.unread + 1,
            };
          });
          return [...next].sort(
            (a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()
          );
        });
        setTypingByThread((prev) => ({ ...prev, [msg.requestId]: false }));
        return;
      }

      // clear typing when a message arrives from peer
      if (msg.senderId !== userId) {
        setPeerTyping(false);
        setTypingByThread((prev) => ({ ...prev, [msg.requestId]: false }));
      }

      setMessages((prev) => {
        if (msg.clientId && prev.some((m) => m.clientId === msg.clientId || m.id === msg.id)) {
          return prev.map((m) =>
            m.clientId === msg.clientId || m.id === msg.id ? { ...msg, clientId: msg.clientId } : m
          );
        }
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setThreads((prev) => {
        const next = prev.map((t) =>
          t.requestId === msg.requestId
            ? {
                ...t,
                lastMessage: msg.body,
                lastAt: msg.createdAt,
                unread: atBottomRef.current || msg.senderId === userId ? 0 : t.unread,
              }
            : t
        );
        return [...next].sort(
          (a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()
        );
      });

      if (msg.senderId !== userId) markRead(msg.requestId);

      if (atBottomRef.current || msg.senderId === userId) {
        scrollToBottom(true);
      } else if (msg.senderId !== userId) {
        setUnseenCount((n) => n + 1);
      }
    };

    const onDelivered = (payload: { requestId: string; receiverId: string }) => {
      if (payload.requestId !== activeId || payload.receiverId === userId) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === userId && !m.id.startsWith("c_") ? { ...m, delivered: true } : m))
      );
    };

    const onRead = (payload: { requestId: string; readerId: string }) => {
      if (payload.requestId !== activeId || payload.readerId === userId) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === userId ? { ...m, isRead: true } : m))
      );
    };

    const onTyping = (payload: { requestId: string; userId: string; typing: boolean }) => {
      if (payload.userId === userId) return;
      setTypingByThread((prev) => ({ ...prev, [payload.requestId]: payload.typing }));
      if (payload.requestId !== activeId) return;
      setPeerTyping(payload.typing);
      if (peerTypingClear.current) clearTimeout(peerTypingClear.current);
      if (payload.typing) {
        peerTypingClear.current = setTimeout(() => {
          setPeerTyping(false);
          setTypingByThread((prev) => ({ ...prev, [payload.requestId]: false }));
        }, 3000);
      }
    };

    const onInbox = (payload: {
      requestId: string;
      lastMessage: string;
      lastAt: string;
      fromUserId: string;
    }) => {
      if (payload.requestId === activeId) return;
      setThreads((prev) => {
        const next = prev.map((t) => {
          if (t.requestId !== payload.requestId) return t;
          return {
            ...t,
            lastMessage: payload.lastMessage,
            lastAt: payload.lastAt,
            unread: payload.fromUserId === userId ? t.unread : t.unread + 1,
          };
        });
        return [...next].sort(
          (a, b) => new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()
        );
      });
      setTypingByThread((prev) => ({ ...prev, [payload.requestId]: false }));
    };

    const onPhoto = (payload: { requestId: string; photoShared: boolean; fromUserId: string }) => {
      if (payload.fromUserId === userId) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.requestId === payload.requestId
            ? { ...t, photoShared: payload.photoShared, photoVisible: payload.photoShared }
            : t
        )
      );
      if (payload.requestId === activeId) {
        setPhotoShared(payload.photoShared);
        setPhotoVisible(payload.photoShared);
      }
    };

    const onReaction = (payload: {
      requestId: string;
      messageId: string;
      reactions: ReactionSummary;
    }) => {
      if (payload.requestId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m))
      );
    };

    const onPhotoOnce = (payload: {
      requestId: string;
      status: "pending" | "viewed";
      fromUserId: string;
    }) => {
      if (payload.fromUserId === userId || payload.requestId !== activeId) return;
      setPhotoOnceStatus(payload.status);
      if (payload.status === "pending") setCanRevealPhotoOnce(true);
      if (payload.status === "viewed") setCanRevealPhotoOnce(false);
    };

    const onMatchClosed = (payload: { requestId: string; byUserId: string }) => {
      if (payload.byUserId === userId) return;
      // N53: the thread moves to "Past matches" (still readable) instead of disappearing.
      setThreads((prev) =>
        prev.map((t) => (t.requestId === payload.requestId ? { ...t, ended: true, endedAt: new Date().toISOString() } : t))
      );
      if (payload.requestId === activeId) {
        setMatchEnded(true);
        setEndReason("user");
        setEndedByMe(false);
        setPeerTyping(false);
        setReplyTo(null);
      }
    };

    const offs = [
      on("messages:delivered", onDelivered),
      on("match:closed", onMatchClosed),
      on("message:new", onNew),
      on("messages:read", onRead),
      on("typing", onTyping),
      on("inbox:update", onInbox),
      on("photo:update", onPhoto),
      on("reaction:update", onReaction),
      on("photo-once:update", onPhotoOnce),
    ];

    return () => {
      offs.forEach((off) => off());
    };
  }, [connected, activeId, userId, markRead, scrollToBottom, on]);

  useEffect(() => {
    return () => {
      if (activeId) leaveThread(activeId);
    };
  }, [activeId, leaveThread]);

  const { family, busy: familyBusy, act: familyAct } = useFamilyFlow(activeId, !matchEnded);
  const noteWaliAction = useCallback(() => void familyAct("contact_action"), [familyAct]);

  const grouped = useMemo(() => {
    const items: {
      type: "day" | "msg" | "unread" | "family";
      key: string;
      iso?: string;
      msg?: ChatMessageDTO;
      event?: FamilyEvent;
    }[] = [];
    // Family status lines sit in the conversation at the time they happened. Anything older than
    // the loaded page waits until those messages are scrolled into view.
    const firstAt = messages[0] ? new Date(messages[0].createdAt).getTime() : 0;
    const events = familyEvents(matchEnded ? null : family)
      .filter((e) => !hasMoreOlder || new Date(e.at).getTime() >= firstAt)
      .sort((a, b) => a.at.localeCompare(b.at));
    let lastDay = "";
    for (const msg of messages) {
      while (events.length && events[0].at <= msg.createdAt) {
        const event = events.shift()!;
        items.push({ type: "family", key: event.key, event });
      }
      // Group by the member's LOCAL calendar day (C07), not the UTC date.
      const day = new Date(msg.createdAt).toDateString();
      if (day !== lastDay) {
        items.push({ type: "day", key: `d-${day}-${msg.id}`, iso: msg.createdAt });
        lastDay = day;
      }
      if (unreadMarker && msg.id === unreadMarker.id) items.push({ type: "unread", key: `u-${msg.id}` });
      items.push({ type: "msg", key: msg.id, msg });
    }
    for (const event of events) items.push({ type: "family", key: event.key, event });
    return items;
  }, [messages, unreadMarker, family, matchEnded, hasMoreOlder]);

  // A new status line or prompt at the foot of the chat shouldn't land below the fold.
  const familyMark = `${family?.card ?? ""}|${family?.request.state ?? ""}|${family?.contacted ?? ""}`;
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(true);
  }, [familyMark, scrollToBottom]);


  // Message-list scroll management, run before paint on every messages change:
  //  1. first render of a thread  -> pin to the newest message
  //  2. older page just prepended -> keep the current message under the viewport
  useLayoutEffect(() => {
    if (loadingThread || tab !== "chat") return;
    const el = scrollerRef.current;
    if (!el || messages.length === 0) return;

    if (!bootScrollDoneRef.current) {
      // Instant (not smooth) jump — the container has `scroll-smooth`, and an animated
      // pin would leave scrollTop near 0 for a few frames, tripping the load-older check.
      const pin = () => {
        const cur = scrollerRef.current;
        if (cur && atBottomRef.current) cur.scrollTo({ top: cur.scrollHeight, behavior: "instant" });
      };
      atBottomRef.current = true;
      prependAdjustRef.current = null;
      bootScrollDoneRef.current = true;
      pin();
      const raf = requestAnimationFrame(pin);
      // Re-pin after late layout (fonts, reply chips, reaction rows), then allow paging.
      const t = setTimeout(() => {
        pin();
        canPageOlderRef.current = true;
      }, 300);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }

    const adj = prependAdjustRef.current;
    if (adj) {
      prependAdjustRef.current = null;
      el.scrollTo({ top: adj.prevTop + (el.scrollHeight - adj.prevHeight), behavior: "instant" });
    }
  }, [messages, loadingThread, tab]);

  /** N43: the member who ended the match can ask again — a new request costing one Match Token. */
  async function requestRematch() {
    if (!displayName || rematchBusy) return;
    setRematchBusy(true);
    setHeaderMenu(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileCode: displayName, rematch: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error || "Could not request a rematch");
        return;
      }
      setToast(data.message === "Request already sent" ? "Rematch request already sent" : "Rematch request sent");
      window.location.assign("/requests?tab=sent");
    } finally {
      setRematchBusy(false);
    }
  }

  async function endMatchHandler() {
    if (!activeId || matchEnded || endBusy) return;
    setEndBusy(true);
    try {
      const res = await fetch(`/api/matches/${activeId}/end`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error || "Could not end match");
        return;
      }
      setMatchEnded(true);
      setEndReason(data.endReason ?? "user");
      setEndedByMe(true);
      setShowEndConfirm(false);
      setThreads((prev) =>
        prev.map((t) => (t.requestId === activeId ? { ...t, ended: true, endedAt: new Date().toISOString() } : t))
      );
      setToast("Match ended");
    } finally {
      setEndBusy(false);
    }
  }

  /** Try to deliver one message; updates its bubble in place. Returns true once confirmed. */
  async function deliverMessage(item: ChatMessageDTO & { clientId: string }): Promise<boolean> {
    const clientId = item.clientId;
    // A flush on reconnect can overlap a manual retry — never have two sends of one message in flight.
    if (inFlightRef.current.has(clientId)) return false;
    inFlightRef.current.add(clientId);
    try {
      return await deliverOnce(item);
    } finally {
      inFlightRef.current.delete(clientId);
    }
  }

  async function deliverOnce(item: ChatMessageDTO & { clientId: string }): Promise<boolean> {
    const clientId = item.clientId;
    const setFor = (fn: (m: ChatMessageDTO) => ChatMessageDTO | null) =>
      setMessages((prev) =>
        prev.flatMap((m) => {
          if (m.clientId !== clientId) return [m];
          const next = fn(m);
          return next ? [next] : [];
        })
      );

    const sent = await sendMessage({
      requestId: item.requestId,
      body: item.body,
      replyToId: item.replyToId ?? null,
      clientId,
    });

    if (sent.ok) {
      outboxRemove(clientId);
      setFor(() => ({ ...sent.message, clientId }));
      setChatWarning(null);
      return true;
    }
    if ("closed" in sent && sent.closed) {
      outboxRemove(clientId);
      setFor(() => null);
      if (item.requestId === activeIdRef.current) {
        setText(item.body);
        setMatchEnded(true);
        setEndReason(null);
        setEndedByMe(false);
      }
      return false;
    }
    if ("warning" in sent && sent.warning) {
      outboxRemove(clientId);
      setFor(() => null);
      setChatWarning(sent.error);
      return false;
    }
    // Network/server hiccup: keep it queued on the device with a clock — never show ticks
    // until the server has confirmed it (C14).
    outboxAdd(item);
    setFor((m) => ({ ...m, failed: typeof navigator !== "undefined" && navigator.onLine }));
    return false;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (matchEnded || !chatConsent) return;
    const body = text.trim();
    if (!body || !activeId || !peer) return;
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessageDTO & { clientId: string } = {
      id: clientId,
      requestId: activeId,
      senderId: userId,
      receiverId: peer.userId,
      body,
      isRead: false,
      replyToId: replyTo?.id ?? null,
      replyTo: replyTo
        ? { id: replyTo.id, body: replyTo.body, senderId: replyTo.senderId }
        : null,
      createdAt: new Date().toISOString(),
      clientId,
      type: "text",
    };
    outboxAdd(optimistic);
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    clearDraft(activeId);
    setReplyTo(null);
    emitTyping(activeId, false);
    scrollToBottom(true);
    inputRef.current?.focus();

    if (typeof navigator !== "undefined" && !navigator.onLine) return; // flushed on reconnect
    await deliverMessage(optimistic);
  }

  // C14: when the connection returns, send everything still queued on this device.
  useEffect(() => {
    const flush = () => {
      for (const item of outboxAll()) {
        if (item.senderId !== userId) continue;
        void deliverMessage(item);
      }
    };
    window.addEventListener("online", flush);
    flush();
    return () => window.removeEventListener("online", flush);
    // deliverMessage only reads refs/state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function retryMessage(m: ChatMessageDTO) {
    if (!m.clientId) return;
    setMessages((prev) => prev.map((x) => (x.clientId === m.clientId ? { ...x, failed: false } : x)));
    await deliverMessage({ ...m, clientId: m.clientId });
  }

  async function togglePhotoShare(shared: boolean) {
    if (!activeId) return;
    setPhotoBusy(true);
    setShareConfirm(false);
    try {
      const res = await fetch(`/api/chats/${activeId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setPhotoShared(Boolean(data.photoShared));
      setPhotoVisible(Boolean(data.photoVisible));
      setThreads((prev) =>
        prev.map((t) =>
          t.requestId === activeId
            ? { ...t, photoShared: Boolean(data.photoShared), photoVisible: Boolean(data.photoVisible) }
            : t
        )
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function sendPhotoOnceHandler() {
    if (!activeId || photoOnceBusy) return;
    setPhotoOnceBusy(true);
    try {
      const res = await fetch(`/api/chats/${activeId}/photo-once`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not send one-time photo");
        return;
      }
      setPhotoOnceStatus(data.photoOnceStatus || "pending");
    } finally {
      setPhotoOnceBusy(false);
    }
  }

  async function revealPhotoOnceHandler() {
    if (!activeId || photoOnceBusy) return;
    setPhotoOnceBusy(true);
    try {
      const res = await fetch(`/api/chats/${activeId}/photo-once/view`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "This photo is no longer available.");
        setCanRevealPhotoOnce(false);
        setPhotoOnceStatus("viewed");
        return;
      }
      setRevealedPhotoUrl(data.photoUrl || null);
      setRevealedAvatarSeed(typeof data.avatarSeed === "number" ? data.avatarSeed : null);
      setPhotoOnceStatus("viewed");
      setCanRevealPhotoOnce(false);
    } finally {
      setPhotoOnceBusy(false);
    }
  }

  function onTextChange(value: string) {
    setText(value);
    if (!activeId) return;
    setDrafts(saveDraft(activeId, value));
    emitTyping(activeId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(activeId, false), 1000);
  }

  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    onTextChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function toggleReactionLocal(
    current: ReactionSummary,
    uid: string,
    emoji: string
  ): ReactionSummary {
    const next = current.map((r) => ({ emoji: r.emoji, userIds: [...r.userIds] }));
    for (const r of next) {
      const idx = r.userIds.indexOf(uid);
      if (idx !== -1) {
        const hadThisEmoji = r.emoji === emoji;
        r.userIds.splice(idx, 1);
        if (hadThisEmoji) return next.filter((r2) => r2.userIds.length > 0);
        break;
      }
    }
    const target = next.find((r) => r.emoji === emoji);
    if (target) target.userIds.push(uid);
    else next.push({ emoji, userIds: [uid] });
    return next.filter((r) => r.userIds.length > 0);
  }

  async function reactToMessage(messageId: string, emoji: string) {
    if (!activeId) return;
    const prevReactions = messages.find((m) => m.id === messageId)?.reactions ?? [];
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: toggleReactionLocal(m.reactions ?? [], userId, emoji) }
          : m
      )
    );

    const result = await toggleReaction(activeId, messageId, emoji);
    if (result) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: result } : m))
      );
      return;
    }

    const res = await fetch(`/api/chats/${activeId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.reactions) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
      );
    } else {
      // Both the realtime call and the REST fallback failed — roll the optimistic
      // reaction back so the sender's view matches what the other side will see.
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: prevReactions } : m))
      );
      showToast(data?.error || "Couldn't save that reaction");
    }
  }

  async function copyMessage(m: ChatMessageDTO) {
    const text = m.type === "contact_card" && m.card?.contact ? m.card.contact : m.body;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      showToast("Could not copy");
    }
  }

  // A02: both report entry points open the reason + details popup instead of sending instantly.
  function reportMessage(m: ChatMessageDTO) {
    if (!peer) return;
    setReportTarget({
      userId: m.senderId,
      code: peer.code,
      requestId: activeId,
      message: { id: m.id, body: m.body },
    });
  }

  function reportMember() {
    if (!peer) return;
    setHeaderMenu(null);
    setReportTarget({ userId: peer.userId, code: peer.code, requestId: activeId });
  }

  async function blockMember(doneMessage = "Member blocked") {
    if (!peer || moreBusy) return;
    setMoreBusy(true);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peer.userId }),
      });
      if (!res.ok) {
        showToast("Could not block member");
        return;
      }
      setThreads((prev) => prev.filter((t) => t.requestId !== activeId));
      if (activeId) leaveThread(activeId);
      setHeaderMenu(null);
      setActiveId(null);
      if (typeof window !== "undefined") window.history.replaceState(null, "", "/chats");
      showToast(doneMessage);
    } catch {
      showToast("Could not block member");
    } finally {
      setMoreBusy(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  // A reaction on the newest message makes it taller — stay pinned so the reaction isn't cut off.
  const lastReactionCount = messages[messages.length - 1]?.reactions?.length ?? 0;
  useEffect(() => {
    if (lastReactionCount > 0 && atBottomRef.current) scrollToBottom(true);
  }, [lastReactionCount, scrollToBottom]);

  // When peer is typing and you're at bottom, keep view pinned to latest
  useEffect(() => {
    if (peerTyping && atBottomRef.current) scrollToBottom(true);
  }, [peerTyping, scrollToBottom]);

  // K09 / M02 / M03: on mobile the open thread is pinned to the *visual* viewport, so when the
  // keyboard opens (portrait or landscape) the header and composer both stay on screen instead
  // of iOS scrolling the page up underneath them.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const apply = () => {
      root.setProperty("--chat-vh", `${vv.height}px`);
      root.setProperty("--chat-vtop", `${vv.offsetTop}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.removeProperty("--chat-vh");
      root.removeProperty("--chat-vtop");
    };
  }, []);

  const activeThread = threads.find((t) => t.requestId === activeId) || null;
  // N53: active chats first, then ended ones under "Past matches" (newest first within each).
  const orderedThreads = useMemo(
    () => [...threads.filter((t) => !t.ended), ...threads.filter((t) => t.ended)],
    [threads]
  );
  const requestRows = requestLists ? requestLists[requestSub] : [];
  const openRequest =
    openRequestId && requestLists
      ? [...requestLists.received, ...requestLists.sent].find((c) => c.requestId === openRequestId) ?? null
      : null;
  const openRequestSub: RequestSub =
    openRequest && requestLists?.sent.some((c) => c.requestId === openRequest.requestId) ? "sent" : "received";
  const receivedCount = requestLists?.received.length ?? 0;
  // Either a conversation or a request fills the right pane (the whole screen on mobile).
  const paneOpen = Boolean(activeId || openRequest);

  const requestsUrl = (sub: RequestSub, requestId?: string | null) =>
    `/chats?tab=requests&sub=${sub}${requestId ? `&request=${requestId}` : ""}`;

  function showInbox(next: "chats" | "requests") {
    setInboxTab(next);
    if (next === "chats") {
      setOpenRequestId(null);
      if (!activeId) window.history.replaceState(null, "", "/chats");
    } else {
      window.history.replaceState(null, "", requestsUrl(requestSub, openRequestId));
    }
  }

  function openRequestPane(requestId: string) {
    if (activeId) {
      leaveThread(activeId);
      setActiveId(null);
    }
    setOpenRequestId(requestId);
    window.history.replaceState(null, "", requestsUrl(requestSub, requestId));
  }

  function closeRequestPane() {
    setOpenRequestId(null);
    window.history.replaceState(null, "", requestsUrl(requestSub));
  }
  // C01/C03: the chat identifies members by profile ID, never by name.
  const displayName = peer?.code || activeThread?.peerCode || "Chat";
  const seed = peer?.avatarSeed ?? activeThread?.peerAvatarSeed ?? 1;
  const verified = peer?.verified ?? activeThread?.peerVerified ?? false;

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <ReportDialog
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onDone={(ok, alsoBlock) => {
          const wasMessage = Boolean(reportTarget?.message);
          setReportTarget(null);
          if (!ok) return;
          if (alsoBlock) void blockMember("Reported to the PN team and blocked");
          else showToast(wasMessage ? "Message reported to the PN team" : "Member reported to the PN team");
        }}
      />
      <div className="hidden lg:block">
        <BrowseAppNav profileCode={profileCode} active="messages" unreadCount={unreadCount} />
      </div>

      <div className="lg:max-w-7xl lg:mx-auto lg:px-5 lg:py-6 lg:h-screen">
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-4 lg:h-full lg:min-h-0">
          {/* Inbox */}
          <aside
            className={`${
              paneOpen ? "hidden lg:flex" : "flex"
            } flex-col min-h-screen lg:min-h-0 lg:bg-white lg:rounded-2xl lg:border lg:border-ink-900/8 lg:overflow-hidden`}
          >
            <div className="sticky top-0 z-20 bg-[#faf8f7] lg:bg-white border-b border-ink-900/6 px-4 h-14 flex items-center justify-between lg:rounded-t-2xl">
              <Link href="/browse" className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </Link>
              <h1 className="font-bold text-[17px] text-ink-950">Chats</h1>
              <span
                className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                  connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {connected ? "Live" : "Connecting…"}
              </span>
            </div>

            {/* Only shown over the inbox list — an open thread needs the full mobile viewport
                for its composer, not a persistent tab bar competing for space. */}
            {!paneOpen ? <MobileBottomNavGate active="messages" unreadCount={unreadCount} /> : null}

            <div className="px-4 pt-3 pb-2 bg-[#faf8f7] lg:bg-white">
              <div role="tablist" className="grid grid-cols-2 gap-1 rounded-full bg-ink-900/[0.04] border border-ink-900/6 p-1">
                {(["chats", "requests"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={inboxTab === t}
                    onClick={() => showInbox(t)}
                    className={`h-9 rounded-full flex items-center justify-center gap-1.5 text-[14px] transition ${
                      inboxTab === t
                        ? "bg-white text-ink-950 font-bold shadow-[0_1px_4px_rgba(15,13,14,0.08)]"
                        : "text-ink-700/60 font-medium hover:text-ink-900"
                    }`}
                  >
                    {t === "chats" ? "Chats" : "Requests"}
                    {t === "requests" && receivedCount > 0 ? (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-100 text-rose-600 text-[11px] font-bold flex items-center justify-center">
                        {receivedCount}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              {inboxTab === "requests" ? (
                <div className="mt-2.5 flex gap-1.5">
                  {(["received", "sent"] as const).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setRequestSub(sub);
                        setOpenRequestId(null);
                        window.history.replaceState(null, "", requestsUrl(sub));
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition ${
                        requestSub === sub ? "bg-ink-950 text-white" : "bg-white border border-ink-900/10 text-ink-700 hover:border-ink-900/20"
                      }`}
                    >
                      {sub === "received" ? "Received" : "Sent"}
                      {sub === "received" && receivedCount > 0 ? <span className="ml-1.5 opacity-70">{receivedCount}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto pb-[var(--pn-bottom-nav-h)]">
              {inboxTab === "requests" ? (
                !requestLists ? (
                  <p className="px-6 py-10 text-center text-sm text-ink-700/55">Loading requests…</p>
                ) : requestRows.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <p className="font-bold text-ink-950">
                      {requestSub === "received" ? "No requests waiting" : "No pending requests"}
                    </p>
                    <p className="mt-2 text-sm text-ink-700/65">
                      {requestSub === "received"
                        ? "When someone sends you a Match Request, it shows up here."
                        : "Requests you send stay here until they're answered."}
                    </p>
                  </div>
                ) : (
                  requestRows.map((card) => (
                    <RequestListRow
                      key={card.id}
                      card={card}
                      active={card.requestId === openRequestId}
                      onOpen={() => openRequestPane(card.requestId!)}
                    />
                  ))
                )
              ) : threads.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="font-bold text-ink-950">No conversations yet</p>
                  <p className="mt-2 text-sm text-ink-700/65">
                    Send a match request from Browse. When they accept, you both chat here in realtime.
                  </p>
                  <Link
                    href="/browse"
                    className="inline-block mt-5 px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold"
                  >
                    Browse profiles
                  </Link>
                </div>
              ) : (
                orderedThreads.map((t, i) => {
                  const active = t.requestId === activeId;
                  const firstPast = t.ended && (i === 0 || !orderedThreads[i - 1].ended);
                  return (
                    <Fragment key={t.requestId}>
                    {firstPast ? (
                      <p className="px-4 pt-5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-700/45 border-b border-ink-900/5">
                        Past matches
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenRequestId(null);
                        startTransition(() => {
                          void openThread(t.requestId);
                          window.history.replaceState(null, "", `/chats/${t.requestId}`);
                        });
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-ink-900/5 transition ${t.ended ? "opacity-70" : ""} ${
                        active ? "bg-rose-50/70" : "hover:bg-ink-900/[0.03]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl(t.peerAvatarSeed)}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover shrink-0"
                        style={
                          t.photoVisible ? undefined : { filter: "blur(5px) saturate(0.9)" }
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink-950 truncate flex items-center gap-1">
                            {t.peerCode}
                            {t.peerVerified ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#2563eb">
                                <path d="M12 2l2.4 1.4 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L22 12l-1.4 2.4.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 22l-2.4-1.4-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2 12l1.4-2.4-.3-2.8 2.5-1.2 1.2-2.5 2.8.3Z" />
                              </svg>
                            ) : null}
                          </span>
                          <span className="text-[11px] text-ink-700/50 shrink-0 flex items-center gap-1.5">
                            {t.ended ? (
                              <span className="rounded-full bg-ink-900/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700/60">
                                Ended
                              </span>
                            ) : null}
                            <LocalStamp iso={t.lastAt} variant="list" />
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span
                            className={`text-[13px] truncate ${
                              typingByThread[t.requestId]
                                ? "text-emerald-600 italic font-medium"
                                : "text-ink-700/65"
                            }`}
                          >
                            {typingByThread[t.requestId] ? (
                              "typing…"
                            ) : drafts[t.requestId] && t.requestId !== activeId ? (
                              <>
                                <span className="font-semibold text-rose-600 not-italic">Draft: </span>
                                {drafts[t.requestId]}
                              </>
                            ) : (
                              t.lastMessage || "Say salam…"
                            )}
                          </span>
                          {t.unread > 0 ? (
                            <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
                              {t.unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    </Fragment>
                  );
                })
              )}
            </div>
          </aside>

          {/* Open request (Chats → Requests) */}
          {openRequest ? (
            <section className="flex flex-col max-lg:fixed max-lg:inset-0 max-lg:z-30 max-lg:h-[100dvh] lg:h-full lg:min-h-0 bg-white lg:rounded-2xl lg:border lg:border-ink-900/8 lg:overflow-hidden">
              <RequestChatPane
                key={openRequest.id}
                card={openRequest}
                sub={openRequestSub}
                onBack={closeRequestPane}
                onDone={(action) => {
                  if (action === "accept") return; // the hook opens the new chat
                  setRequestLists((prev) =>
                    prev
                      ? {
                          received: prev.received.filter((c) => c.requestId !== openRequest.requestId),
                          sent: prev.sent.filter((c) => c.requestId !== openRequest.requestId),
                        }
                      : prev
                  );
                  closeRequestPane();
                  showToast(action === "withdraw" ? "Request withdrawn" : action === "decline" ? "Request declined" : "Member blocked");
                }}
              />
            </section>
          ) : null}

          {/* Thread */}
          <section
            onTouchStart={onPaneTouchStart}
            onTouchMove={onPaneTouchMove}
            onTouchEnd={onPaneTouchEnd}
            onTouchCancel={onPaneTouchEnd}
            className={`${
              openRequest ? "hidden" : activeId ? "flex" : "hidden lg:flex"
            } flex-col max-lg:fixed max-lg:inset-x-0 max-lg:z-30 max-lg:top-[var(--chat-vtop,0px)] max-lg:h-[var(--chat-vh,100dvh)] lg:h-full lg:min-h-0 bg-white lg:rounded-2xl lg:border lg:border-ink-900/8 lg:overflow-hidden`}
          >
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <div>
                  <p className="font-bold text-lg text-ink-950">
                    {inboxTab === "requests" ? "Select a request" : "Select a conversation"}
                  </p>
                  <p className="mt-1 text-sm text-ink-700/60">
                    {inboxTab === "requests"
                      ? "Open a request to read the full introduction message."
                      : "Your matches will show on the left."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div
                  ref={headerRef}
                  className="relative sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/6"
                >
                  <div className="px-3 sm:px-4 h-14 flex items-center gap-2">
                    <button
                      type="button"
                      className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5"
                      onClick={() => {
                        if (activeId) leaveThread(activeId);
                        setActiveId(null);
                        window.history.replaceState(null, "", "/chats");
                      }}
                      aria-label="Back"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl(seed)}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                      style={
                        photoVisible
                          ? undefined
                          : { filter: "blur(4px) saturate(0.9)" }
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink-950 flex items-center gap-1 truncate">
                        {displayName}
                        {verified ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="#2563eb" className="shrink-0">
                            <path d="M12 2l2.4 1.4 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L22 12l-1.4 2.4.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 22l-2.4-1.4-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2 12l1.4-2.4-.3-2.8 2.5-1.2 1.2-2.5 2.8.3Z" />
                          </svg>
                        ) : null}
                      </p>
                      <p
                        className={`text-[11px] truncate transition-colors ${
                          peerTyping ? "text-emerald-600 italic font-medium" : "text-ink-700/55"
                        }`}
                      >
                        {peerTyping
                          ? `${displayName} is typing…`
                          : !connected
                            ? "Connecting to chat…"
                            : incomingPrivatePhotoStatus === "shared" || incomingPrivatePhotoStatus === "active"
                              ? "🔒 Private photos available"
                              : photoShared
                                ? "Photo shared"
                                : commMode === "wali_oversight"
                                  ? "Wali oversight · photo private"
                                  : "Matched"}
                      </p>
                    </div>
                    {!matchEnded ? (
                      <button
                        type="button"
                        onClick={() => setShowEndConfirm(true)}
                        className="hidden sm:inline-flex text-[12px] font-semibold text-ink-700/55 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50"
                      >
                        End match
                      </button>
                    ) : null}
                    {!matchEnded ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenu(null);
                          setFamilyModal({ step: "main", via: "manual" });
                        }}
                        disabled={!family}
                        className={`relative w-10 h-10 flex items-center justify-center rounded-full transition disabled:opacity-40 ${
                          family?.shared ? "bg-emerald-50 text-emerald-700" : "text-ink-950 hover:bg-ink-900/5"
                        }`}
                        aria-label="Involve family"
                        title="Involve family"
                      >
                        <FamilyIcon />
                        {family && !family.shared && family.request.state === "pending" ? (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E12D72] ring-2 ring-white" />
                        ) : null}
                      </button>
                    ) : null}
                    {!matchEnded ? (
                      <button
                        type="button"
                        onClick={() => setHeaderMenu((m) => (m === "photo" ? null : "photo"))}
                        className={`relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5 transition ${
                          headerMenu === "photo" ? "bg-rose-50 text-rose-700" : "text-ink-700"
                        }`}
                        aria-label="Private photos"
                        title="Private photos"
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="10" width="14" height="10" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                        {incomingPrivatePhotoStatus === "shared" || incomingPrivatePhotoStatus === "active" ? (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600" />
                        ) : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setHeaderMenu((m) => (m === "more" ? null : "more"))}
                      className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5 transition ${
                        headerMenu === "more" ? "bg-ink-900/10 text-ink-950" : "text-ink-700"
                      }`}
                      aria-label="More options"
                      aria-haspopup="menu"
                      aria-expanded={headerMenu === "more"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                      </svg>
                    </button>
                  </div>
                  <div className="px-4 flex gap-8 text-[15px]">
                    <button
                      type="button"
                      onClick={() => setTab("chat")}
                      className={`pb-2.5 font-semibold ${
                        tab === "chat"
                          ? "text-ink-950 border-b-[3px] border-ink-950"
                          : "text-ink-700/45"
                      }`}
                    >
                      Chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("profile")}
                      className={`pb-2.5 font-semibold ${
                        tab === "profile"
                          ? "text-ink-950 border-b-[3px] border-ink-950"
                          : "text-ink-700/45"
                      }`}
                    >
                      Profile
                    </button>
                  </div>

                  {activeId ? (
                    <PrivatePhotoStatusWatcher
                      requestId={activeId}
                      matchEnded={matchEnded}
                      onStatusChange={setIncomingPrivatePhotoStatus}
                    />
                  ) : null}

                  {/* Photo / More actions live here as popovers to keep the composer uncluttered */}
                  {headerMenu ? (
                    <div
                      role={headerMenu === "more" ? "menu" : undefined}
                      className="absolute right-2 sm:right-4 top-full z-40 w-[min(340px,calc(100vw-1.25rem))] rounded-2xl border border-ink-900/12 bg-white shadow-[0_20px_50px_-18px_rgba(15,13,14,0.45)] overflow-hidden animate-[chatIn_140ms_ease-out]">
                        {headerMenu === "more" ? (
                          <div className="p-1.5">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setTab("profile");
                                setHeaderMenu(null);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-ink-800 hover:bg-ink-900/5"
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                                <circle cx="12" cy="8" r="3.5" />
                                <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
                              </svg>
                              View full profile
                            </button>
                            {!matchEnded ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setHeaderMenu(null);
                                  setShowEndConfirm(true);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-ink-800 hover:bg-ink-900/5"
                              >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                                End match
                              </button>
                            ) : endedByMe ? (
                              <button
                                type="button"
                                role="menuitem"
                                disabled={rematchBusy}
                                onClick={() => void requestRematch()}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-[#c92763] hover:bg-rose-50 disabled:opacity-50"
                              >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
                                  <path d="M12 20s-7-4.3-9-8.6C1.6 8.3 3.4 5 6.8 5c2 0 3.3 1.1 4.2 2.4C11.9 6.1 13.2 5 15.2 5c3.4 0 5.2 3.3 3.8 6.4C17 15.7 12 20 12 20Z" />
                                </svg>
                                <span>
                                  Request rematch
                                  <span className="block text-[11.5px] text-ink-700/55">Costs 1 match token</span>
                                </span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              role="menuitem"
                              disabled={moreBusy}
                              onClick={() => reportMember()}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-ink-800 hover:bg-ink-900/5 disabled:opacity-50"
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                                <path d="M4 21V4h9l1 2h6v9h-7l-1-2H4" />
                              </svg>
                              Report member
                            </button>
                            {blockArmed ? (
                              <div className="px-3 py-2.5">
                                <p className="text-[12px] text-ink-700/70 leading-snug">
                                  Block {displayName || "this member"}? They won&apos;t be able to
                                  reach you and this chat will close.
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={moreBusy}
                                    onClick={() => void blockMember()}
                                    className="flex-1 py-2 rounded-full bg-rose-600 text-white text-[13px] font-semibold disabled:opacity-50"
                                  >
                                    {moreBusy ? "Blocking…" : "Block"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBlockArmed(false)}
                                    className="flex-1 py-2 rounded-full border border-ink-900/12 text-[13px] font-semibold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => setBlockArmed(true)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-rose-700 hover:bg-rose-50"
                              >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="m5.6 5.6 12.8 12.8" />
                                </svg>
                                Block member
                              </button>
                            )}
                          </div>
                        ) : null}
                        {headerMenu === "photo" && activeId ? (
                          <PrivatePhotoShare
                            requestId={activeId}
                            matchEnded={matchEnded}
                            peerName={displayName}
                            variant="dropdown"
                            open
                            onIncomingStatusChange={setIncomingPrivatePhotoStatus}
                          />
                        ) : null}
                    </div>
                  ) : null}
                </div>

                {/* C11/C12: both panes stay mounted on a finger-tracking track — switching never
                    reloads the chat, loses the draft or resets the scroll position. */}
                <div className="relative flex-1 min-h-0 overflow-hidden">
                  <div
                    ref={trackRef}
                    className="flex h-full w-[200%] touch-pan-y"
                    style={{
                      transform: tab === "profile" ? "translateX(-50%)" : "translateX(0)",
                      transition: PANE_TRANSITION,
                    }}
                  >
                    <div className="w-1/2 h-full min-h-0 flex flex-col" inert={tab !== "chat" || undefined}>
                    <div className="relative flex-1 min-h-0 flex flex-col">
                      <div
                        ref={scrollerRef}
                        onScroll={onScrollThread}
                        className={`flex-1 overflow-y-auto px-3 sm:px-5 pt-3 space-y-3 scroll-smooth ${peerTyping ? "pb-14" : "pb-4"}`}
                      >
                      <ChatNotifyBanner />

                      {loadingThread ? (
                        <p className="text-center text-sm text-ink-700/50 py-10">Loading…</p>
                      ) : (
                        <>
                        {hasMoreOlder ? (
                          <button
                            type="button"
                            onClick={() => void loadOlderMessages()}
                            disabled={loadingOlder}
                            className="mx-auto block px-3 py-1.5 rounded-full border border-ink-900/10 bg-white text-[12px] font-medium text-ink-700/70 disabled:opacity-50"
                          >
                            {loadingOlder ? "Loading…" : "Load earlier messages"}
                          </button>
                        ) : null}
                        {grouped.map((item) =>
                          item.type === "day" ? (
                            <p key={item.key} className="text-center py-2">
                              <span className="inline-block rounded-full bg-white/90 border border-ink-900/6 px-3 py-1 text-[11.5px] font-medium text-ink-700/60 shadow-sm">
                                <LocalStamp iso={item.iso ?? null} variant="day" />
                              </span>
                            </p>
                          ) : item.type === "unread" ? (
                            <div key={item.key} className="flex items-center gap-3 py-1.5" role="separator">
                              <span className="h-px flex-1 bg-rose-200" />
                              <span className="rounded-full bg-rose-50 px-3 py-1 text-[11.5px] font-semibold text-rose-700">
                                {unreadMarker?.count} unread message{unreadMarker?.count === 1 ? "" : "s"}
                              </span>
                              <span className="h-px flex-1 bg-rose-200" />
                            </div>
                          ) : item.type === "family" && item.event ? (
                            <FamilyStatusLine key={item.key} kind={item.event.kind} peerCode={displayName} />
                          ) : item.msg ? (
                            <MessageBubble
                              key={item.key}
                              msg={item.msg}
                              mine={item.msg.senderId === userId}
                              peerName={displayName}
                              currentUserId={userId}
                              onReply={(m) => {
                                setReplyTo(m);
                                inputRef.current?.focus();
                              }}
                              onReact={(m, emoji) => void reactToMessage(m.id, emoji)}
                              onCopy={(m) => void copyMessage(m)}
                              onReport={(m) => reportMessage(m)}
                              onRetry={(m) => void retryMessage(m)}
                              locked={matchEnded}
                              waliContacted={Boolean(family?.contacted)}
                              onWaliAction={noteWaliAction}
                            />
                          ) : null
                        )}
                        </>
                      )}

                      </div>

                      {/* Jump to latest — WhatsApp-style */}
                      {!atBottom ? (
                        <button
                          type="button"
                          onClick={() => {
                            scrollToBottom(true);
                            if (activeId) {
                              markRead(activeId);
                              void fetch(`/api/chats/${activeId}/read`, { method: "POST" });
                            }
                          }}
                          className="absolute bottom-3 right-3 sm:right-5 z-10 w-10 h-10 rounded-full bg-white border border-ink-900/10 shadow-[0_8px_24px_-8px_rgba(15,13,14,0.45)] flex items-center justify-center text-ink-700 hover:text-rose-600 hover:border-rose-200 transition animate-[chatIn_160ms_ease-out]"
                          aria-label="Jump to latest messages"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                          {unseenCount > 0 ? (
                            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                              {unseenCount > 99 ? "99+" : unseenCount}
                            </span>
                          ) : null}
                        </button>
                      ) : null}

                      {/* C03: typing indicator pinned to the bottom, just above the message box. */}
                      {peerTyping ? (
                        <div className="absolute bottom-2 left-3 sm:left-5 z-10 pointer-events-none animate-[chatIn_160ms_ease-out]">
                          <div className="flex items-center gap-2 bg-[#f1eeef] rounded-2xl rounded-bl-md px-3 py-2 shadow-sm">
                            <span className="text-[11.5px] text-ink-700/70 font-medium">{displayName} is typing</span>
                            <span className="flex gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-700/40 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-700/40 animate-bounce [animation-delay:120ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-700/40 animate-bounce [animation-delay:240ms]" />
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {toast ? (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-ink-950 text-white text-[13px] font-medium shadow-[0_8px_24px_-8px_rgba(15,13,14,0.5)] animate-[chatIn_160ms_ease-out]">
                          {toast}
                        </div>
                      ) : null}
                    </div>

                    {/* Composer / Photo share */}
                    <div className="border-t border-ink-900/6 bg-white px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                      {matchEnded && endedByMe ? (
                        <div className="@container mb-2">
                          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5 flex flex-col @md:flex-row @md:items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-ink-950">This match has ended</p>
                              <p className="mt-0.5 text-[13px] text-ink-700/70 leading-relaxed">
                                You can read past messages but cannot send new ones. Match ended by you
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={rematchBusy}
                              onClick={() => void requestRematch()}
                              className="shrink-0 flex items-center justify-center gap-3 px-5 py-2 rounded-full bg-[#e0306f] hover:bg-[#c92763] text-white shadow-sm disabled:opacity-60 transition"
                            >
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M12 21s-7.5-4.6-9.7-9.3C.8 8.4 2.7 4.5 6.5 4.5c2.2 0 3.6 1.2 4.5 2.6.9-1.4 2.3-2.6 4.5-2.6 3.8 0 5.7 3.9 4.2 7.2C19.5 16.4 12 21 12 21Z" />
                              </svg>
                              <span className="text-left leading-tight">
                                <span className="block text-[14px] font-semibold">{rematchBusy ? "Sending…" : "Request Rematch"}</span>
                                <span className="block text-[11.5px] text-white/85">Costs 1 match token</span>
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : matchEnded ? (
                        <div className="mb-2 rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3.5">
                          <p className="text-sm font-bold text-ink-950">This match has ended</p>
                          <p className="mt-0.5 text-[13px] text-ink-700/70 leading-relaxed">
                            You can read past messages but cannot send new ones.{" "}
                            {endReason === "admin"
                              ? "Match closed by the Pashtun Nikah team."
                              : `Match ended by ${displayName}.`}
                          </p>
                        </div>
                      ) : (
                        <>
                          {replyTo ? (
                            <div className="mb-2 flex items-start gap-2 rounded-xl bg-[#f7f4f2] px-3 py-2">
                              <div
                                className="flex-1 min-w-0"
                                style={{ borderLeft: "3px solid #aa1945", paddingLeft: 10 }}
                              >
                                <p className="text-[12px] font-semibold" style={{ color: "#aa1945" }}>
                                  {replyTo.senderId === userId ? "You" : displayName}
                                </p>
                                <p className="text-[13px] text-ink-700 truncate">{replyTo.body}</p>
                              </div>
                              <button
                                type="button"
                                className="text-ink-700/40 hover:text-ink-900 text-lg leading-none px-1"
                                onClick={() => setReplyTo(null)}
                                aria-label="Cancel reply"
                              >
                                ×
                              </button>
                            </div>
                          ) : null}

                          {family?.card && !familyModal ? (
                            <FamilyPromptCard
                              family={family}
                              busy={familyBusy}
                              act={familyAct}
                              onShare={(via) => setFamilyModal({ step: "confirm", via })}
                              onInvolve={() => setFamilyModal({ step: "main", via: "auto" })}
                            />
                          ) : null}

                          {chatWarning ? (
                            <p className="mb-2 text-[13px] font-semibold text-red-600 leading-snug">
                              {chatWarning}
                            </p>
                          ) : null}

                          {chatConsent === false ? (
                            <div className="@container mb-3">
                            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 px-3.5 py-3.5 @xl:px-4 flex flex-col @xl:flex-row @xl:items-center gap-3 @xl:gap-4">
                              <div className="flex gap-3 min-w-0 flex-1">
                                <span className="shrink-0 w-10 h-10 @xl:w-11 @xl:h-11 rounded-full bg-rose-100/80 flex items-center justify-center" aria-hidden>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 9.5 4-1.2 7-5 7-9.5V6Z" />
                                    <path d="m9 12 2 2 4-4" />
                                  </svg>
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[12px] text-ink-700/70">Before you message!</p>
                                  <p className="text-[15px] font-semibold text-ink-950 leading-snug">Keep conversations respectful</p>
                                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-700/80">
                                    Please follow the{" "}
                                    <Link href={COMMUNITY_GUIDELINES_HREF} className="text-blue-600 underline underline-offset-2">
                                      Pashtun Nikah
                                    </Link>{" "}
                                    community guidelines and keep conversations respectful. Avoid sharing phone numbers, social
                                    media handles, emails or other private contact details. If there is compatibility, family
                                    involvement is strongly encouraged. Failure to abide by the guidelines may result in account
                                    suspension.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeId) {
                                    localStorage.setItem(`chat-consent-${activeId}`, "1");
                                    void fetch(`/api/chats/${activeId}/consent`, { method: "POST" }).catch(() => {});
                                  }
                                  setChatConsent(true);
                                }}
                                className="shrink-0 self-stretch @xl:self-center px-6 h-11 rounded-full bg-[#e0306f] hover:bg-[#c92763] text-white text-[14px] font-semibold shadow-sm transition"
                              >
                                I understand
                              </button>
                            </div>
                            </div>
                          ) : null}

                          <form onSubmit={onSubmit} className="flex items-end gap-2">
                            <div className="flex-1 flex items-end rounded-full border border-ink-900/10 bg-[#faf8f7] focus-within:bg-white focus-within:border-rose-300 focus-within:ring-3 focus-within:ring-rose-600/10 pl-4 pr-2 py-1.5 transition">
                              <textarea
                                ref={inputRef}
                                rows={1}
                                value={text}
                                onChange={(e) => onTextChange(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void onSubmit(e);
                                  }
                                }}
                                placeholder={`Message ${displayName}`}
                                className="flex-1 resize-none bg-transparent text-[15px] outline-none max-h-28 py-2 leading-snug"
                              />
                              <span className="flex items-center gap-0.5 pb-1 text-ink-700/45">
                                <EmojiPicker onSelect={insertEmoji} />
                                <button
                                  type="button"
                                  className="w-8 h-8 rounded-full hover:bg-ink-900/5 flex items-center justify-center"
                                  aria-label="Attach"
                                  disabled
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <path d="m21.4 11.6-8.5 8.5a5 5 0 0 1-7.1-7.1l9.2-9.2a3.2 3.2 0 0 1 4.5 4.5l-9.2 9.1a1.4 1.4 0 1 1-2-2l8.1-8" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                            <button
                              type="submit"
                              disabled={!text.trim()}
                              className="w-11 h-11 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-rose-700 transition shadow-[0_8px_20px_-10px_rgba(170,25,69,0.7)]"
                              aria-label="Send"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3.4 20.6 21 12 3.4 3.4 3 10l11 2-11 2z" />
                              </svg>
                            </button>
                          </form>
                        </>
                      )}
                    </div>

                    {familyModal && family && !matchEnded ? (
                      <FamilyModal
                        family={family}
                        state={familyModal}
                        busy={familyBusy}
                        act={familyAct}
                        onStep={setFamilyModal}
                        onClose={() => setFamilyModal(null)}
                        onWaliAction={noteWaliAction}
                      />
                    ) : null}
                    {showEndConfirm ? (
                      <EndMatchConfirm
                        busy={endBusy}
                        onConfirm={() => void endMatchHandler()}
                        onCancel={() => setShowEndConfirm(false)}
                      />
                    ) : null}
                    </div>
                    <div className="w-1/2 h-full min-h-0 flex flex-col" inert={tab !== "profile" || undefined}>
                  <div className="flex-1 overflow-y-auto">
                    {!peerProfile ? (
                      <p className="text-center text-sm text-ink-700/50 py-16">Loading profile…</p>
                    ) : (
                      <>
                        {activeId ? (
                          <PrivatePhotoShare
                            requestId={activeId}
                            matchEnded={matchEnded}
                            peerName={displayName}
                            variant="banner"
                            onIncomingStatusChange={setIncomingPrivatePhotoStatus}
                          />
                        ) : null}
                        <ProfileDesktop
                          profile={peerProfile}
                          embedded
                          hideNav
                          photoOverrideUrl={peerProfile.photoUrl}
                          photoOverrideVisible={photoVisible}
                          photoAction={
                            activeId &&
                            !matchEnded &&
                            (incomingPrivatePhotoStatus === "shared" || incomingPrivatePhotoStatus === "active") ? (
                              <button
                                type="button"
                                onClick={() => openPrivatePhotos(activeId)}
                                className="inline-flex items-center gap-2 px-5 h-11 rounded-full bg-white/95 text-ink-950 text-[14px] font-semibold shadow-[0_8px_24px_-8px_rgba(15,13,14,0.5)] backdrop-blur hover:bg-white transition"
                              >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                View photo here
                              </button>
                            ) : null
                          }
                        />
                      </>
                    )}
                  </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
