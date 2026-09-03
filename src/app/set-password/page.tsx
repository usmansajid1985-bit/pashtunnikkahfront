"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) router.replace("/login");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update password.");
        return;
      }
      router.push(data.redirectTo || "/browse");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 flex flex-col">
      <header className="bg-white border-b border-ink-900/8">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="Pashtun Nikah" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">
          <h1 className="font-serif text-3xl font-medium text-ink-950 text-center">Choose a password</h1>
          <p className="mt-2 text-center text-sm text-ink-700/70">
            Your account was migrated from the old site. Set a new password to continue.
          </p>
          <form onSubmit={onSubmit} className="mt-8 bg-white rounded-3xl border border-ink-900/8 shadow-sm p-8 space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-ink-900 mb-1.5">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
                required
                minLength={8}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-semibold text-ink-900 mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
                required
                minLength={8}
              />
            </div>
            {error ? (
              <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save & continue"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
