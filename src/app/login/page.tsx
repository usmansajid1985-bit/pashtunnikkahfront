"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { writeSessionMarker } from "@/lib/session-marker";

function LoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const email = searchParams.get("email")?.trim();
    if (email) setIdentifier(email);
    if (searchParams.get("existing") === "1") {
      setInfo("An account with this email already exists. Please sign in.");
    } else if (searchParams.get("reset") === "1") {
      setInfo("Password updated. You can sign in with your new password.");
    } else if (searchParams.get("closed") === "1") {
      setInfo("Your account is closed and will be deleted in 30 days. Changed your mind? Just log in to reactivate it.");
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) window.location.replace("/browse");
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      writeSessionMarker(data.user?.id ?? null);
      window.location.assign(data.redirectTo || "/browse");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#e12d72] focus:bg-white focus:ring-3 focus:ring-[#e12d72]/15";

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-[32px] leading-tight font-semibold text-ink-950 text-center">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-ink-700/65">Sign in to your Pashtun Nikah account.</p>
      <form onSubmit={onSubmit} className="mt-6 bg-white rounded-3xl border border-ink-900/8 shadow-[0_10px_30px_-22px_rgba(15,13,14,0.45)] p-6 sm:p-7 space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-semibold text-ink-900 mb-1.5">
            Profile ID or email
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter your profile ID or email"
            className={field}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-ink-900 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`${field} pr-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-700/55 hover:text-ink-900"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {showPassword ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c5.5 0 9 5.2 9.8 7-.3.7-1.1 2-2.3 3.3M6.5 6.6C4 8.2 2.6 10.9 2.2 12c.8 1.8 4.3 7 9.8 7 1.6 0 3-.4 4.2-1" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </>
                ) : (
                  <>
                    <path d="M2.2 12C3 10.2 6.5 5 12 5s9 5.2 9.8 7c-.8 1.8-4.3 7-9.8 7s-9-5.2-9.8-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-[#e12d72] hover:underline">
            Forgot password?
          </Link>
        </div>
        {info ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2" role="status">
            {info}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[#e12d72] bg-rose-50 border border-rose-100 rounded-xl px-3 py-2" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-full bg-[#e12d72] text-white font-semibold hover:brightness-105 transition disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-ink-700">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#e12d72] font-semibold hover:underline">
            Create account
          </Link>
        </p>
      </form>
      <Link href="/" className="block text-center mt-5 text-sm text-ink-700/60 hover:text-ink-900 transition">
        ← Back to home
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 flex flex-col">
      <header className="bg-white border-b border-ink-900/8">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpeg" alt="Pashtun Nikah" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-full border border-[#e12d72] text-[#e12d72] text-sm font-semibold hover:bg-rose-50 transition"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-16">
        <Suspense fallback={<p className="text-sm text-ink-700/60">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
