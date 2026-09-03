"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
      window.location.assign(data.redirectTo || "/browse");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink-950 text-center">Welcome Back</h1>
      <p className="mt-2 text-center text-sm text-ink-700/70">
        Sign in with your Profile ID (e.g. PNM005) or email.
      </p>
      <form onSubmit={onSubmit} className="mt-8 bg-white rounded-3xl border border-ink-900/8 shadow-sm p-8 space-y-5">
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
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-ink-900 mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
            required
          />
        </div>
        <div className="flex items-center justify-end -mt-2">
          <Link href="/forgot-password" className="text-sm font-medium text-rose-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        {info ? (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2" role="status">
            {info}
          </p>
        ) : null}
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
          {loading ? "Signing in…" : "Login"}
        </button>
        <p className="text-center text-sm text-ink-700">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-rose-600 font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </form>
      <Link href="/" className="block text-center mt-6 text-sm text-ink-700/60 hover:text-ink-900 transition">
        ← Back to Home
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
            <Image src="/images/logo.png" alt="Pashtun Nikah" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition"
          >
            Register
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
