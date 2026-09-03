"use client";

import Link from "next/link";
import { useState } from "react";
import type { NavItem, NavKey } from "@/components/browse/nav-items";
import { LogoutButton } from "@/components/logout-button";

export function MobileNavMenu({
  items,
  active,
  unread,
}: {
  items: NavItem[];
  active: NavKey;
  unread: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5 text-ink-900"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        {unread > 0 ? (
          <span className="absolute top-1 right-1 min-w-[9px] h-[9px] rounded-full bg-rose-600" />
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-ink-950">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-ink-900/5"
                aria-label="Close menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {items.map((item) => {
                const isActive = active === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive ? "bg-rose-50 text-rose-600" : "text-ink-700 hover:bg-ink-900/5"
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.key === "messages" && unread > 0 ? (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {unread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto pt-4 border-t border-ink-900/6">
              <LogoutButton />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
