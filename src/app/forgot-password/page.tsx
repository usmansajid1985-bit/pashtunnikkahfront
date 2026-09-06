"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevResetUrl(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send reset link.");
        return;
      }
      setMessage(data.message || "If an account exists, we sent a reset link.");
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 flex flex-col">
      <header className="bg-white border-b border-ink-900/8">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpeg" alt="Pashtun Nikah" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-full border border-ink-900/15 text-ink-900 text-sm font-semibold hover:border-rose-300 transition"
          >
            Login
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink-950 text-center">
            Forgot password?
          </h1>
          <p className="mt-2 text-center text-sm text-ink-700/70">
            Enter your Profile ID or email and we&apos;ll send a reset link.
          </p>
          <form
            onSubmit={onSubmit}
            className="mt-8 bg-white rounded-3xl border border-ink-900/8 shadow-sm p-8 space-y-5"
          >
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-ink-900 mb-1.5">
                Profile ID or Email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your Profile ID or email"
                className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2" role="status">
                {message}
              </p>
            ) : null}
            {devResetUrl ? (
              <p className="text-sm text-ink-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 break-all">
                Dev reset link (no mail configured):{" "}
                <Link href={devResetUrl} className="text-rose-600 font-semibold underline">
                  Open reset page
                </Link>
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 transition disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-sm text-ink-700">
              <Link href="/login" className="text-rose-600 font-semibold hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
