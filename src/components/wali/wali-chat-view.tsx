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
  initialMessages,
  realtimeTopic,
}: {
  requestId: string;
  profileUserId: string;
  peerName: string;
  peerCode: string;
  initialMessages: ChatMessageDTO[];
  realtimeTopic: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const { connected, joinThread, on } = useChatSocket(true, profileUserId);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void joinThread(requestId, realtimeTopic);
  }, [requestId, realtimeTopic, joinThread]);

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
        <p className="font-semibold text-ink-950">{peerCode || peerName}</p>
        <span
          className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
            connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-700/50 py-10">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === profileUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-[16px] px-3.5 py-2.5 text-[14px] leading-snug ${
                    mine ? "bg-[#2a2427] text-white rounded-br-md" : "bg-[#f1eeef] text-ink-950 rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${mine ? "text-white/50" : "text-ink-700/40"}`}>
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
