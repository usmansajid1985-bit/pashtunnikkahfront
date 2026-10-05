"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProfileViewsData } from "@/lib/dashboard";

function avatarUrl(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

export function ProfileViewsCard({ data }: { data: ProfileViewsData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function sendRequest(peerUserId: string, profileCode: string) {
    setBusyId(peerUserId);
    startTransition(async () => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileCode }),
      });
      const body = await res.json().catch(() => ({}));
      setBusyId(null);
      if (body.status === "accepted") router.push(`/chats/${body.requestId}`);
      else router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
      <div className="flex items-center gap-2.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-700" aria-hidden>
          <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
        <h2 className="font-bold text-ink-950">Profile views</h2>
      </div>
      <p className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-bold text-ink-950 tabular-nums">{data.summary.last7d}</span>
        <span className="text-sm text-ink-700/60">in the last 7 days</span>
      </p>

      {data.locked ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-rose-50/70 px-3.5 py-3">
          <p className="text-[13px] text-ink-700/75 leading-snug">
            Upgrade to Gold to see who viewed your profile and get more visibility.
          </p>
          <Link href="/settings/membership" className="text-[13px] font-semibold text-rose-600 hover:text-rose-700 whitespace-nowrap">
            Upgrade to Gold →
          </Link>
        </div>
      ) : data.viewers.length === 0 ? (
        <p className="mt-3 text-sm text-ink-700/55">No one has viewed your profile yet.</p>
      ) : (
        <div className={`mt-3 divide-y divide-ink-900/6 ${pending ? "opacity-60" : ""}`}>
          {data.viewers.slice(0, 8).map((v) => (
            <div key={v.id} className="flex items-center gap-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl(v.avatarSeed)}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
                style={{ filter: "blur(4px) saturate(0.85)" }}
              />
              <div className="min-w-0 flex-1">
                <Link href={`/p/${v.code}`} className="font-semibold text-sm text-ink-950 hover:text-rose-600">
                  {v.code}
                </Link>
                {v.place ? <p className="text-[11px] text-ink-700/45 truncate">{v.place}</p> : null}
              </div>
              <button
                type="button"
                disabled={pending && busyId === v.peerUserId}
                onClick={() => sendRequest(v.peerUserId, v.code)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                Send request
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
