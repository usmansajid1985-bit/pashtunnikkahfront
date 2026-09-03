"use client";

import { useEffect, useRef, useState } from "react";

const CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "😐", "😑",
      "😶", "😏", "😒", "🙄", "😬", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🥵", "🥶", "😵", "🤯",
      "🥳", "😎", "🤓", "🧐", "😢", "😭", "😤", "😡", "🥺", "😳", "😱", "🤗",
    ],
  },
  {
    label: "Gestures",
    icon: "👋",
    emojis: [
      "👋", "🤚", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇",
      "☝️", "👍", "👎", "✊", "👊", "👏", "🙌", "👐", "🙏", "🤝", "💪", "👀", "🧕", "🤵", "👰",
    ],
  },
  {
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "♥️", "😻", "💐", "💍", "💒", "💏", "💑",
    ],
  },
  {
    label: "Nature",
    icon: "🌙",
    emojis: [
      "🌙", "⭐", "✨", "💫", "🌟", "🔥", "🌸", "🌹", "🌺", "🌻", "🌷", "🌼", "🍀", "🕌", "🕋", "📿",
      "🐶", "🐱", "🐰", "🦋", "🐢", "🌍",
    ],
  },
  {
    label: "Food",
    icon: "🍎",
    emojis: [
      "🍏", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🥭", "🍍", "🥥", "🍕", "🍔", "🌮",
      "🥗", "🍿", "🍰", "🎂", "☕", "🍵", "🍩",
    ],
  },
  {
    label: "Activities",
    icon: "🎉",
    emojis: [
      "🎉", "🎊", "🎁", "🏆", "🥇", "🎮", "🎨", "🎬", "🎤", "🎧", "⚽", "🏀", "✅", "💯", "🔥", "👏",
    ],
  },
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[18px] transition ${
          open ? "bg-rose-50" : "hover:bg-ink-900/5"
        }`}
        aria-label="Insert emoji"
      >
        🙂
      </button>
      {open ? (
        <div className="absolute bottom-full right-0 mb-2 w-72 max-w-[85vw] rounded-2xl border border-ink-900/10 bg-white shadow-[0_16px_40px_-14px_rgba(15,13,14,0.35)] overflow-hidden z-30">
          <div className="flex border-b border-ink-900/6 px-1 py-1 gap-0.5">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setTab(i)}
                className={`flex-1 py-1.5 text-[16px] rounded-lg transition ${
                  tab === i ? "bg-rose-50" : "hover:bg-ink-900/5"
                }`}
                aria-label={c.label}
                title={c.label}
              >
                {c.icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 p-2 max-h-52 overflow-y-auto">
            {CATEGORIES[tab].emojis.map((e, idx) => (
              <button
                key={`${e}-${idx}`}
                type="button"
                onClick={() => onSelect(e)}
                className="w-8 h-8 flex items-center justify-center text-[19px] rounded-lg hover:bg-ink-900/5"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
