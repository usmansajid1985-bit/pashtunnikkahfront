"use client";

import { useEffect, useRef, useState } from "react";
import { QUICK_REACTIONS, MORE_REACTIONS } from "@/lib/reactions";

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

export function MessageActionMenu({
  mine,
  open,
  canReport,
  onClose,
  onReact,
  onReply,
  onCopy,
  onReport,
}: {
  mine: boolean;
  open: boolean;
  canReport: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onReport: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowMore(false);
      return;
    }
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={wrapRef}
      className={`absolute z-40 bottom-full mb-2 ${mine ? "right-0" : "left-0"} w-max max-w-[min(20rem,calc(100vw-2.5rem))] animate-[chatIn_140ms_ease-out]`}
    >
      <div className="flex items-center gap-0.5 bg-white rounded-full border border-ink-900/10 shadow-[0_14px_36px_-14px_rgba(15,13,14,0.4)] px-1.5 py-1 mb-2 overflow-x-auto">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onReact(emoji);
              onClose();
            }}
            className="w-8 h-8 shrink-0 flex items-center justify-center text-[19px] rounded-full hover:bg-ink-900/5 hover:scale-110 transition"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full hover:bg-ink-900/5 text-ink-700/60 text-lg font-semibold"
          aria-label="More reactions"
        >
          +
        </button>
      </div>

      {showMore ? (
        <div className="grid grid-cols-7 gap-0.5 bg-white rounded-2xl border border-ink-900/10 shadow-[0_14px_36px_-14px_rgba(15,13,14,0.4)] p-2 mb-2 max-h-40 overflow-y-auto">
          {MORE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="w-8 h-8 flex items-center justify-center text-[18px] rounded-lg hover:bg-ink-900/5"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-ink-900/10 shadow-[0_14px_36px_-14px_rgba(15,13,14,0.4)] overflow-hidden min-w-[200px]">
        {canReport ? (
          <button
            type="button"
            onClick={() => {
              onReport();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-ink-900 hover:bg-ink-900/[0.03] text-left"
          >
            <FlagIcon />
            Report message
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onCopy();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-ink-900 hover:bg-ink-900/[0.03] text-left ${
            canReport ? "border-t border-ink-900/6" : ""
          }`}
        >
          <CopyIcon />
          Copy to clipboard
        </button>
        <button
          type="button"
          onClick={() => {
            onReply();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-ink-900 hover:bg-ink-900/[0.03] text-left border-t border-ink-900/6"
        >
          <ReplyIcon />
          Reply to message
        </button>
      </div>
    </div>
  );
}
