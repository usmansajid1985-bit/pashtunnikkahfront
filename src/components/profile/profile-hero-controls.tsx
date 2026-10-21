"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ReportDialog, type ReportTarget } from "@/components/chat/report-dialog";
import { openGoldUpsell } from "@/components/billing/gold-upsell";

const glass =
  "pointer-events-auto inline-flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md border border-white/15 hover:bg-black/55 transition";

/** Top-left of the profile photo: a round ← on phones, "← Back to browse" on desktop. */
export function HeroBackButton({ href, label }: { href: string; label?: string | null }) {
  return (
    <Link href={href} aria-label={label || "Back"} className={`${glass} h-10 ${label ? "gap-2 px-4 text-[14px] font-medium" : "w-10"}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label ? <span>{label}</span> : null}
    </Link>
  );
}

/** Top-right of the profile photo: ⋯ → Report / Block this member. */
export function HeroMoreMenu({ userId, code, afterBlockHref = "/browse" }: { userId: string; code: string; afterBlockHref?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function block(doneMessage = "Member blocked") {
    setBusy(true);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setToast("Could not block member");
      return;
    }
    setOpen(false);
    setToast(doneMessage);
    router.push(afterBlockHref);
    router.refresh();
  }

  const close = () => {
    setOpen(false);
    setConfirmBlock(false);
  };

  return (
    <>
      <button type="button" aria-label="More options" onClick={() => setOpen(true)} className={`${glass} h-10 w-10`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="19" cy="12" r="1.9" />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-ink-950/35 backdrop-blur-sm p-4" onClick={close}>
              <div role="dialog" aria-label={`Options for ${code}`} className="w-full max-w-sm rounded-3xl bg-white p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
                {confirmBlock ? (
                  <div className="p-4">
                    <h3 className="text-[17px] font-bold text-ink-950">Block {code}?</h3>
                    <p className="mt-1.5 text-sm text-ink-700/75 leading-relaxed">
                      They won&apos;t be able to see your profile or contact you, and any request or chat between you ends.
                    </p>
                    <div className="mt-5 flex gap-2">
                      <button type="button" onClick={() => setConfirmBlock(false)} className="flex-1 h-11 rounded-full border border-ink-900/12 text-sm font-semibold">
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void block()}
                        className="flex-1 h-11 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {busy ? "Blocking…" : "Block"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setReport({ userId, code });
                      }}
                      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold text-ink-950 hover:bg-ink-900/[0.04]"
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
                      </svg>
                      Report {code}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBlock(true)}
                      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                        <circle cx="12" cy="12" r="9" />
                        <path d="m5.6 5.6 12.8 12.8" />
                      </svg>
                      Block {code}
                    </button>
                    <button type="button" onClick={close} className="w-full rounded-2xl px-4 py-3.5 text-[15px] font-medium text-ink-700/70 hover:bg-ink-900/[0.04]">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>,
            document.body
          )
        : null}

      <ReportDialog
        target={report}
        onClose={() => setReport(null)}
        onDone={(ok, alsoBlock) => {
          setReport(null);
          if (!ok) return;
          if (alsoBlock) void block("Reported to the PN team and blocked");
          else setToast("Member reported to the PN team");
        }}
      />

      {toast && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-full bg-ink-950 text-white text-sm font-medium shadow-lg">
              {toast}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/** Outlined bookmark beside Request match — saves / unsaves the profile. */
export function SaveProfileButton({ userId, initialSaved, className = "" }: { userId: string; initialSaved: boolean; className?: string }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    const res = await fetch("/api/favourites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setSaved(!next);
      if (data.code === "saved_limit") openGoldUpsell("saved_limit");
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save profile"}
      className={`shrink-0 h-[52px] w-[52px] rounded-full border flex items-center justify-center transition ${
        saved ? "border-rose-200 bg-rose-50 text-rose-600" : "border-ink-900/15 bg-white text-ink-950 hover:border-ink-900/30"
      } ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
        <path d="M6 3.5h12v17l-6-4.2-6 4.2v-17Z" />
      </svg>
    </button>
  );
}
