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

  const menuRow = rows.find((r) => r.id === menuId) ?? null;
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

          </li>
        ))}
      </ul>

      {/* 3-dots action sheet: slides up over a blurred backdrop (Unblock / Report / Cancel). */}
      {menuRow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/35 backdrop-blur-sm p-3"
              onClick={() => setMenuId(null)}
            >
              <div
                role="menu"
                aria-label={`Options for ${menuRow.code}`}
                className="w-full max-w-sm space-y-2 pb-[env(safe-area-inset-bottom)] animate-[pnSheetUp_240ms_ease-out]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_-12px_rgba(15,13,14,0.4)]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const row = menuRow;
                      setMenuId(null);
                      setConfirm(row);
                    }}
                    className="flex w-full items-center gap-3.5 px-5 py-4 text-left text-[15px] font-semibold text-ink-950 hover:bg-ink-900/[0.03]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 14 4 9l5-5" />
                      <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
                    </svg>
                    Unblock {menuRow.code}
                  </button>
                  <div className="h-px bg-ink-900/8" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const row = menuRow;
                      setMenuId(null);
                      setReport({ userId: row.peerUserId, code: row.code });
                    }}
                    className="flex w-full items-center gap-3.5 px-5 py-4 text-left text-[15px] font-semibold text-ink-950 hover:bg-ink-900/[0.03]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 21V5m0 0 1.5 1h5l1 2h5v8h-6l-1-2H5" />
                    </svg>
                    Report {menuRow.code}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuId(null)}
                  className="w-full rounded-2xl bg-white py-4 text-center text-[15px] font-bold text-ink-950 shadow-[0_12px_40px_-12px_rgba(15,13,14,0.4)] hover:bg-ink-900/[0.02]"
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

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
                  Unblocking this member will allow you to view each other&apos;s profiles and interact again. Your
                  previous match will not be restored.
                </p>
                <p className="mt-2 text-[14px] font-semibold text-ink-900">Are you sure you want to unblock them?</p>
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
