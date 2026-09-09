"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ActivityNotification, UpdateItem } from "@/lib/notifications";

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

function UpdateGlyph({ category }: { category: string }) {
  const map: Record<string, { bg: string; icon: React.ReactNode }> = {
    referral: {
      bg: "bg-rose-50 text-rose-500",
      icon: <path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7S9 2 6.5 3.5 8 7 12 7m0 0s3-5 5.5-3.5S16 7 12 7" />,
    },
    feature: {
      bg: "bg-amber-50 text-amber-500",
      icon: <path d="M12 2l2.4 5 5.6.8-4 4 1 5.6L12 15l-5 2.4 1-5.6-4-4L9.6 7 12 2Z" />,
    },
    safety: {
      bg: "bg-violet-50 text-violet-500",
      icon: <path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3ZM9 12l2 2 4-4" />,
    },
    maintenance: {
      bg: "bg-blue-50 text-blue-500",
      icon: <path d="M14 7a4 4 0 0 1-5.5 5.5L4 17l3 3 4.5-4.5A4 4 0 0 0 17 10l-3-3Z" />,
    },
    policy: {
      bg: "bg-rose-50 text-rose-400",
      icon: <path d="M7 3h7l5 5v13H7V3ZM14 3v5h5M10 13h6M10 17h6" />,
    },
    major: {
      bg: "bg-rose-50 text-rose-500",
      icon: <path d="M3 11l19-8-8 19-2-8-9-3Z" />,
    },
    general: {
      bg: "bg-ink-900/5 text-ink-700",
      icon: <path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z" />,
    },
  };
  const c = map[category] ?? map.general;
  return (
    <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${c.bg}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        {c.icon}
      </svg>
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
  initialUpdates,
}: {
  initialTab: "activity" | "updates";
  initialActivity: ActivityNotification[];
  initialUpdates: UpdateItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"activity" | "updates">(initialTab);
  const [activity, setActivity] = useState(initialActivity);
  const [updates] = useState(initialUpdates);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const updatesMarked = useRef(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Opening the Updates tab marks announcements as seen (spec §14).
  useEffect(() => {
    if (tab === "updates" && !updatesMarked.current) {
      updatesMarked.current = true;
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markUpdatesRead: true }),
      }).then(() => router.refresh());
    }
  }, [tab, router]);

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
  const pinned = updates.filter((u) => u.pinned);
  const featured = pinned.find((u) => u.featured) ?? pinned[0];
  const restPinned = pinned.filter((u) => u.id !== featured?.id);
  const nonPinned = updates.filter((u) => !u.pinned);

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
      <div className="mt-4 flex border-b border-ink-900/10 text-[15px] font-semibold">
        {(["activity", "updates"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 pb-2.5 text-center transition ${
              tab === t ? "text-ink-950 border-b-2 border-rose-600" : "text-ink-700/45"
            }`}
          >
            {t === "activity" ? "Activity" : "Updates"}
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
                          {n.body ? (
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

      {/* Updates */}
      {tab === "updates" ? (
        <div className="mt-2">
          {updates.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-700/55">No announcements yet.</p>
          ) : (
            <>
              {featured ? (
                <>
                  <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/45">
                    Pinned
                  </p>
                  <Link
                    href={featured.ctaUrl || "#"}
                    className="block relative overflow-hidden rounded-2xl bg-ink-950 text-white p-5 min-h-[150px]"
                    style={
                      featured.imageUrl
                        ? {
                            backgroundImage: `linear-gradient(90deg, rgba(10,10,12,.82), rgba(10,10,12,.35)), url(${featured.imageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-rose-600 px-2 py-0.5 rounded">
                      {featured.category === "major" ? "Major Update" : "Update"}
                    </span>
                    <p className="mt-2 text-xl font-bold leading-tight">{featured.title}</p>
                    <p className="mt-1 text-sm text-white/80 line-clamp-2 max-w-sm">{featured.body}</p>
                    {featured.ctaLabel ? (
                      <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white text-ink-950 text-sm font-semibold px-3.5 py-1.5">
                        {featured.ctaLabel} <Chevron />
                      </span>
                    ) : null}
                  </Link>
                </>
              ) : null}

              {[...restPinned, ...nonPinned].length > 0 ? (
                <div className="mt-5">
                  {["this_week", "earlier"].map((sec) => {
                    const rows = [...restPinned, ...nonPinned].filter(
                      (u) => (u.pinned ? "this_week" : u.section) === sec
                    );
                    if (rows.length === 0) return null;
                    return (
                      <div key={sec}>
                        <p className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/45">
                          {SECTION_LABEL[sec]}
                        </p>
                        <div className="divide-y divide-ink-900/6">
                          {rows.map((u) => (
                            <Link
                              key={u.id}
                              href={u.ctaUrl || "#"}
                              className={`flex items-start gap-3 py-3.5 -mx-1 px-1 rounded-lg ${
                                u.read ? "" : "bg-rose-50/40"
                              }`}
                            >
                              <UpdateGlyph category={u.category} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-semibold leading-snug text-ink-950">
                                  {u.title}
                                  {u.goldOnly ? (
                                    <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                      Gold Only
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-[13px] text-ink-700/70 mt-0.5 line-clamp-2">{u.body}</p>
                                <p className="text-[12px] text-ink-700/45 mt-1">{timeAgo(u.publishedAt)}</p>
                              </div>
                              <div className="self-center">
                                <Chevron />
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
