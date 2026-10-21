"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ActivityNotification } from "@/lib/notifications";
import type { AnnouncementCard } from "@/lib/announcements-shared";
import { AnnouncementCardRow } from "@/components/announcements/announcement-card";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  const w = Math.floor(d / 7);
  return `${w} week${w === 1 ? "" : "s"} ago`;
}

const ANNOUNCEMENT_SECTION: Record<AnnouncementCard["section"], string> = {
  pinned: "Pinned",
  this_week: "This week",
  last_month: "Last month",
  earlier: "Earlier",
};

const SECTION_LABEL: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
  pinned: "Pinned",
  this_week: "This Week",
};

function pravatar(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

/* ---- category glyphs ---- */

function ActivityGlyph({ n }: { n: ActivityNotification }) {
  const showThumb = n.category === "request" || n.category === "message" || n.category === "profile_view";
  if (showThumb) {
    return (
      <div className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={n.thumbnailUrl || pravatar(n.avatarSeed)}
          alt=""
          className="h-11 w-11 rounded-xl object-cover"
          style={{ filter: "blur(7px) saturate(0.8)" }}
        />
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-1 ring-ink-900/8">
          {n.category === "request" ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#e11d48">
              <path d="M12 21s-7-4.35-9-8.5C1.4 9 3 5.5 6.5 5.5c2 0 3.7 1.2 5.5 3.3 1.8-2.1 3.5-3.3 5.5-3.3 3.5 0 5.1 3.5 3.5 7C19 16.65 12 21 12 21Z" />
            </svg>
          ) : n.category === "message" ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#2563eb">
              <path d="M4 4h16v12H7l-3 3V4Z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </span>
      </div>
    );
  }
  const bg =
    n.category === "wali" || n.category === "photo"
      ? "bg-violet-50 text-violet-600"
      : "bg-emerald-50 text-emerald-600";
  return (
    <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${bg}`}>
      {n.category === "wali" || n.category === "photo" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
          <circle cx="18" cy="9" r="2" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 12l2 2 4-4" />
          <path d="M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-4-4H8L4 7Z" />
        </svg>
      )}
    </div>
  );
}

const Chevron = () => (
  <svg className="shrink-0 text-ink-700/30" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/* ---- main ---- */

export function NotificationsView({
  initialTab,
  initialActivity,
  initialAnnouncements,
}: {
  initialTab: "activity" | "announcements";
  initialActivity: ActivityNotification[];
  initialAnnouncements: AnnouncementCard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"activity" | "announcements">(initialTab);
  const [activity, setActivity] = useState(initialActivity);
  const announcements = initialAnnouncements;
  const unreadAnnouncements = announcements.filter((a) => !a.read).length;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // N52: announcements are marked read one at a time, when their page is opened — not when the
  // tab is. Keep the URL in step with the tab so "Back to announcements" lands here.
  function chooseTab(t: "activity" | "announcements") {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "announcements") url.searchParams.set("tab", "announcements");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  async function markAllRead() {
    setMenuOpen(false);
    setActivity((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    router.refresh();
  }

  function openActivity(n: ActivityNotification) {
    if (!n.read) {
      setActivity((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    if (n.url) router.push(n.url);
  }

  const sections: ActivityNotification["section"][] = ["today", "yesterday", "earlier"];
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="lg:hidden h-9 w-9 -ml-2 flex items-center justify-center rounded-full hover:bg-ink-900/5"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl lg:text-2xl font-bold text-ink-950">Notifications</h1>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-ink-900/5"
            aria-label="Notification options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-1 w-52 rounded-xl border border-ink-900/10 bg-white shadow-lg py-1.5 z-20 text-sm">
              <button
                type="button"
                onClick={markAllRead}
                className="w-full text-left px-3.5 py-2 hover:bg-ink-900/5"
              >
                Mark all as read
              </button>
              <Link
                href="/settings/notifications"
                className="block px-3.5 py-2 hover:bg-ink-900/5"
                onClick={() => setMenuOpen(false)}
              >
                Notification settings
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-ink-900/[0.04] p-1 text-[15px] font-semibold">
        {(["activity", "announcements"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => chooseTab(t)}
            className={`h-11 rounded-xl flex items-center justify-center gap-2 transition ${
              tab === t ? "bg-rose-50 text-rose-600 shadow-[0_1px_3px_rgba(15,13,14,0.06)]" : "text-ink-700/60 hover:text-ink-900"
            }`}
          >
            {t === "activity" ? "Activity" : "Announcements"}
            {t === "announcements" && unreadAnnouncements > 0 ? (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-rose-600 text-white text-[12px] font-bold flex items-center justify-center">
                {unreadAnnouncements}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Activity */}
      {tab === "activity" ? (
        <div className="mt-2">
          {activity.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-700/55">Nothing here yet.</p>
          ) : (
            sections.map((sec) => {
              const rows = activity.filter((n) => n.section === sec);
              if (rows.length === 0) return null;
              return (
                <div key={sec}>
                  <p className="mt-5 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/45">
                    {SECTION_LABEL[sec]}
                  </p>
                  <div className="divide-y divide-ink-900/6">
                    {rows.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openActivity(n)}
                        className={`w-full flex items-start gap-3 py-3.5 text-left -mx-1 px-1 rounded-lg transition ${
                          n.read ? "" : "bg-rose-50/40"
                        }`}
                      >
                        <ActivityGlyph n={n} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] leading-snug text-ink-900">
                            {n.title}
                            {n.groupCount > 1 ? (
                              <span className="ml-1.5 text-xs font-semibold text-rose-600">
                                {n.groupCount}
                              </span>
                            ) : null}
                          </p>
                          {n.body && n.category !== "profile_view" ? (
                            <p className="text-[13px] text-ink-700/70 mt-0.5 line-clamp-2">{n.body}</p>
                          ) : null}
                          <p className="text-[12px] text-ink-700/45 mt-1">{timeAgo(n.createdAt)}</p>
                          {n.upgradeCta ? (
                            <span className="mt-1.5 inline-block text-[12px] font-semibold text-rose-600">
                              Upgrade to Gold →
                            </span>
                          ) : null}
                        </div>
                        <div className="self-center">
                          <Chevron />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {/* Announcements */}
      {tab === "announcements" ? (
        <div className="mt-2 max-w-3xl">
          {announcements.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-700/55">No announcements yet.</p>
          ) : (
            (["pinned", "this_week", "last_month", "earlier"] as const).map((sec) => {
              const rows = announcements.filter((a) => a.section === sec);
              if (rows.length === 0) return null;
              return (
                <section key={sec}>
                  <h2 className="mt-6 mb-2.5 text-[15px] font-semibold text-ink-700/70">{ANNOUNCEMENT_SECTION[sec]}</h2>
                  <div className="space-y-2.5">
                    {rows.map((a) => (
                      <AnnouncementCardRow key={a.id} card={a} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}
