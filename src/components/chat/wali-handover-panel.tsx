"use client";

import { useCallback, useEffect, useState } from "react";

type Handover = {
  wali_handover_status: string | null;
  wali_details_requested_at: string | null;
  wali_details_shared_at: string | null;
  wali_contact_attempted_at: string | null;
  wali_contact_confirmed_at: string | null;
  wali_handover_note: string | null;
};

type Props = {
  requestId: string;
  isFemaleViewer: boolean;
  wali: { name: string; contact: string | null; email: string | null } | null;
  onShareContactCard?: () => Promise<void>;
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Wali details requested",
  involving: "Involving Wali",
  attempted: "Contact attempted — awaiting confirmation",
  established: "Wali contact established ✓",
  ended: "Handover ended",
};

export function WaliHandoverPanel({
  requestId,
  isFemaleViewer,
  wali,
  onShareContactCard,
}: Props) {
  const [handover, setHandover] = useState<Handover | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/chats/${requestId}/wali-handover`);
    if (!res.ok) return;
    const data = await res.json();
    setHandover(data.handover ?? null);
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, extra?: { note?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${requestId}/wali-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update handover");
        return;
      }
      if (action === "share" && onShareContactCard) {
        await onShareContactCard();
      }
      setConfirmShare(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const status = handover?.wali_handover_status || null;
  const label = status ? STATUS_LABEL[status] || status : "Getting to know one another";

  return (
    <div className="mb-2 rounded-2xl border border-ink-900/10 bg-[#faf8f7] p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-700/55">Wali Handover</p>
      <p className="mt-1 text-sm font-semibold text-ink-950">{label}</p>
      {handover?.wali_handover_note ? (
        <p className="mt-1 text-xs text-amber-800">{handover.wali_handover_note}</p>
      ) : null}
      {error ? <p className="mt-1 text-xs font-semibold text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-col gap-2">
        {!isFemaleViewer && (!status || status === "ended") ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("request")}
            className="w-full py-2.5 rounded-full bg-ink-950 text-white text-sm font-semibold disabled:opacity-50"
          >
            Request Wali Details
          </button>
        ) : null}

        {isFemaleViewer && (status === "requested" || !status) ? (
          confirmShare ? (
            <div className="rounded-xl border border-indigo-100 bg-white p-3">
              <p className="text-[13px] text-ink-800 leading-relaxed">
                Confirm what will be shared:
              </p>
              <p className="mt-2 text-sm font-bold text-ink-950">{wali?.name || "Wali"}</p>
              {wali?.contact ? (
                <p className="text-sm text-ink-700">{wali.contact}</p>
              ) : (
                <p className="text-xs text-amber-700 mt-1">No phone on file — update your wali details first.</p>
              )}
              {wali?.email ? <p className="text-xs text-ink-700/55">{wali.email}</p> : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy || !wali?.contact}
                  onClick={() => void act("share")}
                  className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Confirm & Share
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmShare(false)}
                  className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmShare(true)}
                className="w-full py-2.5 rounded-full border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50"
              >
                Share Wali Details
              </button>
              {status === "requested" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("end")}
                  className="w-full py-2 rounded-full text-sm font-semibold text-ink-700/70 hover:bg-ink-900/5"
                >
                  Not yet / End match
                </button>
              ) : null}
            </div>
          )
        ) : null}

        {!isFemaleViewer && (status === "involving" || status === "attempted") ? (
          <div className="space-y-2">
            {wali?.contact ? (
              <div className="rounded-xl bg-white border border-ink-900/8 px-3 py-2.5 text-sm">
                <p className="font-semibold text-ink-950">{wali.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/${wali.contact.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`tel:${wali.contact}`}
                    className="px-3 py-1.5 rounded-full border border-ink-900/12 text-xs font-semibold"
                  >
                    Call
                  </a>
                  {wali.email ? (
                    <a
                      href={`mailto:${wali.email}`}
                      className="px-3 py-1.5 rounded-full border border-ink-900/12 text-xs font-semibold"
                    >
                      Email
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(wali.contact || "")}
                    className="px-3 py-1.5 rounded-full border border-ink-900/12 text-xs font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-700/60">
                Waiting for contact card in chat, or ask her to share again.
              </p>
            )}
            {status === "involving" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act("attempted")}
                className="w-full py-2.5 rounded-full bg-ink-950 text-white text-sm font-semibold disabled:opacity-50"
              >
                I’ve Contacted the Wali
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("end")}
              className="w-full py-2 text-sm font-semibold text-ink-700/60"
            >
              I’m No Longer Proceeding
            </button>
          </div>
        ) : null}

        {isFemaleViewer && status === "attempted" ? (
          <div className="space-y-2">
            <p className="text-[13px] text-ink-800">
              He confirmed that he contacted your wali. Has contact been received?
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("confirm")}
              className="w-full py-2.5 rounded-full bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              Yes — Contact Received
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("problem", { note: note || "Problem reported" })}
              className="w-full py-2.5 rounded-full border border-amber-200 text-amber-900 text-sm font-semibold disabled:opacity-50"
            >
              There’s a Problem
            </button>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (wrong number, no response…)"
              className="w-full rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void act("end")}
              className="w-full py-2 text-sm font-semibold text-ink-700/60"
            >
              No Longer Proceeding
            </button>
          </div>
        ) : null}

        {status === "established" ? (
          <p className="text-[13px] text-ink-700/75 leading-relaxed">
            Chat stays open. You can continue talking on PN while the wali is involved, or manage
            wali oversight from Settings.
          </p>
        ) : null}
      </div>
    </div>
  );
}
