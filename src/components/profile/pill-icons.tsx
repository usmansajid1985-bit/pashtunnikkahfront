/**
 * Small line icons for profile pills (photo hero + profile sections). Stroke uses currentColor so
 * each pill decides the colour.
 */
const base = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** House with a tick (open to relocation) or a cross (not open). */
export function RelocationIcon({ open }: { open: boolean }) {
  return (
    <svg {...base}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V20h7" />
      <circle cx="17.5" cy="17.5" r="4" />
      {open ? <path d="m15.8 17.6 1.2 1.2 2.3-2.4" /> : <path d="m16 16 3 3m0-3-3 3" />}
    </svg>
  );
}

export function BriefcaseIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M10.5 12.5v1.5h3v-1.5" />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M16 14.2c2.6.2 4.5 2 4.5 4.8" />
    </svg>
  );
}

/** One icon per religious-practice answer: crescent, prayer mat, clock, pause. */
export function PracticeIcon({ practice }: { practice: string }) {
  const p = practice.toLowerCase();
  if (p.startsWith("strictly")) {
    return (
      <svg {...base}>
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
      </svg>
    );
  }
  if (p.startsWith("actively")) {
    return (
      <svg {...base}>
        <rect x="5.5" y="4" width="13" height="16" rx="1.5" />
        <path d="M9 17v-5.5a3 3 0 0 1 6 0V17M5.5 2.5v1.5M9 2.5v1.5M12 2.5v1.5M15 2.5v1.5M18.5 2.5v1.5M5.5 20v1.5M9 20v1.5M12 20v1.5M15 20v1.5M18.5 20v1.5" />
      </svg>
    );
  }
  if (p.startsWith("occasionally")) {
    return (
      <svg {...base}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}
