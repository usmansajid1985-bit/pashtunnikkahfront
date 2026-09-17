import type { ReactNode } from "react";

export type NavKey =
  | "overview"
  | "browse"
  | "requests"
  | "messages"
  | "profile"
  | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  icon: ReactNode;
};

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };

export const NAV_ITEMS: NavItem[] = [
  {
    key: "overview",
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "browse",
    href: "/browse",
    label: "Browse",
    icon: (
      <svg {...iconProps}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.3-4.3" />
      </svg>
    ),
  },
  {
    key: "requests",
    href: "/requests",
    label: "Requests",
    icon: (
      <svg {...iconProps}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" />
        <path d="M16 8h5M18.5 5.5v5" />
      </svg>
    ),
  },
  {
    key: "messages",
    href: "/chats",
    label: "Messages",
    icon: (
      <svg {...iconProps}>
        <path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1 3.6A7.96 7.96 0 0 1 21 12Z" />
      </svg>
    ),
  },
  {
    key: "profile",
    href: "/profile",
    label: "Profile",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-4 3.5-6.5 7-6.5s7 2.5 7 6.5" />
      </svg>
    ),
  },
  {
    key: "settings",
    href: "/settings",
    label: "Settings",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
      </svg>
    ),
  },
];
