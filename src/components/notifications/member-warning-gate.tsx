"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useChatSocket } from "@/hooks/use-chat-socket";

type Warning = { id: string; message: string; createdAt: string; acknowledged: boolean };

const SKIP_PREFIXES = ["/wali", "/login", "/signup", "/forgot", "/reset", "/verify"];

/**
 * A03: when an admin warns this member, the warning is shown in their account until they
 * confirm they've read it — on next load, or instantly if PN is already open.
 */
export function MemberWarningGate() {
  const pathname = usePathname() || "/";
  const skip = pathname === "/" || SKIP_PREFIXES.some((p) => pathname.startsWith(p));
  const [pending, setPending] = useState<Warning | null>(null);
  const [busy, setBusy] = useState(false);
  const { on } = useChatSocket(!skip);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/warnings", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data: { warnings: Warning[] } = await res.json();
    // Oldest unread first, one at a time.
    const unread = data.warnings.filter((w) => !w.acknowledged);
    setPending(unread.length ? unread[unread.length - 1] : null);
  }, []);

  useEffect(() => {
    if (skip) return;
    void load();
    return on("account:warning", () => void load());
  }, [skip, load, on]);

  if (skip || !pending) return null;

  async function acknowledge() {
    if (!pending) return;
    setBusy(true);
    await fetch("/api/account/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pending.id }),
    }).catch(() => null);
    setBusy(false);
    setPending(null);
    void load();
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="member-warning-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Community guidelines</p>
        <h2 id="member-warning-title" className="mt-1 font-bold text-ink-950 text-lg">
          A message from the Pashtun Nikah team
        </h2>
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3 text-[14px] leading-relaxed text-ink-900">
          {pending.message}
        </p>
        <p className="mt-2 text-[12px] text-ink-700/60">
          Sent {new Date(pending.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.
          You can see past messages in Settings.
        </p>
        <button
          type="button"
          onClick={() => void acknowledge()}
          disabled={busy}
          className="mt-4 w-full py-3 rounded-full bg-rose-600 text-white font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "I understand"}
        </button>
      </div>
    </div>
  );
}
