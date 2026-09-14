"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrivatePhotoViewer } from "@/components/chat/private-photo-viewer";

type Summary = {
  incoming:
    | { status: "none" }
    | {
        status: "shared" | "active" | "expired";
        shareId: string;
        secondsRemaining: number;
        photoCount: number;
        waliEligible: boolean;
        waliAllowed: boolean;
      };
  outgoing:
    | { status: "none"; canShare: true }
    | { status: "shared" | "active" | "expired"; shareId: string; canShare: boolean };
};

type OwnPhoto = { id: string; url: string; isMain: boolean; status: string };

type ViewerData = { secondsRemaining: number; watermark: string; photos: { index: number; url: string }[] };

const POLL_MS = 4000;

type Props = {
  requestId: string;
  matchEnded: boolean;
  peerName: string;
  variant: "dropdown" | "banner";
  /** Only relevant to the "dropdown" variant — whether the parent's dropdown is currently open. */
  open?: boolean;
  onIncomingStatusChange?: (status: "none" | "shared" | "active" | "expired") => void;
};

export function PrivatePhotoShare({
  requestId,
  matchEnded,
  peerName,
  variant,
  open = true,
  onIncomingStatusChange,
}: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [ownPhotos, setOwnPhotos] = useState<OwnPhoto[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [startPromptOpen, setStartPromptOpen] = useState(false);
  const [viewerData, setViewerData] = useState<ViewerData | null>(null);
  const [endedOpen, setEndedOpen] = useState(false);
  const [reciprocalOpen, setReciprocalOpen] = useState(false);
  const shownReciprocalFor = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${requestId}/private-photos`);
      if (!res.ok) return;
      const data: Summary = await res.json();
      setSummary(data);
      onIncomingStatusChange?.(data.incoming.status);
      if (
        data.incoming.status === "expired" &&
        data.outgoing.status === "none" &&
        !shownReciprocalFor.current.has(data.incoming.shareId)
      ) {
        shownReciprocalFor.current.add(data.incoming.shareId);
        setReciprocalOpen(true);
      }
    } catch {
      /* transient — next poll retries */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  useEffect(() => {
    if (matchEnded) return;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh, matchEnded]);

  async function openPicker() {
    setError(null);
    setPickerOpen(true);
    setSelected([]);
    if (!ownPhotos) {
      const res = await fetch("/api/profile/photos").catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setOwnPhotos(
          (data.photos || [])
            .filter((p: OwnPhoto) => p.status === "approved")
            .map((p: OwnPhoto) => ({ id: p.id, url: p.url, isMain: p.isMain, status: p.status }))
        );
      }
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]
    );
  }

  async function confirmShare() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${requestId}/private-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not share photos");
      setPickerOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not share photos");
    } finally {
      setBusy(false);
    }
  }

  async function startViewing(shareId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${requestId}/private-photos/${shareId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start viewing");
      await openViewer(shareId);
      setStartPromptOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start viewing");
    } finally {
      setBusy(false);
    }
  }

  async function openViewer(shareId: string) {
    const res = await fetch(`/api/chats/${requestId}/private-photos/${shareId}/photos`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load photos");
      return;
    }
    setViewerData(data);
  }

  function onTapIncoming() {
    if (!summary || summary.incoming.status === "none") return;
    if (summary.incoming.status === "shared") {
      setStartPromptOpen(true);
    } else if (summary.incoming.status === "active") {
      void openViewer(summary.incoming.shareId);
    } else {
      setEndedOpen(true);
    }
  }

  async function allowWali() {
    if (!summary || summary.incoming.status === "none") return;
    setBusy(true);
    try {
      await fetch(`/api/chats/${requestId}/private-photos/${summary.incoming.shareId}/allow-wali`, {
        method: "POST",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (matchEnded) return null;

  const incoming = summary?.incoming;
  const outgoing = summary?.outgoing;

  const trigger =
    incoming && incoming.status !== "none" ? (
      <button
        type="button"
        onClick={onTapIncoming}
        className="w-full flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2.5 text-left hover:bg-rose-50"
      >
        <span className="text-lg leading-none">🔒</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-rose-800">
            {incoming.status === "active"
              ? `${incoming.secondsRemaining}s remaining — tap to view`
              : incoming.status === "shared"
                ? "Private photos available"
                : "Private photo preview ended"}
          </span>
          <span className="block text-[11px] text-rose-700/70">from {peerName}</span>
        </span>
      </button>
    ) : null;

  return (
    <div className={variant === "banner" ? "m-4" : ""}>
      {variant === "dropdown" && !open ? null : (
        <div className={variant === "banner" ? "" : "p-3.5"}>
          {variant === "dropdown" ? (
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-700/55">Private photos</p>
          ) : null}

          <div className="mt-2 flex flex-col gap-2">
            {trigger}

            {outgoing?.status === "shared" || outgoing?.status === "active" ? (
              <p className="text-[11px] font-semibold text-ink-700/60 px-1">Photos shared</p>
            ) : outgoing?.status === "expired" && !outgoing.canShare ? (
              <p className="text-[11px] font-semibold text-ink-700/60 px-1">Photos viewed</p>
            ) : null}

            {!outgoing || outgoing.canShare ? (
              <button
                type="button"
                onClick={() => void openPicker()}
                className="w-full py-2.5 rounded-full border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50"
              >
                {outgoing?.status === "expired" ? "Share Photos Again" : "Share Private Photos"}
              </button>
            ) : null}

            {incoming && incoming.status !== "none" && incoming.waliEligible && !incoming.waliAllowed ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void allowWali()}
                className="text-[11px] font-semibold text-indigo-700 hover:underline self-start px-1"
              >
                Allow your wali to view {peerName}&apos;s private photos
              </button>
            ) : null}
            {incoming && incoming.status !== "none" && incoming.waliAllowed ? (
              <p className="text-[11px] text-indigo-700/70 px-1">Your wali may view these photos too.</p>
            ) : null}

            {error ? <p className="text-[11px] text-rose-600 px-1">{error}</p> : null}

            {variant === "dropdown" ? (
              <p className="text-[11px] text-ink-700/55 leading-snug">
                Shared photos stay blurred until the recipient starts a one-time{" "}
                <span className="font-semibold">60-second</span> viewing session.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Photo picker */}
      {pickerOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <p className="font-bold text-ink-950 text-sm">Share private photos</p>
            <p className="text-[12px] text-ink-700/60 mt-1">
              {peerName} will have one 60-second session to view up to 3 of your photos.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(ownPhotos || []).map((p) => {
                const isSelected = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSelect(p.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                      isSelected ? "border-rose-600" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                    {isSelected ? (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {selected.indexOf(p.id) + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {ownPhotos && ownPhotos.length === 0 ? (
                <p className="col-span-3 text-[12px] text-ink-700/55 py-4 text-center">
                  Add an approved photo in Profile → Edit first.
                </p>
              ) : null}
            </div>
            {error ? <p className="text-[11px] text-rose-600 mt-2">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={selected.length === 0 || busy}
                onClick={() => void confirmShare()}
                className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Sharing…" : "Share Photos"}
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Before-viewing prompt (spec §6) */}
      {startPromptOpen && incoming && incoming.status !== "none" ? (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <p className="font-bold text-ink-950 text-sm">{peerName} has shared private photos with you</p>
            <p className="text-[12px] text-ink-700/65 mt-1.5 leading-relaxed">
              You can view up to {incoming.photoCount} photo{incoming.photoCount === 1 ? "" : "s"} for 1
              minute. Once you start, the timer will continue even if you close the viewer.
            </p>
            {error ? <p className="text-[11px] text-rose-600 mt-2">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void startViewing(incoming.shareId)}
                className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
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

      {reciprocalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-3 pb-3 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl text-center">
            <p className="font-bold text-ink-950 text-sm">Would you like to share your photos with {peerName}?</p>
            <p className="text-[12px] text-ink-700/65 mt-1.5">Sharing is completely optional.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setReciprocalOpen(false);
                  void openPicker();
                }}
                className="w-full py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold"
              >
                Share My Photos
              </button>
              <button
                type="button"
                onClick={() => setReciprocalOpen(false)}
                className="w-full py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
