"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoCropModal } from "@/components/signup/photo-crop-modal";

type Photo = {
  id: string;
  url: string;
  isMain: boolean;
  status: "pending" | "approved" | "rejected";
  sortOrder: number;
};

const MAX = 3;

const STATUS_LABEL: Record<Photo["status"], string> = {
  pending: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

export function PhotoGallery({ initialPhotos }: { initialPhotos: Photo[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPhotos(initialPhotos), [initialPhotos]);

  async function call(method: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/photos", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image.");
    if (file.size > 6 * 1024 * 1024) return setError("Photo must be under 6MB.");
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <section className="bg-white rounded-2xl border border-ink-900/8 p-5 lg:col-span-2">
      <h2 className="font-bold text-ink-950">Profile photos</h2>
      <p className="mt-1 text-sm text-ink-700/70">
        Add up to {MAX}. Choose one as your main photo. Every photo is manually reviewed before it
        goes live.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 max-w-md">
        {photos.map((p) => (
          <div key={p.id} className="relative">
            <div className="aspect-square rounded-xl overflow-hidden border border-ink-900/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="w-full h-full object-cover"
                style={p.status === "approved" ? undefined : { filter: "blur(5px)" }}
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => call("DELETE", { photoId: p.id })}
              aria-label="Remove photo"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-ink-950 text-white text-xs flex items-center justify-center shadow disabled:opacity-50"
            >
              ✕
            </button>
            <span
              className={`absolute top-1 left-1 text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 ${
                p.status === "approved"
                  ? "bg-emerald-600 text-white"
                  : p.status === "rejected"
                    ? "bg-rose-700 text-white"
                    : "bg-white/90 text-ink-700"
              }`}
            >
              {STATUS_LABEL[p.status]}
            </span>
            {p.isMain ? (
              <span className="absolute bottom-1 left-1 right-1 text-[10px] font-bold uppercase tracking-wide bg-rose-600 text-white rounded px-1 py-0.5 text-center">
                Main
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => call("PATCH", { photoId: p.id })}
                className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold bg-white/90 text-ink-900 rounded px-1 py-0.5 text-center hover:bg-white disabled:opacity-50"
              >
                Set main
              </button>
            )}
          </div>
        ))}

        {photos.length < MAX ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (fileRef.current) fileRef.current.value = "";
              fileRef.current?.click();
            }}
            className="aspect-square rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/40 flex items-center justify-center text-rose-600 hover:border-rose-400 disabled:opacity-50"
            aria-label="Add photo"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      {cropSource ? (
        <PhotoCropModal
          src={cropSource}
          onCancel={() => setCropSource(null)}
          onSave={(cropped) => {
            setCropSource(null);
            void call("POST", { photoDataUrl: cropped });
          }}
        />
      ) : null}
    </section>
  );
}
