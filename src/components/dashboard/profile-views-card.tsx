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
      <h2 className="font-bold text-ink-950">Profile Views</h2>

      {data.locked ? (
        <div className="mt-3">
          <p className="text-sm text-ink-950">
            {data.summary && data.summary.total > 0
              ? `${data.summary.total} people viewed your profile`
              : "No one has viewed your profile yet"}
          </p>
          {data.summary && data.summary.total > 0 ? (
            <p className="mt-1 text-xs text-ink-700/60">
              {data.summary.last7d} in the last 7 days · {data.summary.last30d} in the last 30 days
            </p>
          ) : null}
          <p className="mt-2 text-sm text-ink-700/70">
            Upgrade to Gold to see who viewed you and send them a request.
          </p>
          <Link
            href="/settings/membership"
            className="inline-block mt-3 px-4 py-2 rounded-full bg-amber-600 text-white text-xs font-semibold"
          >
            Upgrade to Gold
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
