"use client";

import { useEffect, useState } from "react";

export function ReferralsSettings() {
  const [data, setData] = useState<{ code?: string; link?: string; count?: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetch("/api/account/referrals")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data?.code) return null;

  return (
    <section className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-4">
      <h3 className="font-bold text-ink-950">Refer a friend</h3>
      <p className="mt-1 text-[12.5px] text-ink-700/65">
        Share your link when a friend signs up. Referrals: {data.count ?? 0}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <code className="text-xs bg-[#faf8f7] px-2 py-1 rounded-lg">{data.code}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(data.link ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="text-xs font-semibold text-rose-600"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
