"use client";

import Link from "next/link";
import { RematchButton } from "@/components/matches/rematch-button";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HubCard } from "@/lib/requests-hub-shared";
import { formatAgeLabel } from "@/lib/requests-hub-shared";
import { RequestActions } from "@/components/matches/request-actions";

type Tab = "incoming" | "sent" | "matches" | "views" | "saved" | "blocked";

type HubData = {
  isGold: boolean;
  counts: {
    incoming: number;
    sent: number;
    matches: number;
    ended?: number;
    views: number | null;
    saved: number | null;
    blocked: number;
  };
  incoming: HubCard[];
  sent: HubCard[];
  matches: HubCard[];
  ended?: HubCard[];
  declined: HubCard[];
  expired: HubCard[];
  views: HubCard[];
  viewsLocked: boolean;
  viewsSummary: { total: number; last7d: number; last30d: number } | null;
  saved: HubCard[];
  savedLocked: boolean;
  savedLimit: number | null;
  blocked: HubCard[];
};

function avatarUrl(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

const TAB_IDS: Tab[] = ["incoming", "sent", "matches", "views", "saved", "blocked"];

export function RequestsHub({ data, initialTab }: { data: HubData; initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    TAB_IDS.includes(initialTab as Tab) ? (initialTab as Tab) : "incoming"
  );
  const [sort, setSort] = useState<"newest" | "oldest" | "compat">("newest");
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteSavedId, setNoteSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab && TAB_IDS.includes(initialTab as Tab)) setTab(initialTab as Tab);
  }, [initialTab]);

  const tabs: { id: Tab; label: string; count?: number | null }[] = [
    { id: "incoming", label: "Incoming", count: data.counts.incoming },
    { id: "sent", label: "Sent", count: data.counts.sent },
    { id: "matches", label: "Matches", count: data.counts.matches },
    { id: "views", label: "Views", count: data.counts.views },
    { id: "saved", label: "Saved", count: data.counts.saved },
    { id: "blocked", label: "Blocked", count: data.counts.blocked },
  ];

  const list = useMemo(() => {
    let rows: HubCard[] = [];
    if (tab === "incoming") rows = data.incoming;
    else if (tab === "sent") rows = data.sent;
    else if (tab === "matches") rows = data.matches;
    else if (tab === "views") rows = data.views;
    else if (tab === "saved") rows = data.saved;
    else rows = data.blocked;

    const sorted = [...rows];
    if (sort === "newest") sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === "oldest") sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (sort === "compat") sorted.sort((a, b) => b.compat - a.compat);
    return sorted;
  }, [tab, sort, data]);

  async function unsave(peerUserId: string) {
    startTransition(async () => {
      await fetch("/api/favourites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peerUserId }),
      });
      router.refresh();
    });
  }

  async function save(peerUserId: string) {
    setSaveError(null);
    startTransition(async () => {
      const res = await fetch("/api/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peerUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Could not save this profile.");
        return;
      }
      router.refresh();
    });
  }

  async function saveNote(peerUserId: string, cardId: string, note: string) {
    await fetch("/api/favourites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: peerUserId, note }),
    });
    setNoteSavedId(cardId);
    setTimeout(() => setNoteSavedId((id) => (id === cardId ? null : id)), 1800);
    router.refresh();
  }

  async function unblock(peerUserId: string) {
    startTransition(async () => {
      await fetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peerUserId }),
      });
      router.refresh();
    });
  }

  const viewsIdentityLocked = tab === "views" && data.viewsLocked && !data.isGold;
  const savedCapped = tab === "saved" && !data.isGold && data.savedLimit != null;
  const savedAtCap = savedCapped && data.saved.length >= (data.savedLimit ?? 0);

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

      {!viewsIdentityLocked && (tab === "incoming" || tab === "matches" || tab === "views" || tab === "saved") ? (
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

      {savedCapped ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
          <p className="text-sm text-ink-800">
            <span className="font-semibold">
              {data.saved.length} of {data.savedLimit} saved
            </span>{" "}
            — Free members can save up to {data.savedLimit}. Upgrade to Gold for unlimited.
          </p>
          <Link
            href="/settings/membership"
            className="shrink-0 px-3.5 py-1.5 rounded-full bg-amber-600 text-white text-xs font-semibold"
          >
            Upgrade
          </Link>
        </div>
      ) : null}

      {saveError ? (
        <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          {saveError}
        </p>
      ) : null}

      <div className={`mt-4 space-y-2 ${pending ? "opacity-60" : ""}`}>
        {viewsIdentityLocked ? (
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 text-center">
            <p className="font-bold text-ink-950 text-lg">
              {data.viewsSummary && data.viewsSummary.total > 0
                ? `${data.viewsSummary.total} people viewed your profile`
                : "No one has viewed your profile yet"}
            </p>
            {data.viewsSummary && data.viewsSummary.total > 0 ? (
              <p className="mt-1 text-sm text-ink-700/60">
                {data.viewsSummary.last7d} in the last 7 days · {data.viewsSummary.last30d} in the last 30
                days
              </p>
            ) : null}
            <p className="mt-2 text-sm text-ink-700/70 max-w-sm mx-auto">
              Upgrade to Gold to reveal who visited you, see compatibility, and send a request.
            </p>
            <Link
              href="/settings/membership"
              className="inline-block mt-5 px-5 py-2.5 rounded-full bg-amber-600 text-white text-sm font-semibold"
            >
              Upgrade to Gold
            </Link>
          </div>
        ) : list.length === 0 && !(tab === "matches" && (data.ended?.length ?? 0) > 0) ? (
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
                    tab === "matches" && card.photoShared
                      ? undefined
                      : { filter: "blur(6px) saturate(0.85)" }
                  }
                />
                {tab === "matches" ? (
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
                    {tab === "matches" && card.lastMessage ? (
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
                    <RequestActions requestId={card.requestId} mode="incoming" />
                  ) : null}
                  {tab === "sent" && card.requestId && card.status === "pending" ? (
                    <RequestActions requestId={card.requestId} mode="sent" />
                  ) : null}
                  {tab === "matches" && card.requestId ? (
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
                  {tab === "views" ? (
                    <>
                      <Link
                        href={`/p/${card.code}`}
                        className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                      >
                        Open profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => void save(card.peerUserId)}
                        className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch("/api/matches", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ profileCode: card.code }),
                          });
                          const body = await res.json();
                          if (body.status === "accepted") router.push(`/chats/${body.requestId}`);
                          else router.refresh();
                        }}
                        className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-sm font-semibold"
                      >
                        Send request
                      </button>
                    </>
                  ) : null}
                  {tab === "saved" ? (
                    <>
                      <Link
                        href={`/p/${card.code}`}
                        className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                      >
                        Open profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => void unsave(card.peerUserId)}
                        className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/matches", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ profileCode: card.code }),
                          });
                          router.refresh();
                        }}
                        className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-sm font-semibold"
                      >
                        Send request
                      </button>
                    </>
                  ) : null}
                  {tab === "blocked" ? (
                    <button
                      type="button"
                      onClick={() => void unblock(card.peerUserId)}
                      className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                    >
                      Unblock
                    </button>
                  ) : null}
                </div>

                {tab === "saved" ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      value={noteDrafts[card.id] ?? card.note ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [card.id]: e.target.value }))
                      }
                      onBlur={(e) => void saveNote(card.peerUserId, card.id, e.target.value)}
                      placeholder="Private note (only you can see this)"
                      className="flex-1 min-w-0 text-[12.5px] rounded-lg border border-ink-900/10 bg-[#faf8f7] px-2.5 py-1.5 focus:outline-none focus:border-rose-300 focus:bg-white"
                    />
                    {noteSavedId === card.id ? (
                      <span className="text-[11px] text-emerald-700 font-medium shrink-0">Saved</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          {tab === "matches" && (data.ended?.length ?? 0) > 0 ? (
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
