"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatThreadDTO } from "@/lib/chat";

function daysAgo(iso: string | null) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

/**
 * Chats → Past matches card: blurred photo, who ended the match and when, an Ended pill, and a ⋮
 * menu with Request rematch (only for the member who ended it), Report and Block. Tapping the
 * card opens the read-only past chat.
 */
export function PastMatchRow({
  thread,
  avatarSrc,
  active,
  busy,
  onOpen,
  onRematch,
  onReport,
  onBlock,
}: {
  thread: ChatThreadDTO;
  avatarSrc: string;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
  onRematch: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [blockArmed, setBlockArmed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setBlockArmed(false);
      }
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const who = thread.endedByMe ? "You ended the match" : `${thread.peerCode} ended the match`;

  return (
    <div className={`relative px-3 py-2 ${menu ? "z-30" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
        className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition cursor-pointer ${
          active ? "border-rose-200 bg-rose-50/60" : "border-ink-900/8 bg-white hover:border-ink-900/15"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt=""
          className="w-14 h-14 rounded-2xl object-cover shrink-0"
          style={{ filter: "blur(5px) saturate(0.9)" }}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink-950 truncate">{thread.peerCode}</span>
          <span className="block text-[12.5px] leading-snug text-ink-700/65">
            {who} 💔 · {daysAgo(thread.endedAt)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-2 shrink-0 self-stretch justify-between">
          <button
            type="button"
            aria-label={`More options for ${thread.peerCode}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={(e) => {
              e.stopPropagation();
              setMenu((m) => !m);
              setBlockArmed(false);
            }}
            className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-ink-700/60 hover:bg-ink-900/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          <span className="rounded-full bg-ink-900/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-ink-700/65">Ended</span>
        </span>
      </div>

      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute right-4 top-12 z-40 w-60 rounded-2xl border border-ink-900/8 bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(15,13,14,0.3)]"
        >
          {thread.canRematch ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setMenu(false);
                onRematch();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-[#c92763] hover:bg-rose-50 disabled:opacity-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
                <path d="M12 20s-7-4.3-9-8.6C1.6 8.3 3.4 5 6.8 5c2 0 3.3 1.1 4.2 2.4C11.9 6.1 13.2 5 15.2 5c3.4 0 5.2 3.3 3.8 6.4C17 15.7 12 20 12 20Z" />
              </svg>
              <span>
                Request rematch
                <span className="block text-[11.5px] text-ink-700/55">Costs 1 Match Token</span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onReport();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-ink-800 hover:bg-ink-900/5"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 21V4h9l1 2h6v9h-7l-1-2H4" />
            </svg>
            Report member
          </button>
          {blockArmed ? (
            <div className="px-3 py-2.5">
              <p className="text-[12px] text-ink-700/70 leading-snug">
                Block {thread.peerCode}? They won&apos;t be able to reach you and this past chat will be removed.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMenu(false);
                    onBlock();
                  }}
                  className="flex-1 py-2 rounded-full bg-[#e12d72] text-white text-[13px] font-semibold disabled:opacity-50"
                >
                  {busy ? "Blocking…" : "Block"}
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
    </div>
  );
}
