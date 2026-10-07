import Image from "next/image";
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
  showCheck,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  tone?: Tone;
  multi?: boolean;
  /** Single-select tiles: show the tick badge once selected. */
  showCheck?: boolean;
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
      {multi || (showCheck && selected) ? (
        <span className={`choice-check ${selected ? "on" : ""}`}>{selected ? "✓" : ""}</span>
      ) : null}
    </button>
  );
}

/** Gender step tile — large illustrated avatar centred above the label. */
export function GenderTile({
  label,
  image,
  selected,
  onClick,
  tone,
}: {
  label: string;
  image: string;
  selected: boolean;
  onClick: () => void;
  tone: Tone;
}) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`choice-tile gender-tile ${selected ? "is-selected" : ""}`}
      style={{
        background: t.bg,
        borderColor: selected ? t.selectedBorder : t.border,
      }}
    >
      <span className="gender-tile-avatar">
        <Image src={image} alt="" width={160} height={160} priority />
      </span>
      <span className="gender-tile-label">{label}</span>
      {selected ? (
        <span className="choice-check on" aria-hidden>
          ✓
        </span>
      ) : null}
    </button>
  );
}

/** Brother appearance options — portrait and the tile colour it was drawn on. */
const BEARD_TILES: Record<string, { image: string; bg: string; border: string }> = {
  "Clean Shaven": { image: "/images/signup/beard-clean-shaven.webp", bg: "#fefaf2", border: "#f0dcc0" },
  Stubble: { image: "/images/signup/beard-stubble.webp", bg: "#fceff2", border: "#f0c3d3" },
  "Short Beard": { image: "/images/signup/beard-short-beard.webp", bg: "#eaf4fe", border: "#c9daf5" },
  "Medium Beard": { image: "/images/signup/beard-medium-beard.webp", bg: "#f3effe", border: "#ddd0f5" },
  "Long Beard": { image: "/images/signup/beard-long-beard.webp", bg: "#eefcf2", border: "#cfe9d6" },
};

/** Beard-style tile — illustrated portrait above the label, radio badge in the corner. */
export function BeardTile({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const t = BEARD_TILES[label];
  if (!t) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`choice-tile beard-tile ${selected ? "is-selected" : ""}`}
      style={{ background: t.bg, borderColor: selected ? "#aa1945" : t.border }}
    >
      {/* unoptimized: the optimizer can re-encode to JPEG, dropping the feathered alpha edge */}
      <Image src={t.image} alt="" width={160} height={160} unoptimized loading="eager" className="beard-tile-img" />
      <span className="beard-tile-label">{label}</span>
      <span className={`choice-check ${selected ? "on" : ""}`} aria-hidden>
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}

/** Sister appearance options — illustration per stored value. */
const DRESS_IMAGES: Record<string, string> = {
  "Does Not Wear Hijab": "/images/signup/head-no-hijab.webp",
  "Wears Hijab": "/images/signup/head-hijab.webp",
  "Wears Niqab": "/images/signup/head-niqab.webp",
  "Kamees Partug": "/images/signup/dress-kamees-partug.webp",
  "Abaya / Jilbab": "/images/signup/dress-abaya.webp",
  "Western Modest": "/images/signup/dress-western.webp",
  "Traditional & Western Mix": "/images/signup/dress-mix.webp",
};

/** Head-covering / dress-style tile — illustration, label and hint, radio badge in the corner. */
export function DressTile({
  value,
  label,
  hint,
  selected,
  onClick,
}: {
  value: string;
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`choice-tile dress-tile ${selected ? "is-selected" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small pre-sized art with alpha */}
      <img src={DRESS_IMAGES[value]} alt="" className="dress-tile-img" />
      <span className="choice-tile-label">{label}</span>
      <span className="choice-tile-hint">{hint}</span>
      <span className={`choice-check ${selected ? "on" : ""}`} aria-hidden>
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}

/** Heading row for a group of tiles: title on the left, selection rule on the right. */
export function ChoiceSection({ title, rule }: { title: string; rule: string }) {
  return (
    <div className="choice-section-head">
      <h2>{title}</h2>
      <span>{rule}</span>
    </div>
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

/** Peach baby face shared by the children-step icons. */
const babyFace = (
  <>
    <path
      d="M5.2 12A7 6.6 0 0 1 18.8 12 2 2 0 1 1 18.6 15.6 7 6.6 0 0 1 5.4 15.6 2 2 0 1 1 5.2 12Z"
      fill="#fcdcc3"
      stroke="#b06f4d"
      strokeWidth="1.3"
    />
    <path d="M11.6 3.6c2.2.9 2.9 3.9 0 5.2" stroke="#151515" strokeWidth="1.6" />
    <path d="M10 16c1.1 1.3 2.9 1.3 4 0" stroke="#151515" strokeWidth="1.6" />
  </>
);

function LifestyleIcon({ name }: { name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/lifestyle/${name}.webp`} alt="" width={28} height={28} className="block" />
  );
}

