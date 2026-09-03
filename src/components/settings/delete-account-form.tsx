"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountForm() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    void fetch("/api/account/delete")
      .then((r) => r.json())
      .then((d) => setScheduled(Boolean(d.requested)))
      .catch(() => {});
  }, []);

  if (scheduled) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3">
        Account deletion is scheduled. Contact support if this was a mistake.
      </p>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not schedule deletion");
        return;
      }
      router.push("/login");
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="Optional reason for leaving…"
        className="w-full rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
      />
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder='Type DELETE to confirm'
        className="w-full rounded-xl border border-ink-900/10 px-3 py-2 text-sm"
      />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending || confirm !== "DELETE"}
        onClick={submit}
        className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm font-semibold disabled:opacity-40"
      >
        {pending ? "Scheduling…" : "Delete my account"}
      </button>
    </div>
  );
}
