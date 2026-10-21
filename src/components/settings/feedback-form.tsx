"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";

type Kind = "general" | "bug" | "feature";
const MAX_SHOTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

const KINDS: { id: Kind; label: string; icon?: React.ReactNode; placeholder: string }[] = [
  { id: "general", label: "General", placeholder: "Briefly describe your feedback…" },
  {
    id: "bug",
    label: "Report a bug",
    placeholder: "What went wrong?",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <rect x="7" y="7" width="10" height="13" rx="5" />
        <path d="M12 7V5M9 5l-1-2M15 5l1-2M7 12H3M21 12h-4M7 17l-3 2M17 17l3 2M7 9 4 7M17 9l3-2" />
      </svg>
    ),
  },
  {
    id: "feature",
    label: "Suggest a feature",
    placeholder: "What would you like to see?",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
      </svg>
    ),
  },
];

const ImageIcon = ({ className = "" }: { className?: string }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="1.8" />
    <path d="m21 15-5-5L5 21" />
  </svg>
);

/** Big phone screenshots are shrunk before upload so three fit in one request (Vercel's ~4.5MB cap). */
async function shrink(file: File): Promise<File> {
  try {
    if (file.size < 900 * 1024) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Settings → Give us feedback: type, subject, message and up to 3 screenshots. */
export function FeedbackForm() {
  const [kind, setKind] = useState<Kind>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const placeholder = KINDS.find((k) => k.id === kind)!.placeholder;
  const ready = subject.trim().length >= 3 && message.trim().length >= 10;

  function addFiles(list: FileList | null) {
    setError(null);
    const picked = Array.from(list ?? []);
    const next = [...shots];
    for (const f of picked) {
      if (next.length >= MAX_SHOTS) break;
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setError("Screenshots must be JPG, PNG or WEBP images.");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError("Each screenshot must be 5MB or smaller.");
        continue;
      }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setShots(next);
  }

  function removeShot(i: number) {
    URL.revokeObjectURL(shots[i].url);
    setShots(shots.filter((_, j) => j !== i));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("subject", subject);
      fd.append("message", message);
      for (const s of shots) fd.append("screenshots", await shrink(s.file));
      const res = await fetch("/api/feedback", { method: "POST", body: fd }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) {
        setError(data.error || "Couldn't send your feedback — please try again.");
        return;
      }
      shots.forEach((s) => URL.revokeObjectURL(s.url));
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-2xl bg-white border border-ink-900/6 p-6 text-center">
        <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">
          🤲
        </span>
        <h3 className="mt-3 text-lg font-bold text-ink-950">Jazakallahu khairan!</h3>
        <p className="mt-1 text-sm text-ink-700/70">Thank you for your feedback — our team reads every message.</p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setSubject("");
              setMessage("");
              setShots([]);
            }}
            className="px-5 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
          >
            Send more feedback
          </button>
          <Link href="/settings" className="px-5 py-2.5 rounded-full bg-[#e0306f] text-white text-sm font-semibold">
            Back to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div role="tablist" aria-label="Feedback type" className="grid grid-cols-[0.75fr_1fr_1.3fr] gap-0.5 sm:gap-1 rounded-full border border-ink-900/8 bg-ink-900/[0.03] p-1">
        {KINDS.map((k) => {
          const active = kind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k.id)}
              className={`min-w-0 h-11 rounded-full flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 text-[12px] sm:text-[14px] font-semibold tracking-tight transition [&_svg]:w-[14px] sm:[&_svg]:w-4 ${
                active ? "bg-[#e0306f] text-white shadow-sm" : "text-ink-700/75 hover:text-ink-950"
              }`}
            >
              {k.icon}
              <span className="whitespace-nowrap">{k.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white border border-ink-900/6 p-4 sm:p-5 space-y-5">
        <label className="block">
          <span className="block text-[15px] font-bold text-ink-950 mb-2">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 160))}
            placeholder={placeholder}
            className="w-full rounded-xl bg-[#f6f5f7] border border-transparent px-4 py-3 text-[15px] outline-none focus:bg-white focus:border-rose-200"
          />
        </label>

        <label className="block">
          <span className="block text-[15px] font-bold text-ink-950 mb-2">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
            rows={6}
            placeholder={kind === "bug" ? "Tell us what happened and the steps to reproduce it…" : "Tell us more…"}
            className="w-full rounded-xl bg-[#f6f5f7] border border-transparent px-4 py-3 text-[15px] outline-none resize-y focus:bg-white focus:border-rose-200"
          />
        </label>

        <div>
          <p className="text-[15px] font-bold text-ink-950 mb-2">
            Add screenshots <span className="font-normal text-ink-700/70">(optional)</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: MAX_SHOTS }).map((_, i) => {
              const shot = shots[i];
              if (shot) {
                return (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-ink-900/8 bg-ink-900/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.url} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeShot(i)}
                      aria-label={`Remove screenshot ${i + 1}`}
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                );
              }
              const isNext = i === shots.length;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition ${
                    isNext ? "bg-rose-50 text-[#e0306f] hover:bg-rose-100" : "bg-[#f6f5f7] text-ink-700/35 hover:bg-ink-900/[0.06]"
                  }`}
                  aria-label="Add screenshot"
                >
                  <ImageIcon />
                  {isNext ? <span className="text-[13px] font-medium">Add photo</span> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12.5px] text-ink-700/60">You can add up to 3 screenshots (max 5MB each).</p>
        </div>

        {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
        <button
          type="button"
          disabled={pending || !ready}
          onClick={submit}
          className="w-full h-13 py-3.5 rounded-full bg-[#e0306f] hover:bg-[#c92763] text-white text-[16px] font-semibold disabled:opacity-50 transition"
        >
          {pending ? "Sending…" : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}
