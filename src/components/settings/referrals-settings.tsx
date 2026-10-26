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
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#f4f2f3] text-[#e12d72]" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
          <path d="M2.5 9h19V6.5h-19V9ZM12 6.5V20M12 6.5S10.5 3 8 3.5 6.5 6.5 12 6.5ZM12 6.5s1.5-3.5 4-3S17.5 6.5 12 6.5Z" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-ink-950">Refer a friend</span>
        <span className="block text-[12.5px] text-ink-700/65 mt-0.5 leading-snug">
          Share your link when a friend signs up · Referrals: {data.count ?? 0}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <code className="text-[11.5px] bg-[#f6f4f5] px-2 py-0.5 rounded-md text-ink-900">{data.code}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(data.link ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#e12d72]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
            </svg>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </span>
      </span>
    </div>
  );
}
