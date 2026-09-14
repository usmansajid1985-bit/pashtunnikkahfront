"use client";

import { useCallback, useEffect, useState } from "react";
import { PrivatePhotoViewer } from "@/components/chat/private-photo-viewer";

type ShareState = {
  shareId: string;
  status: "shared" | "active" | "expired";
  secondsRemaining: number;
  photoCount: number;
} | null;

type ViewerData = { secondsRemaining: number; watermark: string; photos: { index: number; url: string }[] };

const POLL_MS = 5000;

/**
 * Wali-side private photo affordance (spec §29/§30) — shown only once the sister has explicitly
 * allowed wali access to a specific share. Uses its own 60s session, entirely separate from hers.
 */
export function WaliPrivatePhoto({ requestId, peerCode }: { requestId: string; peerCode: string }) {
  const [share, setShare] = useState<ShareState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startPromptOpen, setStartPromptOpen] = useState(false);
  const [viewerData, setViewerData] = useState<ViewerData | null>(null);
  const [endedOpen, setEndedOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/wali/chats/${requestId}/private-photos`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setShare(data.share);
  }, [requestId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  async function startViewing() {
    if (!share || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/wali/private-photos/${share.shareId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start viewing");
      await openViewer(share.shareId);
      setStartPromptOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start viewing");
    } finally {
      setBusy(false);
    }
  }

  async function openViewer(shareId: string) {
    const res = await fetch(`/api/wali/private-photos/${shareId}/photos`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load photos");
      return;
    }
    setViewerData(data);
  }

  if (!share) return null;

  return (
    <div className="m-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
      <button
        type="button"
        onClick={() => {
          if (share.status === "shared") setStartPromptOpen(true);
          else if (share.status === "active") void openViewer(share.shareId);
          else setEndedOpen(true);
        }}
        className="w-full flex items-center gap-2.5 text-left"
      >
        <span className="text-lg leading-none">🔒</span>
        <span>
          <span className="block text-sm font-bold text-indigo-900">
            {share.status === "active"
              ? `${share.secondsRemaining}s remaining — tap to view`
              : share.status === "shared"
                ? "Private photos available"
                : "Private photo preview ended"}
          </span>
          <span className="block text-xs text-indigo-700/70">
            {peerCode}&apos;s photos — shared with your permission
          </span>
        </span>
      </button>

      {startPromptOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <p className="font-bold text-ink-950 text-sm">Private photos shared with you as wali</p>
            <p className="text-[12px] text-ink-700/65 mt-1.5 leading-relaxed">
              You can view up to {share.photoCount} photo{share.photoCount === 1 ? "" : "s"} for 1 minute.
              Once you start, the timer will continue even if you close the viewer.
            </p>
            {error ? <p className="text-[11px] text-rose-600 mt-2">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void startViewing()}
                className="flex-1 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Starting…" : "Start Viewing"}
              </button>
              <button
                type="button"
                onClick={() => setStartPromptOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerData ? (
        <PrivatePhotoViewer
          photos={viewerData.photos}
          secondsRemaining={viewerData.secondsRemaining}
          watermark={viewerData.watermark}
          onClose={() => {
            setViewerData(null);
            void refresh();
          }}
          onExpire={() => {
            setViewerData(null);
            setEndedOpen(true);
            void refresh();
          }}
        />
      ) : null}

      {endedOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl text-center">
            <p className="font-bold text-ink-950 text-sm">Private photo preview ended</p>
            <p className="text-[12px] text-ink-700/65 mt-1.5">Your viewing session has finished.</p>
            <button
              type="button"
              onClick={() => setEndedOpen(false)}
              className="mt-4 w-full py-2.5 rounded-full bg-ink-950 text-white text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