/** Health & lifestyle tiles (signup + Edit Profile): Never / Occasionally / Regularly. */
export const LIFESTYLE_ICONS = {
  smoking: [
    <LifestyleIcon key="n" name="smoking-never" />,
    <LifestyleIcon key="o" name="occasionally" />,
    <LifestyleIcon key="r" name="smoking-regularly" />,
  ],
  vaping: [
    <LifestyleIcon key="n" name="vaping-never" />,
    <LifestyleIcon key="o" name="occasionally" />,
    <LifestyleIcon key="r" name="vaping-regularly" />,
  ],
};

export const I = {
  /* —— Marital status —— */
  neverMarried: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
    </svg>
  ),
  divorced: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="m12 13-1-1 2-2-3-3 2-2" />
    </svg>
  ),
  annulled: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M12.5 20.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2V11" />
      <path d="M9 8.5h5.5M9 12h3.5" />
      <circle cx="17.5" cy="17.5" r="3.75" />
      <path d="m16.2 16.2 2.6 2.6M18.8 16.2l-2.6 2.6" />
    </svg>
  ),
  widowed: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="15.5" cy="14.5" r="5" stroke="#b3b0ad" />
      <circle cx="9" cy="14.5" r="5" />
      <path d="M7.4 4h3.2l1.2 1.7L9 9 6.2 5.7Z" fill="currentColor" strokeWidth="1" />
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
  /* —— Children (full-colour) —— */
  baby: (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      {babyFace}
    </svg>
  ),
  babyOff: (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      {babyFace}
      <path d="M4.5 4.5 19.5 20" stroke="#ff1f5a" strokeWidth="2.2" />
    </svg>
  ),
  babySparkle: (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      {babyFace}
      <path
        d="M19.5 2.200c.4 2 1.3 2.9 3.3 3.3-2 .4-2.9 1.3-3.3 3.3-.4-2-1.3-2.9-3.3-3.3 2-.4 2.9-1.3 3.3-3.300Z"
        fill="#fdb000"
        stroke="none"
      />
    </svg>
  ),
  babyNo: (
    <svg width="26" height="26" viewBox="0 0 24 24" {...stroke}>
      {babyFace}
      <circle cx="18.5" cy="18" r="4.2" fill="#f4306d" stroke="none" />
      <path d="m16.9 16.4 3.2 3.200M20.1 16.400l-3.2 3.2" stroke="#fff" strokeWidth="1.5" />
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
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  ),
  /* —— Religious practice (tinted) —— */
  practiceStrict: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} stroke="#5b6349">
      <path d="M12.5 3.5A8.5 8.5 0 1 0 20.5 13.5 6.5 6.5 0 0 1 12.5 3.5Z" fill="#5b6349" strokeWidth="1" />
    </svg>
  ),
  practiceActive: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} stroke="#14457f">
      <rect x="6.5" y="4.5" width="11" height="15" rx="0.5" />
      <path d="M7.5 2.5v2M10.5 2.5v2M13.5 2.5v2M16.5 2.5v2M7.5 19.5v2M10.5 19.5v2M13.5 19.5v2M16.5 19.5v2" />
      <path d="M9.2 17v-5.600c0-1.9 1.7-2.3 2.8-3.5 1.1 1.2 2.8 1.6 2.8 3.500V17Z" />
    </svg>
  ),
  practiceOccasional: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} stroke="#7a471c">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.500V12l3.5 2.4" strokeWidth="2" />
    </svg>
  ),
  practiceNone: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} stroke="#824556">
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9v6M14 9v6" strokeWidth="2" />
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
  hijab: (
    <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
      <path d="M8 20c0-5 1.8-8.5 4-8.5s4 3.5 4 8.5" />
      <path d="M8 11.5c0-2.8 1.8-4.5 4-4.5s4 1.7 4 4.5" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  ),
};
