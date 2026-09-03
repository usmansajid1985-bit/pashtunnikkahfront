import Link from "next/link";
import type { ReactNode } from "react";
import { BrowseAppNav } from "@/components/browse/app-nav";

export function SettingsShell({
  title = "Settings",
  backHref = "/browse",
  profileCode,
  unreadCount = 0,
  children,
}: {
  title?: string;
  backHref?: string;
  profileCode?: string;
  unreadCount?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4f2] text-ink-900 lg:pl-60">
      {/* Desktop nav */}
      {profileCode ? (
        <div className="hidden lg:block">
          <BrowseAppNav profileCode={profileCode} active="settings" unreadCount={unreadCount} />
        </div>
      ) : null}

      {/* Mobile header */}
      <header className="sticky top-0 z-30 bg-[#f7f4f2] lg:hidden">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={backHref}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-[17px] font-bold text-ink-950">{title}</h1>
          <span className="w-10" />
        </div>
      </header>

      <main className="max-w-lg lg:max-w-3xl mx-auto px-4 lg:px-8 pb-12 lg:py-10">{children}</main>
    </div>
  );
}

export function SettingsRow({
  href,
  title,
  description,
  icon,
  iconBg,
  iconColor,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-ink-900/[0.02] transition"
    >
      <span
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-ink-950">{title}</span>
        <span className="block text-[12.5px] text-ink-700/65 mt-0.5 leading-snug">{description}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="2.2" className="shrink-0">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}
