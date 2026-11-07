"use client";

import { useEffect, useMemo, useState } from "react";
import type { HubCard } from "@/lib/requests-hub-shared";
import { MatchedCard, ReceivedCard, SentCard } from "@/components/requests/request-cards";

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

/** Received / Sent / Matched. Only Received shows a count — the requests waiting for your answer. */
function SegmentedTabs({
  tab,
  onChange,
  counts,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  counts: { incoming: number; sent: number; matched: number };
}) {
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "incoming", label: "Received", count: counts.incoming },
    { id: "sent", label: "Sent", count: 0 },
    { id: "matched", label: "Matched", count: 0 },
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
            {t.count > 0 ? (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-rose-100 text-rose-600 text-[13px] font-bold flex items-center justify-center">
                {t.count}
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
    // Matched cards display the accepted/matched date (statusAt), so sort by that same timestamp —
    // sorting by the original request date contradicted the dates shown (PN-AUD matched sorting).
    const key = (c: (typeof rows)[number]) => (tab === "matched" ? c.statusAt || c.createdAt : c.createdAt);
    rows.sort((a, b) => +new Date(key(b)) - +new Date(key(a)));
    return rows;
  }, [tab, data]);

  // The Sent list already shows every request I sent with its status; the history sections
  // below only cover requests I received.
  const pendingSent = useMemo(
    () => data.sent.filter((c) => (c.status || "pending") === "pending"),
    [data.sent]
  );
  const sentHistory = useMemo(
    () => data.sent.filter((c) => (c.status || "pending") !== "pending"),
    [data.sent]
  );
  return (
    <div>
      <SegmentedTabs tab={tab} onChange={changeTab} counts={data.counts} />

      {tab === "sent" && pendingSent.length === 0 && sentHistory.length === 0 ? (
        <p className="mt-4 text-sm text-ink-700/55 bg-white rounded-2xl border border-ink-900/6 px-4 py-10 text-center">
          You haven&apos;t sent any requests yet.
        </p>
      ) : null}

      {tab === "sent" && (pendingSent.length > 0 || sentHistory.length > 0) ? (
        <div className="mt-5 space-y-8">
          <section>
            <h3 className="text-sm font-bold text-ink-950">Pending requests</h3>
            <p className="mt-0.5 text-[13px] text-ink-700/55">
              {pendingSent.length === 0
                ? "None waiting for a response."
                : `${pendingSent.length} awaiting a response`}
            </p>
            <div className="mt-3 space-y-3">
              {pendingSent.map((card) => (
                <SentCard key={card.id} card={card} />
              ))}
            </div>
          </section>
          {sentHistory.length > 0 ? (
            <section>
              <h3 className="text-sm font-bold text-ink-950">Sent history</h3>
              <p className="mt-0.5 text-[13px] text-ink-700/55">
                {sentHistory.length} previous request{sentHistory.length === 1 ? "" : "s"}
              </p>
              <div className="mt-3 space-y-3">
                {sentHistory.map((card) => (
                  <SentCard key={card.id} card={card} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab !== "sent" ? (
      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-ink-700/55 bg-white rounded-2xl border border-ink-900/6 px-4 py-10 text-center">
            {tab === "incoming" ? "No requests waiting for you right now." : "No matches yet."}
          </p>
        ) : (
          list.map((card) =>
            tab === "incoming" ? (
              <ReceivedCard key={card.id} card={card} />
            ) : (
              <MatchedCard key={card.id} card={card} />
            )
          )
        )}
      </div>
      ) : null}
    </div>
  );
}
