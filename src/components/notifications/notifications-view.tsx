"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GroupedActivity, GroupedRow, RowCategory, RowSection } from "@/lib/notification-groups";
import type { AnnouncementCard } from "@/lib/announcements-shared";
import { AnnouncementCardRow } from "@/components/announcements/announcement-card";
import { NotificationRow } from "@/components/notifications/notification-row";
import { bumpNavCounts, refreshNavCounts } from "@/components/browse/nav-notifications";

const ANNOUNCEMENT_SECTION: Record<AnnouncementCard["section"], string> = {
  pinned: "Pinned",
  this_week: "This week",
  last_month: "Last month",
  earlier: "Earlier",
};

const SECTION_LABEL: Record<RowSection, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Earlier this week",
  older: "Earlier",
};

const CHIPS: { id: "all" | RowCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "request", label: "Requests" },
  { id: "match", label: "Matches" },
  { id: "family", label: "Family" },
  { id: "view", label: "Views" },
  { id: "token", label: "Tokens" },
];

const SECTIONS: RowSection[] = ["today", "yesterday", "week", "older"];

export function NotificationsView({
  initialTab,
  initialActivity,
  initialAnnouncements,
}: {
  initialTab: "activity" | "announcements";
  initialActivity: GroupedActivity;
  initialAnnouncements: AnnouncementCard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"activity" | "announcements">(initialTab);
  const [rows, setRows] = useState<GroupedRow[]>(initialActivity.rows);
  const [attentionKeys, setAttentionKeys] = useState<string[]>(initialActivity.attentionKeys);
  const [cursor, setCursor] = useState<string | null>(initialActivity.nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chip, setChip] = useState<"all" | RowCategory>("all");

  const announcements = initialAnnouncements;
  const unreadAnnouncements = announcements.filter((a) => !a.read).length;
  const unreadRows = rows.filter((r) => r.unread).length;

  function chooseTab(t: "activity" | "announcements") {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "announcements") url.searchParams.set("tab", "announcements");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  /** Mark a group's events read — one PATCH for every id in the row. */
  function markRead(ids: string[]) {
    const nowUnread = rows.filter((r) => r.unread && r.ids.some((id) => ids.includes(id)));
    if (nowUnread.length === 0) return;
    setRows((prev) =>
      prev.map((r) => (r.ids.some((id) => ids.includes(id)) ? { ...r, unread: false } : r))
    );
    bumpNavCounts({ bellUnread: -nowUnread.length });
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then(() => refreshNavCounts())
      .catch(() => {});
  }

  function markAllRead() {
    const stillUnread = rows.filter((r) => r.unread).length;
    setRows((prev) => prev.map((r) => ({ ...r, unread: false })));
    if (stillUnread > 0) bumpNavCounts({ bellUnread: -stillUnread });
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
      .then(() => refreshNavCounts())
      .catch(() => {});
    router.refresh();
  }

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/notifications?grouped=1&before=${encodeURIComponent(cursor)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { activity: GroupedActivity };
        const existing = new Set(rows.map((r) => r.key));
        setRows((prev) => [...prev, ...data.activity.rows.filter((r) => !existing.has(r.key))]);
        setCursor(data.activity.nextCursor);
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  const matchesChip = (r: GroupedRow) => chip === "all" || r.category === chip;
  const attentionSet = new Set(attentionKeys);
  const attentionRows = rows.filter((r) => attentionSet.has(r.key) && r.needsAction && matchesChip(r));
  const timeRows = rows.filter((r) => !(attentionSet.has(r.key) && r.needsAction) && matchesChip(r));

  const newToday = rows.filter((r) => r.section === "today" && r.unread).length;
  const summaryBits: string[] = [];
  if (attentionRows.length > 0)
    summaryBits.push(
      attentionRows.length === 1 ? "1 thing needs you" : `${attentionRows.length} things need you`
    );
  if (newToday > 0) summaryBits.push(`${newToday} new today`);
  const summary = summaryBits.join(" · ") || "You're all caught up";

  // keep attentionKeys in sync if a row stops needing action after a mutation/refresh
  void setAttentionKeys;

  return (
    <div className="mx-auto w-full max-w-[680px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="lg:hidden -ml-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-900/5"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="font-display text-[22px] font-semibold lg:text-[30px]" style={{ color: "#201A1D" }}>
              Notifications
            </h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "#776C71" }}>
              {summary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={markAllRead}
            className="hidden h-9 items-center rounded-full border px-3 text-[13px] font-semibold sm:inline-flex"
            style={{ borderColor: "rgba(32,26,29,0.12)", color: "#5E5459" }}
          >
            Mark all as read
          </button>
          <button
            type="button"
            onClick={markAllRead}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink-900/5 sm:hidden"
            aria-label="Mark all as read"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E5459" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </button>
          <Link
            href="/settings/notifications"
            aria-label="Notification settings"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink-900/5 sm:h-9 sm:w-9"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5E5459" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-ink-900/[0.04] p-1 text-[15px] font-semibold">
        {(["activity", "announcements"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => chooseTab(t)}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl transition ${
              tab === t ? "bg-white text-ink-900 shadow-[0_1px_3px_rgba(15,13,14,0.06)]" : "text-ink-700/60 hover:text-ink-900"
            }`}
          >
            {t === "activity" ? "Activity" : "Announcements"}
            {(t === "activity" ? unreadRows : unreadAnnouncements) > 0 ? (
              <span
                className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold text-white"
                style={{ background: "#C8235F" }}
              >
                {t === "activity" ? unreadRows : unreadAnnouncements}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Activity */}
      {tab === "activity" ? (
        <div className="mt-4">
          {/* Filter chips — one row, scrolls sideways on mobile */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChip(c.id)}
                className={`h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition ${
                  chip === c.id ? "text-white" : ""
                }`}
                style={
                  chip === c.id
                    ? { background: "#201A1D", borderColor: "#201A1D" }
                    : { borderColor: "rgba(32,26,29,0.12)", color: "#5E5459" }
                }
              >
                {c.label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Needs your attention */}
              {attentionRows.length > 0 ? (
                <section className="mt-7">
                  <h2 className="mb-3 px-1 font-display text-base font-medium" style={{ color: "#201A1D" }}>
                    Needs your attention
                  </h2>
                  <div className="divide-y divide-[#F1D0DD] overflow-hidden rounded-[18px] border border-[#F1D0DD] bg-white">
                    {attentionRows.map((row) => (
                      <div key={row.key}>
                        <NotificationRow row={row} onRead={markRead} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Time sections */}
              {SECTIONS.map((sec) => {
                const secRows = timeRows.filter((r) => r.section === sec);
                if (secRows.length === 0) return null;
                const standard = secRows.filter((r) => r.variant !== "milestone");
                const milestones = secRows.filter((r) => r.variant === "milestone");
                return (
                  <section key={sec} className="mt-8">
                    <div className="mb-3 flex items-baseline justify-between px-1">
                      <h2 className="font-display text-base font-medium" style={{ color: "#201A1D" }}>
                        {SECTION_LABEL[sec]}
                      </h2>
                    </div>
                    <div className="space-y-3">
                      {standard.length > 0 ? (
                        <div className="divide-y divide-ink-900/8 overflow-hidden rounded-[18px] border border-ink-900/8 bg-white shadow-[0_1px_2px_rgba(32,26,29,0.04),0_10px_28px_-16px_rgba(32,26,29,0.12)]">
                          {standard.map((row) => (
                            <NotificationRow key={row.key} row={row} onRead={markRead} />
                          ))}
                        </div>
                      ) : null}
                      {milestones.map((row) => (
                        <NotificationRow key={row.key} row={row} onRead={markRead} />
                      ))}
                    </div>
                  </section>
                );
              })}

              {timeRows.length === 0 && attentionRows.length === 0 ? (
                <p className="mt-10 text-center text-sm" style={{ color: "#776C71" }}>
                  Nothing in this filter.
                </p>
              ) : null}

              {cursor ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="h-10 rounded-full border px-5 text-[13px] font-semibold disabled:opacity-50"
                    style={{ borderColor: "rgba(32,26,29,0.12)", color: "#5E5459" }}
                  >
                    {loadingOlder ? "Loading…" : "Show older notifications"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Announcements */}
      {tab === "announcements" ? (
        <div className="mt-4">
          {announcements.length === 0 ? (
            <p className="mt-10 text-center text-sm" style={{ color: "#776C71" }}>
              No announcements yet.
            </p>
          ) : (
            (["pinned", "this_week", "last_month", "earlier"] as const).map((sec) => {
              const secRows = announcements.filter((a) => a.section === sec);
              if (secRows.length === 0) return null;
              return (
                <section key={sec}>
                  <h2 className="mb-2.5 mt-6 text-[15px] font-semibold text-ink-700/70">{ANNOUNCEMENT_SECTION[sec]}</h2>
                  <div className="space-y-2.5">
                    {secRows.map((a) => (
                      <AnnouncementCardRow key={a.id} card={a} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "#FCEFF4" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8235F" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </div>
      <p className="mt-4 text-[15px] font-semibold" style={{ color: "#201A1D" }}>
        No notifications yet
      </p>
      <p className="mt-1 text-[13px]" style={{ color: "#776C71" }}>
        When members view you or send requests, you&apos;ll see it here.
      </p>
      <Link
        href="/browse"
        className="mt-4 h-10 rounded-full px-5 text-[13px] font-semibold leading-10 text-white"
        style={{ background: "#C8235F" }}
      >
        Browse profiles
      </Link>
    </div>
  );
}
