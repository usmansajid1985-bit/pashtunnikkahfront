"use client";

import { useEffect, useMemo, useState } from "react";
import type { HubCard } from "@/lib/requests-hub-shared";
import { MatchedCard, PastMatchRow, ReceivedCard, SentCard, StatusLine } from "@/components/requests/request-cards";

type Tab = "incoming" | "sent" | "matched";

type HubData = {
  isGold: boolean;
  counts: {
    incoming: number;
    sent: number;
    matched: number;
    ended?: number;
  };
  incoming: HubCard[];
  sent: HubCard[];
  matched: HubCard[];
  ended?: HubCard[];
  declined: HubCard[];
  expired: HubCard[];
};

const TAB_IDS: Tab[] = ["incoming", "sent", "matched"];

/** `?tab=received` is the new name; `incoming` keeps older links (banners, emails) working. */
function toTab(raw?: string): Tab | null {
  if (raw === "received") return "incoming";
  return TAB_IDS.includes(raw as Tab) ? (raw as Tab) : null;
}

/** Received / Sent / Matched as one segmented control; only Received carries a count badge. */
function SegmentedTabs({ tab, onChange, received }: { tab: Tab; onChange: (t: Tab) => void; received: number }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "incoming", label: "Received" },
    { id: "sent", label: "Sent" },
    { id: "matched", label: "Matched" },
  ];
  return (
    <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-ink-900/[0.04] border border-ink-900/6 p-1">
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`h-11 rounded-full flex items-center justify-center gap-2 text-[15px] transition ${
              active ? "bg-white text-ink-950 font-bold shadow-[0_1px_4px_rgba(15,13,14,0.08)]" : "text-ink-700/60 font-medium hover:text-ink-900"
            }`}
          >
            {t.label}
            {t.id === "incoming" && received > 0 ? (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-rose-100 text-rose-600 text-[13px] font-bold flex items-center justify-center">
                {received}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function RequestsHub({ data, initialTab }: { data: HubData; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(toTab(initialTab) ?? "incoming");
  const [sort, setSort] = useState<"newest" | "oldest" | "compat">("newest");

  useEffect(() => {
    const t = toTab(initialTab);
    if (t) setTab(t);
  }, [initialTab]);

  const changeTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t === "incoming" ? "received" : t);
    window.history.replaceState(null, "", url);
  };

  const list = useMemo(() => {
    const rows = [...(tab === "incoming" ? data.incoming : tab === "sent" ? data.sent : data.matched)];
    if (sort === "oldest") rows.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    else if (sort === "compat" && tab === "matched") rows.sort((a, b) => b.compat - a.compat);
    else rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return rows;
  }, [tab, sort, data]);

  // The Sent list already shows every request I sent with its status; the history sections
  // below only cover requests I received.
  const sentIds = useMemo(() => new Set(data.sent.map((c) => c.id)), [data.sent]);
  const receivedDeclined = data.declined.filter((c) => !sentIds.has(c.id));
  const receivedExpired = data.expired.filter((c) => !sentIds.has(c.id));
  const ended = data.ended ?? [];

  return (
    <div>
      <SegmentedTabs tab={tab} onChange={changeTab} received={data.counts.incoming} />

      {tab === "matched" && list.length > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <label htmlFor="requests-sort" className="text-xs font-semibold text-ink-700/60">Sort</label>
          <select
            id="requests-sort"
            className="text-sm rounded-full border border-ink-900/10 bg-white px-3 py-1.5"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            {data.isGold ? <option value="compat">Compatibility</option> : null}
          </select>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {list.length === 0 && !(tab === "matched" && ended.length > 0) ? (
          <p className="text-sm text-ink-700/55 bg-white rounded-2xl border border-ink-900/6 px-4 py-10 text-center">
            {tab === "incoming"
              ? "No requests waiting for you right now."
              : tab === "sent"
                ? "You haven't sent any requests yet."
                : "No matches yet."}
          </p>
        ) : (
          list.map((card) =>
            tab === "incoming" ? (
              <ReceivedCard key={card.id} card={card} />
            ) : tab === "sent" ? (
              <SentCard key={card.id} card={card} />
            ) : (
              <MatchedCard key={card.id} card={card} />
            )
          )
        )}
      </div>

      {tab === "matched" && ended.length > 0 ? (
        <section className="mt-8">
          <h3 className="text-sm font-bold text-ink-950 mb-2">Past matches</h3>
          <div className="space-y-2">
            {ended.map((card) => (
              <PastMatchRow key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : null}

      {tab === "incoming" && (receivedDeclined.length > 0 || receivedExpired.length > 0) ? (
        <div className="mt-8 space-y-4">
          {receivedDeclined.length > 0 ? (
            <HistoryList title="Recently declined" cards={receivedDeclined} />
          ) : null}
          {receivedExpired.length > 0 ? <HistoryList title="Expired" cards={receivedExpired} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function HistoryList({ title, cards }: { title: string; cards: HubCard[] }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-ink-950 mb-2">{title}</h3>
      <div className="space-y-2">
        {cards.slice(0, 5).map((c) => (
          <a
            key={c.id}
            href={`/p/${c.code}`}
            className="flex items-center gap-3 bg-white/70 border border-ink-900/5 rounded-xl px-3 py-2.5 text-sm hover:bg-white"
          >
            <span className="font-semibold">{c.code}</span>
            <span className="text-ink-700/50">
              <StatusLine card={c} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
