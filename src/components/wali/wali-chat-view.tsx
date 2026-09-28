"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessageDTO } from "@/lib/chat";
import { useChatSocket } from "@/hooks/use-chat-socket";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function WaliChatView({
  requestId,
  profileUserId,
  peerName,
  peerCode,
  wardCode,
  initialMessages,
}: {
  requestId: string;
  profileUserId: string;
  peerName: string;
  peerCode: string;
  /** The member this wali oversees (W03: "PNF565's chat with PNM681"). */
  wardCode: string;
  initialMessages: ChatMessageDTO[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  // Live messages arrive on this wali link's own topic, joined by WaliRevocationGuard — the
  // server stops publishing to it the moment access is revoked.
  const { connected, on } = useChatSocket(true, profileUserId);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onNew = (msg: ChatMessageDTO) => {
      if (msg.requestId !== requestId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      requestAnimationFrame(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
      });
    };
    return on("message:new", onNew);
  }, [requestId, on]);

  return (
    <div className="bg-white rounded-2xl border border-ink-900/8 overflow-hidden flex flex-col h-[70vh]">
      <div className="px-4 h-12 flex items-center justify-between border-b border-ink-900/6">
        <p className="font-semibold text-ink-950 truncate">
          {wardCode}&apos;s chat with {peerCode || peerName}
        </p>
        <span
          className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
            connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-700/50 py-10">No messages yet.</p>
        ) : (
          messages.map((m, i) => {
            // W03: the member you oversee is always on the right in crimson, the match always on
            // the left in grey, and each run of messages is labelled with the sender's profile ID.
            const ward = m.senderId === profileUserId;
            const senderCode = ward ? wardCode : peerCode || peerName;
            const newRun = i === 0 || messages[i - 1].senderId !== m.senderId;
            const quotedCode = m.replyTo
              ? m.replyTo.senderId === profileUserId
                ? wardCode
                : peerCode || peerName
              : null;
            return (
              <div key={m.id} className={`flex flex-col ${ward ? "items-end" : "items-start"}`}>
                {newRun ? (
                  <p
                    className={`mb-1 px-1 text-[11px] font-bold tracking-wide ${
                      ward ? "text-rose-700" : "text-ink-700/60"
                    }`}
                  >
                    {senderCode}
                  </p>
                ) : null}
                <div
                  className={`max-w-[75%] rounded-[16px] px-3.5 py-2.5 text-[14px] leading-snug ${
                    ward ? "bg-rose-700 text-white rounded-br-md" : "bg-[#f1eeef] text-ink-950 rounded-bl-md"
                  }`}
                >
                  {m.replyTo ? (
                    <div
                      className={`mb-1.5 rounded-lg border-l-[3px] px-2 py-1 text-[12px] ${
                        ward ? "bg-white/15 border-white/60" : "bg-white border-ink-900/20"
                      }`}
                    >
                      <p className="font-semibold opacity-80">{quotedCode}</p>
                      <p className="line-clamp-2 opacity-90">{m.replyTo.body}</p>
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${ward ? "text-white/60" : "text-ink-700/40"}`}>
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="px-4 py-3 border-t border-ink-900/6 text-center text-[12px] text-ink-700/45">
        Read-only view — messages cannot be sent from here.
      </div>
    </div>
  );
}
