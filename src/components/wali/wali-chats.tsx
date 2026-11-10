"use client";

import Link from "next/link";
import { useState } from "react";

export type WaliThread = {
  requestId: string;
  peerCode: string;
  avatarUrl: string;
  photoVisible: boolean;
  lastMessage: string | null;
  ended: boolean;
};

function Row({ t }: { t: WaliThread }) {
  return (
    <Link
      href={`/wali/chats/${t.requestId}`}
      className="flex items-center gap-3 px-5 py-3.5 border-t border-ink-900/6 hover:bg-ink-900/[0.03]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={t.avatarUrl}
        alt=""
        className="w-11 h-11 rounded-full object-cover shrink-0 border border-[#E5E7EB]"
        style={t.photoVisible ? undefined : { filter: "blur(5px) saturate(0.9)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-ink-950 truncate">{t.peerCode}</span>
          {t.ended ? (
            <span className="shrink-0 rounded-full bg-ink-900/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700/60">
              Ended
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </span>
        <span className="text-[13px] text-ink-700/65 block truncate mt-0.5">
          {t.lastMessage || "No messages yet"}
        </span>
      </span>
    </Link>
  );
}

/**
 * Wali chat list split into Active and Past conversations (T3). Ended matches move to Past (still
 * read-only, with an Ended badge); active ones show a green Live badge. Blocked conversations are
 * already excluded upstream, so they appear in neither tab.
 */
export function WaliChats({ active, past }: { active: WaliThread[]; past: WaliThread[] }) {
  const [tab, setTab] = useState<"active" | "past">(active.length === 0 && past.length > 0 ? "past" : "active");
  const rows = tab === "active" ? active : past;

  return (
    <section className="bg-white rounded-2xl border border-ink-900/8 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-bold text-ink-950">Chats</h2>
        <p className="text-xs text-ink-700/50 mt-0.5">Read-only — you can view messages but not send any.</p>
      </div>

      <div role="tablist" className="px-5 flex gap-6 text-[14px] border-b border-ink-900/6">
        {(["active", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`pb-2.5 font-semibold transition ${
              tab === t ? "text-ink-950 border-b-[3px] border-rose-700" : "text-ink-700/45 hover:text-ink-900"
            }`}
          >
            {t === "active" ? "Active" : "Past conversations"}
            <span className="ml-1.5 text-[12px] font-medium text-ink-700/40">
              {t === "active" ? active.length : past.length}
            </span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-700/60">
          {tab === "active" ? "No active conversations." : "No past conversations."}
        </p>
      ) : (
        <div>
          {rows.map((t) => (
            <Row key={t.requestId} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}
