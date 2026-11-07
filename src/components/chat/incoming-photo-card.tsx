"use client";

import { useEffect, useRef, useState } from "react";
import { openPrivatePhotos } from "@/components/chat/private-photo-share";

type Incoming =
  | { status: "none" }
  | {
      status: "shared" | "active" | "expired";
      shareId: string;
      secondsRemaining: number;
      photoCount: number;
      waliEligible: boolean;
      waliAllowed: boolean;
    };

const POLL_MS = 4000;

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e12d72" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l1.3-2h7.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e12d72" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 8v5l3 2" />
      <circle cx="12" cy="13" r="8" />
      <path d="M9 2h6" />
    </svg>
  );
}

/** A blurred decorative thumbnail (we don't hold the real photos until a viewing session starts). */
function BlurThumb({ src, className, style }: { src: string; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className={`absolute h-28 w-28 rounded-2xl object-cover ring-2 ring-white shadow-sm ${className ?? ""}`}
      style={{ filter: "blur(10px) saturate(0.85)", ...style }}
    />
  );
}

/**
 * V2 photo-sharing: received photos appear directly in the chat as a compact card on the sender's
 * side — no hunting through the header. Shows who shared, stacked blurred previews with a locked
 * centre, the 60-second notice, a "View photos" button (which opens the Respect-their-privacy
 * confirm, then the viewer) and, when wali oversight is active, an "Allow your wali to view" button.
 */
export function IncomingPhotoCard({
  requestId,
  peerCode,
  blurUrl,
  matchEnded,
  stamp,
}: {
  requestId: string;
  peerCode: string;
  blurUrl: string;
  matchEnded: boolean;
  stamp?: string;
}) {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useRef<() => Promise<void>>(async () => {});
  refresh.current = async () => {
    try {
      const res = await fetch(`/api/chats/${requestId}/private-photos`);
      if (!res.ok) return;
      const data = await res.json();
      setIncoming(data.incoming as Incoming);
    } catch {
      /* transient — next poll retries */
    }
  };

  useEffect(() => {
    if (matchEnded) return;
    void refresh.current();
    const t = setInterval(() => void refresh.current(), POLL_MS);
    return () => clearInterval(t);
  }, [requestId, matchEnded]);

  if (matchEnded || !incoming || incoming.status === "none" || incoming.status === "expired") return null;

  const count = incoming.photoCount;
  const active = incoming.status === "active";

  async function allowWali() {
    if (busy || !incoming || incoming.status === "none") return;
    setBusy(true);
    try {
      await fetch(`/api/chats/${requestId}/private-photos/${incoming.shareId}/allow-wali`, { method: "POST" });
      await refresh.current();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 w-full max-w-[20rem] rounded-[20px] border border-ink-900/10 bg-white p-4 shadow-[0_6px_20px_-10px_rgba(15,13,14,0.25)]">
      <div className="flex items-center gap-2">
        <CameraIcon />
        <p className="text-[14.5px] font-bold text-ink-950 leading-snug">
          {peerCode} shared {count} photo{count === 1 ? "" : "s"} with you
        </p>
      </div>

      {/* Stacked blurred previews with a locked centre */}
      <div className="relative my-4 h-36 flex items-center justify-center">
        <BlurThumb src={blurUrl} className="rotate-[8deg] translate-x-5" />
        <div className="relative h-28 w-28">
          <BlurThumb src={blurUrl} className="static block -rotate-[3deg]" style={{ position: "static" }} />
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#e12d72] bg-black/10 backdrop-blur-[1px]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-ink-700/75">
        <TimerIcon />
        {active ? `${incoming.secondsRemaining}s remaining to view` : "Photos visible for 60 seconds"}
      </div>

      <button
        type="button"
        onClick={() => openPrivatePhotos(requestId)}
        className="mt-3 w-full py-2.5 rounded-full border-[1.5px] border-[#e12d72] text-[#e12d72] text-[15px] font-bold hover:bg-rose-50 transition"
      >
        View photos
      </button>

      {incoming.waliEligible ? (
        incoming.waliAllowed ? (
          <div className="mt-2 w-full py-2.5 rounded-full border border-ink-900/12 bg-ink-900/[0.03] text-ink-700/70 text-[13.5px] font-semibold text-center">
            Wali access enabled
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void allowWali()}
            className="mt-2 w-full py-2.5 rounded-full border border-ink-900/15 text-ink-700/80 text-[13.5px] font-semibold hover:bg-ink-900/[0.03] disabled:opacity-50 transition"
          >
            Allow your wali to view
          </button>
        )
      ) : null}

      {stamp ? <p className="mt-2 text-right text-[11px] text-ink-700/45">{stamp}</p> : null}
    </div>
  );
}
