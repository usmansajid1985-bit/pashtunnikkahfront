"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import type { MatchRelationStatus } from "@/lib/matches";

export function MatchActions({
  profileCode,
  initial,
  layout = "fixed",
}: {
  profileCode: string;
  initial: MatchRelationStatus;
  layout?: "fixed" | "inline";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showSendModal, setShowSendModal] = useState(false);
  const [introMessage, setIntroMessage] = useState("");

  async function sendRequest(intro?: string | null, rematch = false) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileCode,
          rematch: rematch || status.state === "ended",
          ...(intro ? { introMessage: intro } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send request");
        return;
      }
      setShowSendModal(false);
      setIntroMessage("");
      if (data.status === "accepted") {
        setStatus({ state: "accepted", requestId: data.requestId });
        router.push(`/chats/${data.requestId}`);
        return;
      }
      setStatus({ state: "pending_sent", requestId: data.requestId });
      router.refresh();
    });
  }

  async function respond(action: "accept" | "decline") {
    if (status.state !== "pending_received") return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/matches/${status.requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update request");
        return;
      }
      if (action === "accept") {
        setStatus({ state: "accepted", requestId: data.requestId });
        router.push(`/chats/${data.requestId}`);
        return;
      }
      setStatus({ state: "declined", requestId: data.requestId });
      router.refresh();
    });
  }

  function onSendSubmit(e: FormEvent) {
    e.preventDefault();
    void sendRequest(introMessage.trim() || null, status.state === "ended");
  }

  const btn =
    "flex-1 text-center py-3.5 rounded-2xl font-semibold text-[15px] disabled:opacity-60 transition";

  const actions = (
    <>
      <div className="flex gap-2 w-full">
        {status.state === "none" ||
        status.state === "declined" ||
        status.state === "expired" ||
        status.state === "cancelled" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowSendModal(true)}
            className={`${btn} bg-rose-600 text-white hover:bg-rose-700 shadow-[0_12px_28px_-12px_rgba(170,25,69,0.55)]`}
          >
            {pending ? "Sending…" : "Send match request"}
          </button>
        ) : null}

        {status.state === "pending_sent" ? (
          <button type="button" disabled className={`${btn} bg-ink-900/8 text-ink-700`}>
            Request sent — waiting
          </button>
        ) : null}

        {status.state === "pending_received" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("decline")}
              className={`${btn} border border-ink-900/12 text-ink-950 hover:border-rose-300`}
            >
              Decline
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("accept")}
              className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
            >
              {pending ? "…" : "Accept & chat"}
            </button>
          </>
        ) : null}

        {status.state === "accepted" ? (
          <a
            href={`/chats/${status.requestId}`}
            className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
          >
            Open chat
          </a>
        ) : null}

        {status.state === "ended" ? (
          <>
            <a
              href={`/chats/${status.requestId}`}
              className={`${btn} border border-ink-900/12 text-ink-950 hover:border-rose-300`}
            >
              View past chat
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowSendModal(true)}
              className={`${btn} bg-rose-600 text-white hover:bg-rose-700 shadow-[0_12px_28px_-12px_rgba(170,25,69,0.55)]`}
            >
              {pending ? "Sending…" : "Request rematch"}
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      {showSendModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onSendSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3"
          >
            <h3 className="text-lg font-bold text-ink-950">Request rematch</h3>
            <p className="text-sm text-ink-700/70">
              Uses 1 rematch token plus 1 introduction credit. Optional message (250 characters).
            </p>
            <textarea
              value={introMessage}
              onChange={(e) => setIntroMessage(e.target.value.slice(0, 250))}
              rows={4}
              placeholder="Assalamu alaikum…"
              className="w-full rounded-xl border border-ink-900/10 px-3 py-2 text-sm resize-none focus:outline-none focus:border-rose-300"
            />
            <p className="text-[11px] text-ink-700/45 text-right">{introMessage.length}/250</p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send request"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setShowSendModal(false);
                  setIntroMessage("");
                }}
                className="flex-1 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );

  if (layout === "inline") return <div className="w-full">{actions}</div>;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 lg:static lg:bg-none lg:pt-4 lg:pb-0">
      <div className="max-w-lg lg:max-w-none mx-auto px-4 lg:px-0">{actions}</div>
    </div>
  );
}
