"use client";

import { useCallback, useEffect, useState } from "react";
import { useChatSocket } from "@/hooks/use-chat-socket";

type Family = { mine: string | null; theirs: string | null; mutualAt: string | null };
type Handover = { wali_handover_status: string | null };

function answerLabel(v: string | null) {
  return v === "yes" ? "Ready ✓" : v === "not_yet" ? "Not yet" : "No answer yet";
}

/**
 * W10: "Ready to involve family?" in every active match. Each member answers Yes / Not yet / End;
 * both Yes moves the pair to the family stage, where only the sister can share her wali's
 * contact. Both sides see the current stage and each other's answer, updated live.
 */
export function FamilyStageBar({
  requestId,
  peerCode,
  isFemaleViewer,
  onOpenWaliPanel,
  onEndMatch,
}: {
  requestId: string;
  peerCode: string;
  isFemaleViewer: boolean;
  onOpenWaliPanel: () => void;
  onEndMatch: () => void;
}) {
  const [family, setFamily] = useState<Family | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { on } = useChatSocket(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/chats/${requestId}/wali-handover`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setFamily(data.family ?? { mine: null, theirs: null, mutualAt: null });
    setHandover(data.handover ?? null);
  }, [requestId]);

  useEffect(() => {
    void load();
    return on("family:update", (e: { requestId?: string }) => {
      if (!e?.requestId || e.requestId === requestId) void load();
    });
  }, [load, on, requestId]);

  async function answer(a: "yes" | "not_yet") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/chats/${requestId}/wali-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ready", answer: a }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Couldn't save your answer — please try again.");
      return;
    }
    setOpen(false);
    await load();
  }

  if (!family) return null;

  const mutual = Boolean(family.mutualAt);
  const hs = handover?.wali_handover_status ?? null;
  const stage = !mutual
    ? "Getting to know each other"
    : hs === "established"
      ? "Families in contact ✓"
      : hs === "involving" || hs === "attempted"
        ? "Involving families"
        : "Both ready to involve family";

  const theyAreWaiting = family.theirs === "yes" && family.mine !== "yes";

  return (
    <div className={`border-b px-3 sm:px-4 py-2 text-[12.5px] ${theyAreWaiting ? "bg-amber-50 border-amber-100" : "bg-[#faf8f7] border-ink-900/6"}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-700/55">Stage</span>
        <span className="font-semibold text-ink-950 truncate">{stage}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto shrink-0 font-semibold text-rose-700 hover:underline"
          aria-expanded={open}
        >
          {mutual ? "Details" : family.mine === "yes" ? "Your answer" : "Ready to involve family?"}
        </button>
      </div>
      {theyAreWaiting && !open ? (
        <p className="mt-0.5 text-amber-900">{peerCode} is ready to involve family — are you?</p>
      ) : null}

      {open ? (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <p className="rounded-lg bg-white border border-ink-900/8 px-2.5 py-1.5">
              <span className="block text-[11px] text-ink-700/55">You</span>
              <span className="font-semibold">{answerLabel(family.mine)}</span>
            </p>
            <p className="rounded-lg bg-white border border-ink-900/8 px-2.5 py-1.5">
              <span className="block text-[11px] text-ink-700/55">{peerCode}</span>
              <span className="font-semibold">{answerLabel(family.theirs)}</span>
            </p>
          </div>

          {!mutual ? (
            <>
              <p className="text-ink-700/75">
                When you both say yes, you move to the family stage{isFemaleViewer ? " and can share your wali's contact" : " and she can share her wali's contact"}.
                Your answer is shown to {peerCode}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void answer("yes")}
                  className="px-4 py-1.5 rounded-full bg-emerald-700 text-white font-semibold disabled:opacity-50"
                >
                  Yes, I&apos;m ready
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void answer("not_yet")}
                  className="px-4 py-1.5 rounded-full border border-ink-900/15 font-semibold disabled:opacity-50"
                >
                  Not yet
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onEndMatch}
                  className="px-4 py-1.5 rounded-full text-rose-700 font-semibold hover:bg-rose-50 disabled:opacity-50"
                >
                  End match
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ink-700/75">
                {isFemaleViewer
                  ? hs === "involving" || hs === "attempted" || hs === "established"
                    ? "Your wali's contact has been shared."
                    : "You can now share your wali's contact."
                  : hs === "involving" || hs === "attempted" || hs === "established"
                    ? "Her wali's contact has been shared."
                    : "Waiting for her to share her wali's contact."}
              </p>
              <button
                type="button"
                onClick={onOpenWaliPanel}
                className="px-3 py-1.5 rounded-full bg-indigo-600 text-white font-semibold"
              >
                {isFemaleViewer && !hs ? "Share wali details" : "Open wali handover"}
              </button>
            </div>
          )}
          {error ? <p className="text-rose-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
