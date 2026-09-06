"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tokenOk, setTokenOk] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setError("Missing verification token.");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(data.error || "This link is invalid or has expired.");
          setTokenOk(false);
        } else {
          setTokenOk(true);
        }
      })
      .catch(() => setError("Network error. Try again."))
      .finally(() => setChecking(false));
  }, [token]);

  useEffect(() => {
    if (!tokenOk || !token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(data.error || "Could not verify email.");
          return;
        }
        setDone(true);
        setTimeout(() => router.replace("/browse"), 2000);
      })
      .catch(() => setError("Network error. Try again."));
  }, [tokenOk, token, router]);

  return (
    <div className="w-full max-w-md">
      <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink-950 text-center">
        Verify your email
      </h1>
      <p className="mt-2 text-center text-sm text-ink-700/70">
        One quick step before you can send introductions.
      </p>

      <div className="mt-8 bg-white rounded-3xl border border-ink-900/8 shadow-sm p-8 space-y-4">
        {checking ? (
          <p className="text-sm text-ink-700/60 text-center">Verifying…</p>
        ) : done ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center">
            Email verified! Redirecting…
          </p>
        ) : error ? (
          <>
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2" role="alert">
              {error}
            </p>
            <Link
              href="/settings"
              className="block text-center py-3 rounded-full bg-rose-600 text-white text-sm font-semibold"
            >
              Go to Settings to resend
            </Link>
          </>
        ) : (
          <p className="text-sm text-ink-700/60 text-center">Almost there…</p>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#faf8f7] flex flex-col items-center justify-center px-4 py-12">
      <Link href="/browse" className="mb-8 flex items-center gap-2">
        <Image src="/images/logo.jpeg" alt="Pashtun Nikah" width={32} height={32} className="rounded-lg" />
        <span className="font-serif text-lg text-ink-950">Pashtun Nikah</span>
      </Link>
      <Suspense fallback={<p className="text-sm text-ink-700/60">Loading…</p>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
