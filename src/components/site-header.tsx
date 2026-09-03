"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Me = {
  id: string;
  displayName?: string;
  profileCode?: string | null;
} | null;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [me, setMe] = useState<Me>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setMe(data.user ?? null);
          setMeLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setMeLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => setOpen(false);
  const loggedIn = Boolean(me);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setMe(null);
    window.location.href = "/";
  }

  return (
    <>
      {showBanner && (
        <div className="relative bg-rose-600 text-white text-sm">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-2.5 flex items-center justify-center gap-2 text-center pr-10">
            <span>We&apos;re in early access — register now and be among our founding members.</span>
            {!loggedIn ? (
              <Link href="/signup" className="underline font-semibold whitespace-nowrap hover:no-underline">
                Join today
              </Link>
            ) : null}
          </div>
          <button
            aria-label="Dismiss"
            onClick={() => setShowBanner(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-white/80 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ink-900/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href={loggedIn ? "/browse" : "/"} className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="Pashtun Nikah logo" width={32} height={32} className="rounded-lg object-cover" />
            <span className="text-lg font-semibold tracking-tight text-ink-950">Pashtun Nikah</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-9 text-sm font-medium text-ink-700">
            <a href="#how-it-works" className="hover:text-rose-600 transition">How It Works</a>
            <a href="#trust" className="hover:text-rose-600 transition">Why Us</a>
            <a href="#about" className="hover:text-rose-600 transition">About</a>
            <a href="#stories" className="hover:text-rose-600 transition">Stories</a>
            <a href="#faq" className="hover:text-rose-600 transition">FAQ</a>
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            {!meLoaded ? (
              <span className="text-sm text-ink-700/40">…</span>
            ) : loggedIn ? (
              <>
                <Link href="/browse" className="text-sm font-medium text-ink-900 hover:text-rose-600 transition">
                  Browse
                </Link>
                <Link href="/chats" className="text-sm font-medium text-ink-900 hover:text-rose-600 transition">
                  Chats
                </Link>
                <Link href="/profile" className="text-sm font-semibold text-rose-600">
                  {me?.profileCode || me?.displayName || "My Profile"}
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="px-4 py-2 rounded-full border border-ink-900/12 text-sm font-semibold hover:bg-ink-900/5"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-ink-900 hover:text-rose-600 transition">
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center text-ink-900"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 bg-ink-950/50 lg:hidden transition-opacity duration-350 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full bg-white lg:hidden flex flex-col transition-transform duration-400 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(.16,1,.3,1)" }}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-ink-900/5">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="Pashtun Nikah logo" width={32} height={32} className="rounded-lg object-cover" />
            <span className="text-lg font-semibold text-ink-950">Pashtun Nikah</span>
          </div>
          <button aria-label="Close menu" onClick={close} className="w-9 h-9 flex items-center justify-center text-ink-900">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-5 pt-8">
          {[
            ["#how-it-works", "How It Works"],
            ["#trust", "Why Us"],
            ["#about", "About"],
            ["#stories", "Stories"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={close}
              className="py-4 border-b border-ink-900/5 text-2xl font-serif text-ink-950"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="px-5 pb-10 pt-4 flex flex-col gap-3">
          {loggedIn ? (
            <>
              <Link href="/browse" onClick={close} className="text-center px-5 py-3.5 rounded-full bg-rose-600 text-white font-semibold">
                Browse profiles
              </Link>
              <Link href="/chats" onClick={close} className="text-center px-5 py-3.5 rounded-full border border-ink-900/15 text-ink-900 font-semibold">
                Chats
              </Link>
              <button type="button" onClick={() => void logout()} className="text-center px-5 py-3.5 rounded-full border border-ink-900/15 text-ink-900 font-semibold">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={close} className="text-center px-5 py-3.5 rounded-full border border-ink-900/15 text-ink-900 font-semibold">
                Login
              </Link>
              <Link href="/signup" onClick={close} className="text-center px-5 py-3.5 rounded-full bg-rose-600 text-white font-semibold">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
