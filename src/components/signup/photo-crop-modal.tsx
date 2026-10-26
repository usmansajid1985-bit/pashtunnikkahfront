"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FRAME = 288;
const OUTPUT = 800;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
/** Below this the photo gets noticeably soft when shown as a profile photo (PH-05). */
const MIN_CLEAR_PX = 400;

/** True when every pixel is see-through — a blank PNG would otherwise be saved as a black square. */
function isFullyTransparent(img: HTMLImageElement) {
  try {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return false;
    return true;
  } catch {
    return false;
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function PhotoCropModal({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (croppedDataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  // PH-01/02: a file that can't be decoded (or is completely transparent) never reaches "Use photo".
  const [loadError, setLoadError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const baseScale = natural ? Math.max(FRAME / natural.w, FRAME / natural.h) : 1;
  const dispW = natural ? natural.w * baseScale * zoom : FRAME;
  const dispH = natural ? natural.h * baseScale * zoom : FRAME;

  const clampPos = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, FRAME - dispW, 0),
      y: clamp(y, FRAME - dispH, 0),
    }),
    [dispW, dispH]
  );

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) {
      setLoadError("This file couldn't be opened as a photo. Please choose another one.");
      return;
    }
    if (isFullyTransparent(img)) {
      setLoadError("This image is empty (fully transparent). Please choose a photo of yourself.");
      return;
    }
    setNatural({ w, h });
    const scale = Math.max(FRAME / w, FRAME / h);
    setPos({ x: (FRAME - w * scale) / 2, y: (FRAME - h * scale) / 2 });
    setZoom(1);
  }

  function onZoomChange(next: number) {
    const nextZoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (!natural) {
      setZoom(nextZoom);
      return;
    }
    const prevDispW = natural.w * baseScale * zoom;
    const prevDispH = natural.h * baseScale * zoom;
    const fx = (FRAME / 2 - pos.x) / prevDispW;
    const fy = (FRAME / 2 - pos.y) / prevDispH;
    const nextDispW = natural.w * baseScale * nextZoom;
    const nextDispH = natural.h * baseScale * nextZoom;
    const nextPos = clampPos(FRAME / 2 - fx * nextDispW, FRAME / 2 - fy * nextDispH);
    setZoom(nextZoom);
    setPos(nextPos);
  }

  function startDrag(clientX: number, clientY: number) {
    dragRef.current = { startX: clientX, startY: clientY, posX: pos.x, posY: pos.y };
  }
  function moveDrag(clientX: number, clientY: number) {
    const d = dragRef.current;
    if (!d) return;
    const next = clampPos(d.posX + (clientX - d.startX), d.posY + (clientY - d.startY));
    setPos(next);
  }
  function endDrag() {
    dragRef.current = null;
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      moveDrag(e.clientX, e.clientY);
    }
    function onUp() {
      endDrag();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, dispW, dispH]);

  function handleSave() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const scaleFactor = dispW / natural.w;
    const sx = -pos.x / scaleFactor;
    const sy = -pos.y / scaleFactor;
    const sSize = FRAME / scaleFactor;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // JPEG has no transparency: paint white first so see-through areas don't turn black (PH-02).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    onSave(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="font-serif text-xl font-medium text-ink-950 text-center">Adjust your photo</h2>
        <p className="mt-1 text-xs text-ink-700/60 text-center">
          {loadError ? "There's a problem with this file" : "Drag to reposition · use the slider to zoom"}
        </p>

        {/* PH-06: square frame — the same shape that is saved and shown. */}
        <div
          ref={frameRef}
          className="mt-5 relative mx-auto rounded-2xl overflow-hidden bg-ink-900/5 cursor-move touch-none select-none"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={(e) => startDrag(e.clientX, e.clientY)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImageLoad}
            onError={() => setLoadError("This file couldn't be opened as a photo. Please choose another one.")}
            draggable={false}
            className="absolute top-0 left-0 max-w-none"
            style={{
              width: dispW,
              height: dispH,
              transform: `translate(${pos.x}px, ${pos.y}px)`,
            }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-white/80" />
          {loadError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white px-6 text-center">
              <p className="text-sm font-medium text-rose-700">{loadError}</p>
            </div>
          ) : null}
        </div>
        {natural && Math.min(natural.w, natural.h) < MIN_CLEAR_PX ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
            This photo is small ({natural.w}×{natural.h}px) and may look blurry. For a clear profile photo, use one at
            least {MIN_CLEAR_PX}×{MIN_CLEAR_PX}px.
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-700/50 shrink-0">
            <circle cx="10" cy="10" r="6" />
            <path d="m20 20-4.3-4.3" />
          </svg>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="flex-1 accent-rose-600"
          />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-700/50 shrink-0">
            <circle cx="10" cy="10" r="7" />
            <path d="m20 20-4.3-4.3" />
            <path d="M10 7v6M7 10h6" />
          </svg>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-full border border-ink-900/12 text-sm font-semibold hover:border-rose-300 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!natural || Boolean(loadError)}
            className="flex-1 py-3 rounded-full bg-[#e12d72] text-white text-sm font-semibold hover:bg-[#c41d5e] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
