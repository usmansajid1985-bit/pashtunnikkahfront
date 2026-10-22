"use client";

import { useState } from "react";
import { describeSignIn } from "@/lib/sign-in-device";

export type SignInRow = { at: string; ip: string | null; userAgent: string | null };

function when(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return `${date} · ${time}`;
}

function DeviceIcon({ kind }: { kind: ReturnType<typeof describeSignIn>["kind"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7 };
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900/[0.04] text-ink-700/55">
      {kind === "phone" ? (
        <svg {...common} aria-hidden>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M11 18h2" />
        </svg>
      ) : kind === "laptop" ? (
        <svg {...common} aria-hidden>
          <rect x="4" y="5" width="16" height="11" rx="1.5" />
          <path d="M2 19h20" />
        </svg>
      ) : (
        <svg {...common} aria-hidden>
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      )}
    </span>
  );
}

export function SignInList({ rows }: { rows: SignInRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-ink-700/55">No sign-ins recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-ink-900/6">
      {rows.map((row, i) => {
        const device = describeSignIn(row.userAgent);
        const expanded = open === i;
        return (
          <li key={`${row.at}-${i}`}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : i)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-900/[0.02] sm:px-5"
            >
              <DeviceIcon kind={device.kind} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink-950">{device.name}</span>
                <span className="block text-[13px] text-ink-700/50">{when(row.at)}</span>
              </span>
              <span className="flex items-center gap-1 text-[13px] font-medium text-ink-700/45">
                Details
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition ${expanded ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </span>
            </button>
            {expanded ? (
              <dl className="grid grid-cols-1 gap-2 px-4 pb-4 text-[13px] sm:grid-cols-2 sm:px-5 sm:pl-16">
                <div>
                  <dt className="text-ink-700/45">Browser</dt>
                  <dd className="font-medium text-ink-950">{device.browser}</dd>
                </div>
                <div>
                  <dt className="text-ink-700/45">Operating system</dt>
                  <dd className="font-medium text-ink-950">{device.os}</dd>
                </div>
                <div>
                  <dt className="text-ink-700/45">IP address</dt>
                  <dd className="font-medium text-ink-950">{row.ip || "Not available"}</dd>
                </div>
              </dl>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
