export type GoldFeatureIconName =
  | "tokens"
  | "insights"
  | "filters"
  | "eye"
  | "rollover"
  | "calendar"
  | "clock"
  | "receipt";

export type GoldFeature = { icon: GoldFeatureIconName; title: string; detail: string };

export function GoldFeatureIcon({ icon, className = "h-5 w-5" }: { icon: GoldFeatureIconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {icon === "tokens" ? (
        <>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
          <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
        </>
      ) : icon === "insights" ? (
        <path d="M6 20v-6M12 20V8M18 20V4" />
      ) : icon === "filters" ? (
        <>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </>
      ) : icon === "eye" ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : icon === "rollover" ? (
        <>
          <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
          <path d="M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
          <path d="M20 20v-4h-4" />
        </>
      ) : icon === "calendar" ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16M10 14l4 4M14 14l-4 4" />
        </>
      ) : icon === "clock" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : (
        <>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5M10 13h6M10 17h6" />
        </>
      )}
    </svg>
  );
}
