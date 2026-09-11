"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ChatMessageDTO, ChatThreadDTO, PhotoOnceStatus, ReactionSummary } from "@/lib/chat";
import type { ProfileView } from "@/lib/profile";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { WaliHandoverPanel } from "@/components/chat/wali-handover-panel";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { MessageActionMenu } from "@/components/chat/message-action-menu";
import { ProfileDesktop } from "@/components/profile/profile-desktop";

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
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
}: {
  msg: ChatMessageDTO;
  mine: boolean;
  peerName: string;
  currentUserId: string;
  onReply: (m: ChatMessageDTO) => void;
  onReact: (m: ChatMessageDTO, emoji: string) => void;
  onCopy: (m: ChatMessageDTO) => void;
  onReport: (m: ChatMessageDTO) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <div className={`relative max-w-[82%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        {msg.type === "contact_card" && msg.card ? (
          <div className="rounded-[18px] rounded-br-md sm:min-w-[220px] bg-white border border-indigo-100 shadow-sm px-4 py-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10" r="2" />
              </svg>
              Wali Contact Card
            </p>
            <p className="mt-1.5 font-bold text-ink-950">{msg.card.name}</p>
            {msg.card.contact ? (
              <a
                href={`https://wa.me/${msg.card.contact.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-rose-600 font-semibold text-sm"
              >
                {msg.card.contact}
              </a>
            ) : null}
            {msg.card.email ? <p className="mt-0.5 text-xs text-ink-700/55">{msg.card.email}</p> : null}
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
            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
            {mine ? (
              <span className="float-right mt-1 ml-2 translate-y-0.5">
                <DoubleCheck read={msg.isRead} />
              </span>
            ) : null}
          </div>
        )}

        {msg.reactions && msg.reactions.length > 0 ? (
          <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
            {msg.reactions.map((r) => {
              const reactedByMe = r.userIds.includes(currentUserId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(msg, r.emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[12px] border transition ${
                    reactedByMe
                      ? "bg-rose-50 border-rose-200 text-rose-700"
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
          onClick={() => setMenuOpen((v) => !v)}
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
          mine={mine}
          open={menuOpen}
          canReport={!mine}
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

export function ChatApp({
  initialThreads,
  userId,
  profileCode,
  initialRequestId = null,
  unreadCount = 0,
  userRealtimeTopic,
}: {
  initialThreads: ChatThreadDTO[];
  userId: string;
  profileCode?: string | null;
  initialRequestId?: string | null;
  unreadCount?: number;
  userRealtimeTopic: string;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(initialRequestId);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [tab, setTab] = useState<"chat" | "profile">("chat");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessageDTO | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [typingByThread, setTypingByThread] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [photoShared, setPhotoShared] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [canSharePhoto, setCanSharePhoto] = useState(false);
  const [isFemaleViewer, setIsFemaleViewer] = useState(false);
  const [contactCardBusy, setContactCardBusy] = useState(false);
  const [peerProfile, setPeerProfile] = useState<ProfileView | null>(null);
  const [photoOnceStatus, setPhotoOnceStatus] = useState<PhotoOnceStatus>("none");
  const [canSendPhotoOnce, setCanSendPhotoOnce] = useState(false);
  const [canRevealPhotoOnce, setCanRevealPhotoOnce] = useState(false);
  const [photoOnceBusy, setPhotoOnceBusy] = useState(false);
  const [revealedPhotoUrl, setRevealedPhotoUrl] = useState<string | null>(null);
  const [revealedAvatarSeed, setRevealedAvatarSeed] = useState<number | null>(null);
  const [commMode, setCommMode] = useState<string>("standard");
  const [wali, setWali] = useState<{
    name: string;
    contact: string | null;
    email: string | null;
  } | null>(null);
  const [shareConfirm, setShareConfirm] = useState(false);
  const [headerMenu, setHeaderMenu] = useState<"wali" | "photo" | "more" | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [blockArmed, setBlockArmed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [chatWarning, setChatWarning] = useState<string | null>(null);
  const [matchEnded, setMatchEnded] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [chatConsent, setChatConsent] = useState(true);
  const [, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<ChatMessageDTO[]>([]);
  const hasMoreOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const prependAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const bootScrollDoneRef = useRef(false);
  const canPageOlderRef = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingClear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerMenu !== "more") setBlockArmed(false);
    if (!headerMenu) return;
    function onDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
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
    sendContactCard,
    on,
  } = useChatSocket(true, userId);

  useEffect(() => {
    void joinUser(userRealtimeTopic);
  }, [joinUser, userRealtimeTopic]);

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
        if (!res.ok) return;
        setPeer(data.peer);
        setMessages(data.messages || []);
        messagesRef.current = data.messages || [];
        setHasMoreOlder(Boolean(data.hasMore));
        hasMoreOlderRef.current = Boolean(data.hasMore);
        setActiveId(requestId);
        setPhotoShared(Boolean(data.photoShared));
        setPhotoVisible(Boolean(data.photoVisible));
        setCanSharePhoto(Boolean(data.canSharePhoto));
        setIsFemaleViewer(Boolean(data.isFemaleViewer));
        setCommMode(data.communicationMode || "standard");
        setWali(data.wali || null);
        setShareConfirm(false);
        setHeaderMenu(null);
        setPeerProfile(data.peerProfile || null);
        setPhotoOnceStatus(data.photoOnceStatus || "none");
        setCanSendPhotoOnce(Boolean(data.canSendPhotoOnce));
        setCanRevealPhotoOnce(Boolean(data.canRevealPhotoOnce));
        setRevealedPhotoUrl(null);
        setRevealedAvatarSeed(null);
        setMatchEnded(Boolean(data.matchEnded));
        setEndReason(data.endReason ?? null);
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
    [joinThread, markRead, scrollToBottom]
  );

  // Re-join active thread after reconnect
  useEffect(() => {
    if (!activeId || typeof window === "undefined") return;
    setChatConsent(localStorage.getItem(`chat-consent-${activeId}`) === "1");
  }, [activeId]);

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
        }, 4000);
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

    const offs = [
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

  const grouped = useMemo(() => {
    const items: { type: "day" | "msg"; key: string; iso?: string; msg?: ChatMessageDTO }[] = [];
    let lastDay = "";
    for (const msg of messages) {
      const day = new Date(msg.createdAt).toISOString().slice(0, 10);
      if (day !== lastDay) {
        items.push({ type: "day", key: `d-${day}-${msg.id}`, iso: msg.createdAt });
        lastDay = day;
      }
      items.push({ type: "msg", key: msg.id, msg });
    }
    return items;
  }, [messages]);

  // Leaving the Profile tab unmounts and remounts the message scroller (scrollTop 0),
  // so ask the effect below to re-pin to the newest message when we come back.
  const prevTabRef = useRef(tab);
  useLayoutEffect(() => {
    if (prevTabRef.current === "profile" && tab === "chat") {
      bootScrollDoneRef.current = false;
      canPageOlderRef.current = false;
    }
    prevTabRef.current = tab;
  }, [tab]);

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
      setShowEndConfirm(false);
      setThreads((prev) => prev.filter((t) => t.requestId !== activeId));
      setToast("Match ended");
    } finally {
      setEndBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (matchEnded || !chatConsent) return;
    const body = text.trim();
    if (!body || !activeId || !peer) return;
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessageDTO = {
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
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setReplyTo(null);
    emitTyping(activeId, false);
    scrollToBottom(true);
    inputRef.current?.focus();

    const sent = await sendMessage({
      requestId: activeId,
      body,
      replyToId: replyTo?.id ?? null,
      clientId,
    });

    if (sent.ok) {
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? { ...sent.message, clientId } : m))
      );
      setChatWarning(null);
      return;
    }

    if ("warning" in sent && sent.warning) {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      setChatWarning(sent.error);
      return;
    }

    // REST fallback
    const res = await fetch(`/api/chats/${activeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, replyToId: replyTo?.id ?? null, clientId }),
    });
    const data = await res.json();
    if (res.ok && data.message) {
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? { ...data.message, clientId } : m))
      );
      setChatWarning(null);
    } else {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      if (data.warning) {
        setChatWarning(data.error || "That message wasn't sent.");
      } else {
        showToast(data.error || "Could not send");
      }
    }
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
    emitTyping(activeId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(activeId, false), 1200);
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

  async function reportMessage(m: ChatMessageDTO) {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: m.senderId,
          reason: `Reported message: "${m.body.slice(0, 300)}"`,
        }),
      });
      showToast(res.ok ? "Message reported" : "Could not report message");
    } catch {
      showToast("Could not report message");
    }
  }

  async function reportMember() {
    if (!peer || moreBusy) return;
    setMoreBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: peer.userId,
          reason: `Reported ${peer.code} from chat`,
        }),
      });
      showToast(res.ok ? "Member reported to the PN team" : "Could not report member");
    } catch {
      showToast("Could not report member");
    } finally {
      setMoreBusy(false);
      setHeaderMenu(null);
    }
  }

  async function blockMember() {
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
      showToast("Member blocked");
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

  async function sendContactCardHandler() {
    if (!activeId || contactCardBusy) return;
    setContactCardBusy(true);
    try {
      const viaSocket = await sendContactCard(activeId);
      if (viaSocket.message) {
        // The server also broadcasts this over "message:new" to everyone in the thread room,
        // including us — let that (deduped by id in onNew) add it, so we don't double-add here.
        scrollToBottom(true);
        return;
      }
      if (viaSocket.error && viaSocket.error !== "offline") {
        showToast(viaSocket.error);
        return;
      }
      const res = await fetch(`/api/chats/${activeId}/contact-card`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not send contact card");
        return;
      }
      setMessages((prev) => [...prev, data.message]);
      scrollToBottom(true);
    } finally {
      setContactCardBusy(false);
    }
  }

  // When peer is typing and you're at bottom, keep view pinned to latest
  useEffect(() => {
    if (peerTyping && atBottomRef.current) scrollToBottom(true);
  }, [peerTyping, scrollToBottom]);

  const activeThread = threads.find((t) => t.requestId === activeId) || null;
  const displayName = peer?.name?.split(" ")[0] || activeThread?.peerName.split(" ")[0] || "Chat";
  const seed = peer?.avatarSeed ?? activeThread?.peerAvatarSeed ?? 1;
  const verified = peer?.verified ?? activeThread?.peerVerified ?? false;

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <div className="hidden lg:block">
        <BrowseAppNav profileCode={profileCode} active="messages" unreadCount={unreadCount} />
      </div>

      <div className="lg:max-w-7xl lg:mx-auto lg:px-5 lg:py-6 lg:h-screen">
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-4 lg:h-full lg:min-h-0">
          {/* Inbox */}
          <aside
            className={`${
              activeId ? "hidden lg:flex" : "flex"
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

            <div className="flex-1 overflow-y-auto">
              {threads.length === 0 ? (
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
                threads.map((t) => {
                  const active = t.requestId === activeId;
                  return (
                    <button
                      key={t.requestId}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          void openThread(t.requestId);
                          window.history.replaceState(null, "", `/chats/${t.requestId}`);
                        });
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-ink-900/5 transition ${
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
                          <span className="text-[11px] text-ink-700/50 shrink-0">
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
                            {typingByThread[t.requestId]
                              ? "typing…"
                              : t.lastMessage || "Say salam…"}
                          </span>
                          {t.unread > 0 ? (
                            <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
                              {t.unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Thread */}
          <section
            onTouchStart={(e) => {
              if (!activeId || typeof window === "undefined" || window.innerWidth >= 1024) return;
              const t = e.touches[0];
              swipeStart.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              const start = swipeStart.current;
              swipeStart.current = null;
              if (!start) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              // Only a deliberate, mostly-horizontal drag switches panes.
              if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
              if (dx < 0) setTab("profile"); // swipe left → Profile
              else setTab("chat"); // swipe right → back to Chat
            }}
            className={`${
              activeId ? "flex" : "hidden lg:flex"
            } flex-col h-dvh lg:h-full lg:min-h-0 bg-white lg:rounded-2xl lg:border lg:border-ink-900/8 lg:overflow-hidden`}
          >
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-center px-6">
                <div>
                  <p className="font-bold text-lg text-ink-950">Select a conversation</p>
                  <p className="mt-1 text-sm text-ink-700/60">Your matches will show on the left.</p>
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
                            : photoShared
                              ? "Photo shared"
                              : commMode === "wali_oversight"
                                ? "Wali oversight · photo private"
                                : peer?.code || activeThread?.peerCode}
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
                        onClick={() => setHeaderMenu((m) => (m === "wali" ? null : "wali"))}
                        className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5 transition ${
                          headerMenu === "wali" ? "bg-indigo-50 text-indigo-700" : "text-ink-700"
                        }`}
                        aria-label="Wali handover"
                        title="Wali"
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
                        </svg>
                      </button>
                    ) : null}
                    {!matchEnded && (canSharePhoto || canSendPhotoOnce) ? (
                      <button
                        type="button"
                        onClick={() => setHeaderMenu((m) => (m === "photo" ? null : "photo"))}
                        className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5 transition ${
                          headerMenu === "photo" ? "bg-rose-50 text-rose-700" : "text-ink-700"
                        }`}
                        aria-label="Photo sharing"
                        title="Photo"
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L20 6h-1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
                          <circle cx="12" cy="12.5" r="3.5" />
                        </svg>
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

                  {/* Wali / Photo actions live here as popovers to keep the composer uncluttered */}
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
                            ) : null}
                            <button
                              type="button"
                              role="menuitem"
                              disabled={moreBusy}
                              onClick={() => void reportMember()}
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
                                  Block {peer?.name?.split(" ")[0] || "this member"}? They won&apos;t be able to
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
                        {headerMenu === "wali" ? (
                          <div className="max-h-[70vh] overflow-y-auto p-1.5">
                            <WaliHandoverPanel
                              requestId={activeId}
                              isFemaleViewer={isFemaleViewer}
                              wali={wali}
                              onShareContactCard={async () => {
                                await sendContactCardHandler();
                              }}
                            />
                          </div>
                        ) : null}
                        {headerMenu === "photo" ? (
                          <div className="p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-700/55">
                              Photo
                            </p>
                            {shareConfirm ? (
                              <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                                <p className="text-[13px] text-ink-800 leading-relaxed">
                                  Once shared, your matched member will be able to view your profile photo. You
                                  can hide it again at any time.
                                </p>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={photoBusy}
                                    onClick={() => void togglePhotoShare(true)}
                                    className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
                                  >
                                    Show Photo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShareConfirm(false)}
                                    className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-col gap-2">
                                {canSharePhoto ? (
                                  <button
                                    type="button"
                                    disabled={photoBusy}
                                    onClick={() =>
                                      photoShared
                                        ? void togglePhotoShare(false)
                                        : setShareConfirm(true)
                                    }
                                    className="w-full py-2.5 rounded-full border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    {photoBusy
                                      ? "Saving…"
                                      : photoShared
                                        ? "Hide my photo"
                                        : "Show my photo"}
                                  </button>
                                ) : null}

                                {canSendPhotoOnce ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={photoOnceBusy}
                                      onClick={() => void sendPhotoOnceHandler()}
                                      className="flex-1 py-2.5 rounded-full border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50"
                                    >
                                      {photoOnceBusy
                                        ? "Sending…"
                                        : photoOnceStatus === "none"
                                          ? "Send a one-time photo"
                                          : "Send a new one-time photo"}
                                    </button>
                                    {photoOnceStatus === "pending" ? (
                                      <span className="shrink-0 text-[11px] font-semibold text-amber-700">
                                        Sent · not viewed
                                      </span>
                                    ) : photoOnceStatus === "viewed" ? (
                                      <span className="shrink-0 text-[11px] font-semibold text-emerald-700">
                                        Viewed
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}

                                <p className="text-[11px] text-ink-700/55 leading-snug">
                                  <span className="font-semibold">Show my photo</span> stays visible until you
                                  hide it. <span className="font-semibold">One-time photo</span> can be opened
                                  once, then it disappears.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : null}
                    </div>
                  ) : null}
                </div>

                {tab === "profile" ? (
                  <div className="flex-1 overflow-y-auto">
                    {!peerProfile ? (
                      <p className="text-center text-sm text-ink-700/50 py-16">Loading profile…</p>
                    ) : (
                      <>
                        {!isFemaleViewer && canRevealPhotoOnce ? (
                          <div className="m-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-ink-950 text-sm">One-time photo available</p>
                              <p className="text-xs text-ink-700/70 mt-0.5">
                                Tap to reveal — it can only be viewed once.
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={photoOnceBusy}
                              onClick={() => void revealPhotoOnceHandler()}
                              className="shrink-0 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
                            >
                              {photoOnceBusy ? "Revealing…" : "Reveal"}
                            </button>
                          </div>
                        ) : null}
                        {!isFemaleViewer && (revealedPhotoUrl !== null || revealedAvatarSeed !== null) ? (
                          <div className="m-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800 font-medium">
                            This one-time photo has been revealed and won&apos;t be shown again.
                          </div>
                        ) : null}
                        {!isFemaleViewer &&
                        !canRevealPhotoOnce &&
                        photoOnceStatus === "viewed" &&
                        revealedPhotoUrl === null &&
                        revealedAvatarSeed === null ? (
                          <div className="m-4 rounded-2xl border border-ink-900/8 bg-ink-900/[0.02] p-3 text-xs text-ink-700/60 font-medium">
                            One-time photo already viewed.
                          </div>
                        ) : null}
                        <ProfileDesktop
                          profile={peerProfile}
                          embedded
                          hideNav
                          photoOverrideUrl={
                            revealedPhotoUrl !== null || revealedAvatarSeed !== null
                              ? revealedPhotoUrl || avatarUrl(revealedAvatarSeed ?? seed)
                              : peerProfile.photoUrl
                          }
                          photoOverrideVisible={
                            revealedPhotoUrl !== null || revealedAvatarSeed !== null
                              ? true
                              : photoVisible
                          }
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative flex-1 min-h-0 flex flex-col">
                      <div
                        ref={scrollerRef}
                        onScroll={onScrollThread}
                        className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 space-y-3 scroll-smooth"
                      >
                      {banner ? (
                        <div className="rounded-2xl px-3.5 py-3 flex items-center gap-3 bg-gradient-to-r from-[#eef2ff] to-[#f5f0ff] border border-indigo-100">
                          <p className="flex-1 text-[13px] text-ink-900 leading-snug">
                            Love moves fast. Make sure you&apos;re notified.
                          </p>
                          <button
                            type="button"
                            className="shrink-0 px-3 py-1.5 rounded-full bg-[#4f6ef7] text-white text-xs font-semibold"
                            onClick={() => setBanner(false)}
                          >
                            Notify me
                          </button>
                          <button
                            type="button"
                            className="shrink-0 text-ink-700/40"
                            onClick={() => setBanner(false)}
                            aria-label="Dismiss"
                          >
                            ×
                          </button>
                        </div>
                      ) : null}

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
                            <p key={item.key} className="text-center text-[12px] text-ink-700/45 py-2">
                              <LocalStamp iso={item.iso ?? null} variant="day" />
                            </p>
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
                              onReport={(m) => void reportMessage(m)}
                            />
                          ) : null
                        )}
                        </>
                      )}

                      {peerTyping ? (
                        <div className="flex justify-start animate-[chatIn_180ms_ease-out]">
                          <div className="bg-[#f1eeef] rounded-2xl rounded-bl-md px-3.5 py-2.5 min-w-[72px]">
                            <p className="text-[11px] text-emerald-700/80 font-medium mb-1.5">
                              {displayName} is typing
                            </p>
                            <div className="flex gap-1.5 px-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-700/35 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-700/35 animate-bounce [animation-delay:120ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-ink-700/35 animate-bounce [animation-delay:240ms]" />
                            </div>
                          </div>
                        </div>
                      ) : null}
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

                      {toast ? (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-ink-950 text-white text-[13px] font-medium shadow-[0_8px_24px_-8px_rgba(15,13,14,0.5)] animate-[chatIn_160ms_ease-out]">
                          {toast}
                        </div>
                      ) : null}
                    </div>

                    {/* Composer / Photo share */}
                    <div className="border-t border-ink-900/6 bg-white px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                      {matchEnded ? (
                        <div className="rounded-2xl border border-ink-900/8 bg-[#faf8f7] px-4 py-4 mb-2">
                          <p className="text-sm font-bold text-ink-950">This match has ended</p>
                          <p className="mt-1 text-[13px] text-ink-700/70 leading-relaxed">
                            You can read past messages but cannot send new ones.
                            {endReason ? ` Reason: ${endReason.replace(/_/g, " ")}.` : ""}
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

                          {chatWarning ? (
                            <p className="mb-2 text-[13px] font-semibold text-red-600 leading-snug">
                              {chatWarning}
                            </p>
                          ) : null}

                          {!chatConsent ? (
                            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                              <p className="font-semibold">Before you message</p>
                              <p className="mt-1 text-[13px] leading-relaxed text-amber-900/85">
                                Keep conversations respectful and within Pashtun Nikah guidelines. Do not share private
                                contact details until you and your families are ready.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeId) localStorage.setItem(`chat-consent-${activeId}`, "1");
                                  setChatConsent(true);
                                }}
                                className="mt-2 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold"
                              >
                                I understand — continue
                              </button>
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

                    {showEndConfirm ? (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
                          <h3 className="text-lg font-bold text-ink-950">End this match?</h3>
                          <p className="mt-2 text-sm text-ink-700/70 leading-relaxed">
                            The conversation will become read-only. You can still view past messages. This cannot be
                            undone.
                          </p>
                          <div className="mt-5 flex gap-2">
                            <button
                              type="button"
                              disabled={endBusy}
                              onClick={() => void endMatchHandler()}
                              className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
                            >
                              {endBusy ? "Ending…" : "Yes, end match"}
                            </button>
                            <button
                              type="button"
                              disabled={endBusy}
                              onClick={() => setShowEndConfirm(false)}
                              className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
