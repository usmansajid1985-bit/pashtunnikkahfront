"use client";

import Link from "next/link";
import { RematchButton } from "@/components/matches/rematch-button";
import { useEffect, useMemo, useState } from "react";
import type { HubCard } from "@/lib/requests-hub-shared";
import { formatAgeLabel } from "@/lib/requests-hub-shared";
import { RequestActions } from "@/components/matches/request-actions";

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

function avatarUrl(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

const TAB_IDS: Tab[] = ["incoming", "sent", "matched"];

export function RequestsHub({ data, initialTab }: { data: HubData; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(
    TAB_IDS.includes(initialTab as Tab) ? (initialTab as Tab) : "incoming"
  );
  const [sort, setSort] = useState<"newest" | "oldest" | "compat">("newest");

  useEffect(() => {
    if (initialTab && TAB_IDS.includes(initialTab as Tab)) setTab(initialTab as Tab);
  }, [initialTab]);

  const tabs: { id: Tab; label: string; count?: number | null }[] = [
    { id: "incoming", label: "Incoming", count: data.counts.incoming },
    { id: "sent", label: "Sent", count: data.counts.sent },
    { id: "matched", label: "Matched", count: data.counts.matched },
  ];

  const list = useMemo(() => {
    let rows: HubCard[] = [];
    if (tab === "incoming") rows = data.incoming;
    else if (tab === "sent") rows = data.sent;
    else rows = data.matched;

    const sorted = [...rows];
    if (sort === "newest") sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === "oldest") sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (sort === "compat") sorted.sort((a, b) => b.compat - a.compat);
    return sorted;
  }, [tab, sort, data]);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold transition ${
              tab === t.id
                ? "bg-rose-600 text-white"
                : "bg-white border border-ink-900/8 text-ink-700 hover:border-rose-200"
            }`}
          >
            {t.label}
            {t.count != null ? (
              <span className={`ml-1.5 ${tab === t.id ? "text-white/80" : "text-ink-700/45"}`}>
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "incoming" || tab === "matched" ? (
        <div className="mt-4 flex items-center gap-2">
          <label className="text-xs font-semibold text-ink-700/60">Sort</label>
          <select
            className="text-sm rounded-full border border-ink-900/10 bg-white px-3 py-1.5"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="compat">Highest compatibility</option>
          </select>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {list.length === 0 && !(tab === "matched" && (data.ended?.length ?? 0) > 0) ? (
          <p className="text-sm text-ink-700/55 bg-white rounded-2xl border border-ink-900/6 px-4 py-8 text-center">
            Nothing here yet.
          </p>
        ) : (
          <>
          {list.map((card) => (
            <article
              key={card.id}
              className="bg-white rounded-2xl border border-ink-900/6 px-4 py-3.5 flex gap-3 items-start"
            >
              <Link href={`/p/${card.code}`} className="shrink-0 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl(card.avatarSeed)}
                  alt=""
                  className="w-14 h-14 rounded-2xl object-cover"
                  style={
                    tab === "matched" && card.photoShared
                      ? undefined
                      : { filter: "blur(6px) saturate(0.85)" }
                  }
                />
                {tab === "matched" ? (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[9px] font-bold uppercase tracking-wide border border-rose-100">
                    matched
                  </span>
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/p/${card.code}`} className="font-bold text-ink-950 hover:text-rose-600">
                      {card.code}
                    </Link>
                    <p className="text-[12px] text-ink-700/60 truncate mt-0.5">{card.summary}</p>
                    {card.place ? (
                      <p className="text-[11px] text-ink-700/45 truncate">{card.place}</p>
                    ) : null}
                    {tab === "incoming" && card.introMessage ? (
                      <p className="text-[12px] text-ink-700 mt-1 line-clamp-2 italic">
                        “{card.introMessage}”
                      </p>
                    ) : null}
                    {tab === "matched" && card.lastMessage ? (
                      <p className="text-[12px] text-ink-700 mt-1 line-clamp-1">“{card.lastMessage}”</p>
                    ) : null}
                    {tab === "sent" && card.status ? (
                      <p className="text-[11px] font-semibold text-ink-700/55 mt-1 capitalize">{card.status}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-ink-700/45">{formatAgeLabel(card.createdAt)}</p>
                    <p className="mt-1 text-sm font-bold text-rose-600">{card.compat}%</p>
                    <p className="text-[10px] text-ink-700/40">compat</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tab === "incoming" && card.requestId ? (
                    <RequestActions requestId={card.requestId} mode="incoming" peerUserId={card.peerUserId} />
                  ) : null}
                  {tab === "sent" && card.requestId && card.status === "pending" ? (
                    <RequestActions requestId={card.requestId} mode="sent" />
                  ) : null}
                  {tab === "matched" && card.requestId ? (
                    <>
                      <Link
                        href={`/chats/${card.requestId}`}
                        className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-sm font-semibold"
                      >
                        Open chat
                      </Link>
                      <Link
                        href={`/p/${card.code}`}
                        className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                      >
                        Profile
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {tab === "matched" && (data.ended?.length ?? 0) > 0 ? (
            <section className="mt-8">
              <h3 className="text-sm font-bold text-ink-950 mb-2">Past matches</h3>
              <div className="space-y-2">
                {data.ended!.map((card) => (
                  <article
                    key={card.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/80 border border-ink-900/6 rounded-2xl px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl(card.avatarSeed)}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover shrink-0 opacity-80"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-950 truncate">{card.code}</p>
                        <p className="text-[13px] text-ink-700/55 truncate">
                          Ended · {formatAgeLabel(card.createdAt)}
                          {card.lastMessage ? ` · ${card.lastMessage.slice(0, 48)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {card.requestId ? (
                        <Link
                          href={`/chats/${card.requestId}`}
                          className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                        >
                          View chat
                        </Link>
                      ) : null}
                      <Link
                        href={`/p/${card.code}`}
                        className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                      >
                        Profile
                      </Link>
                      <RematchButton profileCode={card.code} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          </>
        )}
      </div>

      {(tab === "incoming" || tab === "sent") && (data.declined.length > 0 || data.expired.length > 0) ? (
        <div className="mt-8 space-y-4">
          {data.declined.length > 0 ? (
            <section>
              <h3 className="text-sm font-bold text-ink-950 mb-2">Recently declined</h3>
              <div className="space-y-2">
                {data.declined.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={`/p/${c.code}`}
                    className="flex items-center gap-3 bg-white/70 border border-ink-900/5 rounded-xl px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold">{c.code}</span>
                    <span className="text-ink-700/50">{formatAgeLabel(c.createdAt)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {data.expired.length > 0 ? (
            <section>
              <h3 className="text-sm font-bold text-ink-950 mb-2">Expired</h3>
              <div className="space-y-2">
                {data.expired.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 bg-white/70 border border-ink-900/5 rounded-xl px-3 py-2.5 text-sm">
                    <span className="font-semibold">{c.code}</span>
                    <span className="text-ink-700/50">{formatAgeLabel(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
