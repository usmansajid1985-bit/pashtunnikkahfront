"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { SuccessToast } from "@/components/success-toast";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";

export type BlockedProfileRow = {
  id: string;
  peerUserId: string;
  code: string;
  blockedAt: string;
  avatarSeed: number;
};

function avatarUrl(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

export function BlockedProfiles({ initial }: { initial: BlockedProfileRow[] }) {
  // Newest first.
  const [rows, setRows] = useState(
    [...initial].sort((a, b) => +new Date(b.blockedAt) - +new Date(a.blockedAt))
  );
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<BlockedProfileRow | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);

  function unblock(row: BlockedProfileRow) {
    startTransition(async () => {
      const res = await fetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.peerUserId }),
      });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.peerUserId !== row.peerUserId));
        setConfirm(null);
        setToast("User unblocked");
      }
    });
  }

  const toastEl = <SuccessToast message={toast} onClose={() => setToast(null)} />;

  if (rows.length === 0) {
    return (
      <>
        <p className="mt-2 text-sm text-ink-700/55">You have not blocked anyone.</p>
        {toastEl}
      </>
    );
  }

  return (
    <>
      {toastEl}
      <ul className={`mt-3 space-y-2 ${pending ? "opacity-60" : ""}`}>
        {rows.map((r) => (
          <li
            key={r.id}
            className="relative flex items-center gap-3 rounded-2xl border border-ink-900/8 bg-white px-3 py-2.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(r.avatarSeed)}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover"
              style={{ filter: "blur(5px) saturate(0.9)" }}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-950">{r.code}</span>
              <span className="block text-[12.5px] text-ink-700/55">
                Blocked on{" "}
                {new Date(r.blockedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Options for ${r.code}`}
              onClick={() => setMenuId((m) => (m === r.id ? null : r.id))}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-ink-700/60 hover:bg-ink-900/5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </button>

            {menuId === r.id ? (
              <>
                <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenuId(null)} />
                <div className="absolute right-3 top-12 z-20 w-48 rounded-2xl border border-ink-900/10 bg-white p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      setConfirm(r);
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink-950 hover:bg-ink-900/5"
                  >
                    Unblock {r.code}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuId(null);
                      setReport({ userId: r.peerUserId, code: r.code });
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-ink-950 hover:bg-ink-900/5"
                  >
                    Report {r.code}
                  </button>
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Unblock confirmation modal — blurred/darkened backdrop, circular blurred photo. */}
      {confirm && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-ink-950/35 backdrop-blur-sm p-4"
              onClick={() => setConfirm(null)}
            >
              <div
                role="dialog"
                aria-label={`Unblock ${confirm.code}`}
                className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl(confirm.avatarSeed)}
                  alt=""
                  className="mx-auto h-16 w-16 rounded-full object-cover"
                  style={{ filter: "blur(5px) saturate(0.9)" }}
                />
                <h3 className="mt-4 text-[18px] font-bold text-ink-950">Unblock {confirm.code}?</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-700/65">
                  Their profile can become visible to you again, but your previous match won&apos;t be restored.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="flex-1 h-11 rounded-full border border-ink-900/12 text-sm font-semibold text-ink-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => unblock(confirm)}
                    className="flex-1 h-11 rounded-full text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#e12d72" }}
                  >
                    {pending ? "Unblocking…" : "Unblock"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <ReportDialog target={report} onClose={() => setReport(null)} onDone={() => setReport(null)} />
    </>
  );
}
