"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export const PN_PINK = "#e12d72";

/* ───────────────────────────── icons ───────────────────────────── */

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const PersonIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </Svg>
);

export const PhoneIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.24 1Z" />
  </Svg>
);

export const LinkIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M10 13a4 4 0 0 0 5.66 0l3-3A4 4 0 1 0 13 4.34l-1.5 1.5" />
    <path d="M14 11a4 4 0 0 0-5.66 0l-3 3A4 4 0 1 0 11 19.66l1.5-1.5" />
  </Svg>
);

export const MailIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);

export const EyeIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
);

export const ActivityIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M8 4h9a2 2 0 0 1 2 2v13a1 1 0 0 1-1.5.87L15 18.5l-2.5 1.4-2.5-1.4-2.5 1.4A1 1 0 0 1 5 19V6a2 2 0 0 1 2-2Z" />
    <path d="M9 9h6M9 12.5h6" />
  </Svg>
);

export const ClockIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
);

/* ───────────────────────────── layout bits ───────────────────────────── */

/** The pink circular badge shown beside a card title. */
export function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[#e12d72]"
      aria-hidden
    >
      {children}
    </span>
  );
}

const fieldBase =
  "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] pl-10 pr-3.5 py-2.5 text-sm text-ink-950 placeholder:text-ink-700/35 focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10";

/** A labelled text input with a leading icon inside the field. */
export function IconField({
  label,
  icon,
  ...input
}: { label: string; icon: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-900">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" aria-hidden>
          {icon}
        </span>
        <input className={fieldBase} {...input} />
      </div>
    </div>
  );
}

/** Full-width primary pink button used by both wali cards. */
export const primaryWaliBtn =
  "w-full py-3 rounded-2xl bg-[#e12d72] text-white text-[15px] font-semibold shadow-[0_10px_24px_-12px_rgba(225,45,114,0.8)] hover:brightness-105 disabled:opacity-60";
