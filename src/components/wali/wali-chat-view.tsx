"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatMessageDTO } from "@/lib/chat";
import type { ProfileView } from "@/lib/profile";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useRouter } from "next/navigation";
import { ActivityDot } from "@/components/activity-dot";
import { ProfileDesktop } from "@/components/profile/profile-desktop";

const PANE_TRANSITION = "transform 260ms cubic-bezier(0.22, 0.8, 0.3, 1)";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Wali oversight conversation — laid out exactly like a member's chat (header with the match's
 * blurred photo, ID and activity; Chat / Profile tabs with the same drag-to-switch gesture; the
 * same bubbles and reactions) but strictly read-only: no composer, no Involve family, no photo
 * sharing, no reacting. The member the wali oversees is on the right, the match on the left.
 */
export function WaliChatView({
  requestId,
  profileUserId,
  peerName,
  peerCode,
  wardCode,
  initialMessages,
  ended = false,
  peerAvatarUrl,
  peerStatusLabel,
  peerProfile,
  backHref = "/wali",
  photoSlot,
}: {
  requestId: string;
  profileUserId: string;
  peerName: string;
  peerCode: string;
  /** The member this wali oversees (W03: "PNF565's chat with PNM681"). */
  wardCode: string;
  initialMessages: ChatMessageDTO[];
  /** An ended match is read-only history — show "Match ended" instead of the activity status. */
  ended?: boolean;
  peerAvatarUrl: string;
  peerStatusLabel?: string;
  /** The match's profile for the Profile tab (name already replaced by their ID). */
  peerProfile: ProfileView | null;
  backHref?: string;
  /** Shared-photo access card for the wali, shown at the top of the conversation. */
  photoSlot?: ReactNode;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [tab, setTab] = useState<"chat" | "profile">("chat");
  const router = useRouter();
  // Live messages arrive on this wali link's own topic, joined by WaliRevocationGuard — the
  // server stops publishing to it the moment access is revoked.
  const { on } = useChatSocket(true, profileUserId);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const swipe = useRef<{ x: number; y: number; t: number; lock: "h" | "v" | null } | null>(null);
  const displayCode = peerCode || peerName;

  // Start at the latest message.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const onNew = (msg: ChatMessageDTO) => {
      if (msg.requestId !== requestId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
      });
    };
    // Blocked / ended while the wali is watching: re-render the page so the server-side gate
    // replaces the conversation with "no longer available" at once (no stale view in an open tab).
    const onClosed = (e: { requestId?: string; reason?: string }) => {
      if (e?.requestId === requestId) router.refresh();
    };
    // Reactions added/changed/removed by either member update here instantly (read-only).
    const onReaction = (e: { requestId?: string; messageId?: string; reactions?: ChatMessageDTO["reactions"] }) => {
      if (e?.requestId !== requestId || !e.messageId) return;
      setMessages((prev) => prev.map((m) => (m.id === e.messageId ? { ...m, reactions: e.reactions ?? [] } : m)));
    };
    const offReaction = on("reaction:update", onReaction);
    const offNew = on("message:new", onNew);
    const offClosed = on("match:closed", onClosed);
    // Back from background/offline: messages sent meanwhile were missed — reload from the server.
    const offResync = on("realtime:resync", () => router.refresh());
    return () => {
      offNew();
      offReaction();
      offClosed();
      offResync();
    };
  }, [requestId, on, router]);

  /* ---- Chat ↔ Profile drag, same feel as the member chat ---- */
  function paneWidth() {
    return (trackRef.current?.parentElement?.clientWidth ?? window.innerWidth) || 1;
  }
  function onTouchStart(e: React.TouchEvent) {
    if (window.innerWidth >= 1024) return;
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
    const offset = Math.min(0, Math.max(-w, base + dx));
    track.style.transition = "none";
    track.style.transform = `translateX(${offset}px)`;
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

  return (
    <div className="flex h-[100dvh] flex-col bg-white lg:mx-auto lg:h-[calc(100dvh-4rem)] lg:max-w-3xl lg:border-x lg:border-ink-900/6">
      {/* Header — same as a member's chat, minus Involve family / camera / menu. */}
      <div className="sticky top-0 z-20 border-b border-ink-900/6 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-2.5 sm:px-4">
          <Link
            href={backHref}
            aria-label="Back to chats"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-ink-900/5 sm:h-10 sm:w-10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={peerAvatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-rose-200"
            style={{ filter: "blur(4px) saturate(0.9)" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink-950">{displayCode}</p>
            <p className="whitespace-nowrap text-[11px] text-ink-700/55">
              {ended ? (
                "Match ended"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <ActivityDot label={peerStatusLabel} />
                  {peerStatusLabel ?? "Active recently"}
                </span>
              )}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-700/70">
            Read-only
          </span>
        </div>
        <div className="flex gap-8 px-4 text-[15px]">
          {(["chat", "profile"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2.5 font-semibold ${
                tab === t ? "border-b-[3px] border-ink-950 text-ink-950" : "text-ink-700/45"
              }`}
            >
              {t === "chat" ? "Chat" : "Profile"}
            </button>
          ))}
        </div>
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
            <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-3 pb-4 pt-3 sm:px-5">
              <p className="text-center text-[12px] text-ink-700/50">
                You&apos;re viewing {wardCode}&apos;s conversation with {displayCode}. Messages can&apos;t be sent from
                here.
              </p>
              {photoSlot}
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-700/50">No messages yet.</p>
              ) : (
                messages.map((m) => {
                  const ward = m.senderId === profileUserId;
                  const quotedCode = m.replyTo
                    ? m.replyTo.senderId === profileUserId
                      ? wardCode
                      : displayCode
                    : null;
                  return (
                    <div key={m.id} className={`flex ${ward ? "justify-end" : "justify-start"}`}>
                      <div className={`relative flex max-w-[82%] flex-col sm:max-w-[70%] ${ward ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-snug shadow-sm ${
                            ward ? "rounded-br-md bg-[#2a2427] text-white" : "rounded-bl-md bg-[#f1eeef] text-ink-950"
                          }`}
                        >
                          {m.replyTo ? (
                            <div
                              className={`mb-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                                ward ? "bg-black/25 text-white/85" : "bg-white/80 text-ink-700"
                              }`}
                              style={{ borderLeft: "3px solid #e12d72" }}
                            >
                              <p className="text-[11px] font-semibold" style={{ color: "#e12d72" }}>
                                {quotedCode}
                              </p>
                              <p className="line-clamp-2 opacity-90">{m.replyTo.body}</p>
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap break-words">
                            {m.body}
                            <span className="inline-block w-[3.25rem]" aria-hidden />
                          </p>
                          <span
                            className={`float-right -mt-3.5 ml-2 text-[10.5px] leading-none ${
                              ward ? "text-white/60" : "text-ink-700/45"
                            }`}
                          >
                            {formatTime(m.createdAt)}
                          </span>
                        </div>
                        {/* PN-AUD-001: reactions shown read-only, tucked under the bubble like the member view. */}
                        {m.reactions && m.reactions.length > 0 ? (
                          <div className={`relative z-[1] -mt-2.5 flex flex-wrap gap-1 ${ward ? "justify-end pr-2.5" : "justify-start pl-2.5"}`}>
                            {m.reactions.map((r) => (
                              <span
                                key={r.emoji}
                                className="flex items-center gap-1 rounded-full border border-ink-900/10 bg-white px-1.5 py-0.5 text-[13px] leading-5 text-ink-700 shadow-sm"
                              >
                                <span>{r.emoji}</span>
                                {r.userIds.length > 1 ? <span className="font-semibold">{r.userIds.length}</span> : null}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-ink-900/6 px-4 py-3 text-center text-[12px] text-ink-700/45">
              Read-only view — messages cannot be sent from here.
            </div>
          </div>

          {/* Profile pane */}
          <div className="flex h-full w-1/2 min-h-0 flex-col" inert={tab !== "profile" || undefined}>
            <div className="flex-1 overflow-y-auto">
              {peerProfile ? (
                <ProfileDesktop profile={peerProfile} embedded hideNav photoOverrideVisible={false} />
              ) : (
                <p className="py-16 text-center text-sm text-ink-700/50">Profile unavailable.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
