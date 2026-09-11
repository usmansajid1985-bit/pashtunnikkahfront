"use client";

import { useState, useTransition } from "react";

const field =
  "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not change password.");
        return;
      }
      reset();
      setSaved(true);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
          className="text-sm font-semibold text-rose-600 hover:underline"
        >
          Change password
        </button>
        {saved ? <p className="mt-2 text-xs text-emerald-700">Password changed.</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-semibold mb-1">Current password</label>
        <input
          type="password"
          autoComplete="current-password"
          className={field}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">New password</label>
        <input
          type="password"
          autoComplete="new-password"
          className={field}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">Confirm new password</label>
        <input
          type="password"
          autoComplete="new-password"
          className={field}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save new password"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            reset();
          }}
          className="px-4 py-2 rounded-full text-sm font-semibold text-ink-700/70 hover:bg-ink-900/5"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-ink-700/55">
        Forgot your current password?{" "}
        <a href="/forgot-password" className="font-semibold text-rose-600 hover:underline">
          Send a reset link
        </a>{" "}
        instead.
      </p>
    </form>
  );
}
