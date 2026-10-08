"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TribePicker } from "@/components/tribe/tribe-picker";

const SKIP_PREFIXES = ["/wali", "/login", "/signup", "/forgot", "/reset", "/verify", "/set-password"];

/**
 * One-time "Confirm your tribe" for members who joined before the Confederacy → Tribe selector.
 * Their old tribe is pre-selected when it confidently matches a listed tribe; otherwise they
 * choose. Shown until confirmed — it can't be dismissed.
 */
export function TribeConfirmGate() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const skip = pathname === "/" || SKIP_PREFIXES.some((p) => pathname.startsWith(p));
  const [ask, setAsk] = useState<{ previous: string | null; suggestion: string | null } | null>(null);
  const [tribe, setTribe] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/profile/tribe", { cache: "no-store" }).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data: { needsConfirm: boolean; previous?: string | null; suggestion?: string | null } = await res.json();
      if (cancelled || !data.needsConfirm) return;
      setTribe(data.suggestion ?? "");
      setAsk({ previous: data.previous ?? null, suggestion: data.suggestion ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, [skip]);

  if (skip || !ask) return null;

  async function confirm() {
    if (!tribe) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/tribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tribe }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Could not save your tribe. Please try again.");
      return;
    }
    setAsk(null);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tribe-confirm-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-2xl">
        <div className="px-5 pt-5">
          <h2 id="tribe-confirm-title" className="text-lg font-bold text-ink-950">
            Confirm your tribe
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-700/80">
            We&apos;ve improved how tribes are organised on Pashtun Nikah. Please confirm your tribe to continue.
          </p>
          {ask.suggestion && ask.previous && ask.suggestion.toLowerCase() !== ask.previous.toLowerCase() ? (
            <p className="mt-2 rounded-xl bg-[#faf8f7] px-3.5 py-2.5 text-[13px] text-ink-700">
              You entered “{ask.previous}” before — we&apos;ve selected <span className="font-semibold">{ask.suggestion}</span>.
              Change it if that isn&apos;t right.
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex-1 overflow-y-auto px-5 pb-2">
          <TribePicker selected={tribe ? [tribe] : []} onChange={([next]) => setTribe(next ?? "")} />
        </div>
        <div className="border-t border-ink-900/8 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {error ? (
            <p role="alert" className="mb-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!tribe || busy}
            className="w-full rounded-full bg-rose-600 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-45"
          >
            {busy ? "Saving…" : tribe ? `Confirm ${tribe}` : "Select tribe"}
          </button>
        </div>
      </div>
    </div>
  );
}
