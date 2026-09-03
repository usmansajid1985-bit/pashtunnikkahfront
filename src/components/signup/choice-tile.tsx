import type { ReactNode } from "react";

type Tone = "mint" | "peach" | "lilac" | "sky" | "rose" | "sand" | "white";

const TONES: Record<Tone, { bg: string; border: string; selectedBorder: string }> = {
  mint: { bg: "#eefaf1", border: "#cfe9d6", selectedBorder: "#aa1945" },
  peach: { bg: "#fdf3e8", border: "#f0d4b5", selectedBorder: "#aa1945" },
  lilac: { bg: "#f5f0fd", border: "#ddd0f5", selectedBorder: "#aa1945" },
  sky: { bg: "#eef4fd", border: "#c9daf5", selectedBorder: "#aa1945" },
  rose: { bg: "#fdf2f6", border: "#f0c3d3", selectedBorder: "#aa1945" },
  sand: { bg: "#faf6f1", border: "#ebe0d4", selectedBorder: "#aa1945" },
  white: { bg: "#ffffff", border: "#ece7e6", selectedBorder: "#aa1945" },
};

export function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="choice-icon-badge text-ink-900">
      {children}
    </span>
  );
}

export function ChoiceTile({
  label,
  hint,
  selected,
  onClick,
  icon,
  tone = "white",
  multi,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  tone?: Tone;
  multi?: boolean;
}) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`choice-tile ${selected ? "is-selected" : ""} ${multi ? "is-multi" : ""}`}
      style={{
        background: t.bg,
        borderColor: selected ? t.selectedBorder : t.border,
      }}
    >
      <IconBadge>{icon}</IconBadge>
      <span className="choice-tile-label">{label}</span>
      {hint ? <span className="choice-tile-hint">{hint}</span> : null}
      {multi ? (
        <span className={`choice-check ${selected ? "on" : ""}`}>{selected ? "✓" : ""}</span>
      ) : null}
    </button>
  );
}

/** Smart grid: 2→2col, 3→3col, 4→2x2, 5→3+2, 6+→3col */
export function ChoiceGrid({ count, children }: { count: number; children: ReactNode }) {
  const n = Math.min(Math.max(count, 1), 6);
  return <div className={`choice-grid choice-grid-${n}`}>{children}</div>;
}

/* —— Lucide-style stroke icons (24 viewBox) —— */

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const I = {
  brother: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5" />
    </svg>
  ),
  sister: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5" />
      <path d="M12 11.5v2.5M10.5 14h3" />
    </svg>
  ),
  ring: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="13" r="6" />
      <path d="M9.5 7.5 12 5l2.5 2.5" />
    </svg>
  ),
  split: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 4v16" />
      <path d="M7 8c0-2 2-3.5 5-3.5" />
      <path d="M17 8c0-2-2-3.5-5-3.5" />
      <path d="M7 16c0 2 2 3.5 5 3.5" />
      <path d="M17 16c0 2-2 3.5-5 3.5" />
    </svg>
  ),
  users: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5S14 16 14.8 19" />
      <path d="M15 14.5c2 .2 3.5 1.4 4.3 3.5" />
    </svg>
  ),
  fileX: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="m10 13 4 4M14 13l-4 4" />
    </svg>
  ),
  flower: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5c2 2 2 4.5 0 5.5-2-1-2-3.5 0-5.5Z" />
      <path d="M12 14c2 1 2 3.5 0 5.5-2-2-2-4.5 0-5.5Z" />
      <path d="M4.5 12c2-2 4.5-2 5.5 0-1 2-3.5 2-5.5 0Z" />
      <path d="M14 12c1-2 3.5-2 5.5 0-2 2-4.5 2-5.5 0Z" />
    </svg>
  ),
  mapPin: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  ),
  mapOff: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 9.5-4.8" />
      <path d="M17.5 9.2A6 6 0 0 1 18 11c0 4.8-6 10-6 10" />
      <path d="m4 4 16 16" />
    </svg>
  ),
  heart: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 20s-7-4.2-9-8.2C1.5 8.2 3.2 5 6.5 5 8.4 5 10 6.2 12 8.2 14 6.2 15.6 5 17.5 5 20.8 5 22.5 8.2 21 11.8 19 15.8 12 20 12 20Z" />
    </svg>
  ),
  parent: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="8" cy="8" r="2.8" />
      <circle cx="16.5" cy="9.5" r="2.2" />
      <path d="M3.5 19c.7-2.8 2.5-4.2 4.5-4.2s3.8 1.4 4.5 4.2" />
      <path d="M14 15.2c1.5.2 2.8 1.2 3.5 3" />
    </svg>
  ),
  spark: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  ),
  baby: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="10" r="4.5" />
      <path d="M8 18c1.2-1.8 2.5-2.5 4-2.5s2.8.7 4 2.5" />
      <path d="M9.5 10.2h.01M14.5 10.2h.01" />
    </svg>
  ),
  babyOff: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="10" r="4.5" />
      <path d="M8 18c1.2-1.8 2.5-2.5 4-2.5s2.8.7 4 2.5" />
      <path d="m4 4 16 16" />
    </svg>
  ),
  check: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  ),
  x: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  ),
  moon: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6 6 0 0 0 20 14.5Z" />
    </svg>
  ),
  book: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 0-2 2V4.5Z" />
      <path d="M5 20a2 2 0 0 1 2-2h13" />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  ),
  pause: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  ),
  beard: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M7.5 11.5c0 5 2 8 4.5 8s4.5-3 4.5-8" />
    </svg>
  ),
  briefcase: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M3 12h18" />
    </svg>
  ),
  laptop: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2.5 19h19" />
    </svg>
  ),
  grad: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="m3 10 9-4 9 4-9 4-9-4Z" />
      <path d="M7 12.5v4c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4" />
      <path d="M21 10v6" />
    </svg>
  ),
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10.5V20h12v-9.5" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  ),
  ban: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="m7 7 10 10" />
    </svg>
  ),
  waves: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M3 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M3 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M3 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
    </svg>
  ),
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M5 17.5 3.5 20 7 18.5A8.5 8.5 0 1 0 5 17.5Z" />
    </svg>
  ),
  eye: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  phone: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M7 3.5h4.5A1.5 1.5 0 0 1 13 5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M15.5 8.5 19 7l-1 4" />
      <path d="M19 7c-3 4-4.5 7.5-5 11" />
    </svg>
  ),
  veil: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M7 10c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5v8.5H7V10Z" />
      <path d="M9.5 13.5h5" />
    </svg>
  ),
  hijab: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M8 20c0-5 1.8-8.5 4-8.5s4 3.5 4 8.5" />
      <path d="M8 11.5c0-2.8 1.8-4.5 4-4.5s4 1.7 4 4.5" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  ),
  modest: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M8 20v-7l4-3 4 3v7" />
      <circle cx="12" cy="6.5" r="2.5" />
    </svg>
  ),
};
