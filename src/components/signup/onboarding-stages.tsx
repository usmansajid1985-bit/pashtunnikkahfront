"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isIOS, isStandalone, subscribeToPush } from "@/lib/push/client";

const BRAND = "#e12d72";

/* ------------------------------------------------------------------ */
/* Android install prompt — captured as early as possible (it fires once, on page load).        */
/* ------------------------------------------------------------------ */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredInstall: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e as InstallPromptEvent;
  });
}

export type DevicePlatform = "ios" | "android" | "installed" | "desktop";
export function detectPlatform(): DevicePlatform {
  if (typeof window === "undefined") return "desktop";
  if (isStandalone()) return "installed";
  if (isIOS()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

const INSTALL_SEEN_KEY = "pn_install_seen";
/** Show the install page once, before onboarding, on phones that aren't already in the app. */
export function shouldShowInstallPage(): boolean {
  const p = detectPlatform();
  if (p === "installed" || p === "desktop") return false;
  try {
    return localStorage.getItem(INSTALL_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}
function markInstallSeen() {
  try {
    localStorage.setItem(INSTALL_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */
function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        d="M24 41s-15-9.2-15-20.2C9 14.6 13.4 10 18.8 10c2.4 0 4.2 1 5.2 2.3C25 11 26.8 10 29.2 10 34.6 10 39 14.6 39 20.8 39 31.8 24 41 24 41Z"
        fill="none"
        stroke={BRAND}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path d="M17 24.5c2.2-3.6 4.7-5.4 7-5.4s4.8 1.8 7 5.4" fill="none" stroke={BRAND} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/** A phone frame drawn in CSS — stays sharp at any size (no low-res screenshots). */
function Phone({ children, android = false, dark = false }: { children: ReactNode; android?: boolean; dark?: boolean }) {
  return (
    <div className="mx-auto w-[220px] rounded-[34px] bg-[#1c1a1b] p-[7px] shadow-[0_24px_50px_-20px_rgba(15,13,14,0.55)]">
      <div className={`relative flex h-[430px] flex-col overflow-hidden rounded-[28px] ${dark ? "bg-gradient-to-br from-[#3b2a22] via-[#5a3a2a] to-[#2a1d18]" : "bg-white"}`}>
        {android ? (
          <span className="absolute left-1/2 top-2 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-black" />
        ) : (
          <span className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        )}
        <div className={`flex items-center justify-between px-5 pt-2.5 text-[10px] font-semibold ${dark ? "text-white" : "text-ink-950"}`}>
          <span>12:49</span>
          <span>••• ▮</span>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function AppIcon({ size = 54, label = true, light = false }: { size?: number; label?: boolean; light?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center justify-center rounded-[22%] bg-white shadow-md" style={{ width: size, height: size }}>
        <Logo size={size * 0.62} />
      </div>
      {label ? <span className={`text-[10px] font-medium ${light ? "text-white" : "text-ink-950"}`}>Pashtun Nikah</span> : null}
    </div>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-2 w-2 rounded-full transition" style={{ background: i === index ? BRAND : "#d9d4d6" }} />
      ))}
    </div>
  );
}

/** Horizontal swipe pager on native scroll-snap (smooth on phones, keyboard/scroll friendly). */
function Pager({ slides, index, onIndex }: { slides: ReactNode[]; index: number; onIndex: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // While a button-driven scroll animates, ignore the scroll events it fires (they would
  // otherwise report the slide we're leaving and snap back).
  const autoUntil = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 4) {
      autoUntil.current = Date.now() + 700;
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [index]);
  return (
    <div
      ref={ref}
      onScroll={(e) => {
        if (Date.now() < autoUntil.current) return;
        const el = e.currentTarget;
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        if (i !== index) onIndex(i);
      }}
      className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {slides.map((s, i) => (
        <div key={i} className="w-full shrink-0 snap-center">
          {s}
        </div>
      ))}
    </div>
  );
}

const primaryBtn =
  "block w-full rounded-full bg-[#e12d72] py-4 text-center text-[16px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(225,45,114,0.6)] transition hover:bg-[#c92763] disabled:opacity-60";
const skipBtn = "mx-auto block py-3 text-[14.5px] font-semibold text-ink-950";

/* ------------------------------------------------------------------ */
/* 1. Email code                                                       */
/* ------------------------------------------------------------------ */
export function EmailCodeStage({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: value }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "That code isn't right.");
        if (d.code === "expired" || d.code === "max_attempts") setCode("");
        return;
      }
      onVerified();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    const res = await fetch("/api/auth/email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend" }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(d.error || "Couldn't resend the code.");
      if (d.retryAfter) setCooldown(Number(d.retryAfter));
      return;
    }
    setInfo("A new code is on its way.");
    setCooldown(60);
  }

  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      </div>
      <h1 className="mt-5 text-[26px] font-bold text-ink-950">Check your email</h1>
      <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-700/70">
        We sent a 6-digit code to <strong className="text-ink-950">{email}</strong>. Enter it to verify your email.
      </p>
      <input
        ref={inputRef}
        className="field mx-auto mt-6 block max-w-[240px] text-center text-[22px] tracking-[0.45em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label="6-digit email code"
        placeholder="••••••"
        value={code}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(v);
          if (v.length === 6) void verify(v);
        }}
      />
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-rose-700">
          {error}
        </p>
      ) : info ? (
        <p className="mt-3 text-[13px] text-emerald-700">{info}</p>
      ) : null}
      <button type="button" disabled={code.length !== 6 || busy} onClick={() => void verify()} className={`${primaryBtn} mt-6`}>
        {busy ? "Verifying…" : "Verify email"}
      </button>
      <button type="button" onClick={resend} disabled={cooldown > 0} className="mt-3 text-[14px] font-semibold text-[#e12d72] disabled:text-ink-700/45">
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
      <p className="mt-3 text-[12.5px] text-ink-700/55">Can&apos;t find it? Check your spam or junk folder.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Install Pashtun Nikah (optional, device-detected)               */
/* ------------------------------------------------------------------ */
function SafariMock() {
  return (
    <Phone>
      <div className="flex h-full flex-col">
        <div className="mx-3 mt-2 rounded-lg bg-ink-900/[0.06] py-1 text-center text-[9px] text-ink-700">pashtunnikah.com</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <Logo size={44} />
          <p className="text-[12px] font-semibold text-ink-950">Pashtun Nikah</p>
          <p className="text-[18px] font-bold leading-tight text-ink-950">
            Where <span style={{ color: BRAND }}>Pashtuns</span> marry.
          </p>
        </div>
        <div className="flex items-center justify-around border-t border-ink-900/10 py-2.5 text-ink-700">
          <span className="text-[13px]">‹</span>
          <span className="text-[13px] opacity-40">›</span>
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full ring-2" style={{ color: BRAND, boxShadow: `0 0 0 2px ${BRAND}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M12 3v12M8 7l4-4 4 4" />
              <path d="M6 11v8h12v-8" />
            </svg>
          </span>
          <span className="text-[12px]">▢</span>
          <span className="text-[12px]">⧉</span>
        </div>
      </div>
    </Phone>
  );
}

function ShareSheetMock() {
  const rows = ["Copy", "Add to Reading List", "Add Bookmark", "Add to Favourites", "Add to Home Screen", "Find on Page"];
  return (
    <Phone>
      <div className="flex h-full flex-col bg-ink-900/[0.25] pt-10">
        <div className="flex-1 rounded-t-2xl bg-[#f2f1f2] px-2.5 pt-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white p-2">
            <Logo size={26} />
            <div className="text-left">
              <p className="text-[10px] font-semibold text-ink-950">Pashtun Nikah</p>
              <p className="text-[8.5px] text-ink-700/60">pashtunnikah.com</p>
            </div>
          </div>
          <div className="space-y-px overflow-hidden rounded-xl bg-white">
            {rows.map((r) => {
              const hit = r === "Add to Home Screen";
              return (
                <div
                  key={r}
                  className="flex items-center justify-between px-3 py-2 text-[10px] text-ink-950"
                  style={hit ? { boxShadow: `inset 0 0 0 2px ${BRAND}`, borderRadius: 10, fontWeight: 600 } : undefined}
                >
                  {r}
                  <span className="text-[11px] text-ink-700/70">{hit ? "⊞" : "›"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Phone>
  );
}

function HomeScreenMock({ android = false }: { android?: boolean }) {
  return (
    <Phone android={android} dark>
      <div className="flex h-full flex-col items-center pt-16">
        <AppIcon size={62} light />
        <div className="mt-auto mb-4 flex gap-3 rounded-[22px] bg-white/20 px-3 py-2.5 backdrop-blur">
          {["#22c55e", "#3b82f6", "#f97316", "#a3a3a3"].map((c) => (
            <span key={c} className="h-9 w-9 rounded-[10px]" style={{ background: c }} />
          ))}
        </div>
      </div>
    </Phone>
  );
}

function AndroidPromptMock() {
  return (
    <Phone android>
      <div className="relative flex h-full flex-col">
        <div className="mx-3 mt-2 rounded-full bg-ink-900/[0.06] py-1 text-center text-[9px] text-ink-700">pashtunnikah.com</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center opacity-40">
          <Logo size={40} />
          <p className="text-[17px] font-bold text-ink-950">Where Pashtuns marry.</p>
        </div>
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-2xl bg-white p-3 shadow-xl">
          <p className="text-[12px] font-semibold text-ink-950">Install app</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
              <Logo size={24} />
            </div>
            <div className="text-left">
              <p className="text-[10.5px] font-semibold text-ink-950">Pashtun Nikah</p>
              <p className="text-[9px] text-ink-700/60">pashtunnikah.com</p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-3 text-[10.5px] font-semibold">
            <span className="text-[#3b6fd8]">Cancel</span>
            <span className="rounded-full px-3 py-1 text-white" style={{ background: BRAND }}>
              Install
            </span>
          </div>
        </div>
      </div>
    </Phone>
  );
}

function InstallHeading() {
  return (
    <div className="text-center">
      <h1 className="text-[27px] font-bold leading-tight text-ink-950">
        Add Pashtun Nikah to your <span style={{ color: BRAND }}>Home Screen</span>
      </h1>
      <p className="mt-2 text-[14.5px] text-ink-700/70">Install the app for a faster, app-like experience and instant updates.</p>
    </div>
  );
}

function StepCaption({ step, of, title, body }: { step: number; of: number; title: string; body?: string }) {
  return (
    <div className="mt-5 text-center">
      <span className="inline-block rounded-full bg-rose-50 px-3 py-0.5 text-[12px] font-semibold" style={{ color: BRAND }}>
        Step {step} of {of}
      </span>
      <h2 className="mt-2 text-[21px] font-bold text-ink-950">{title}</h2>
      {body ? <p className="mx-auto mt-1 max-w-[260px] text-[13.5px] text-ink-700/65">{body}</p> : null}
    </div>
  );
}

export function InstallStage({ onDone }: { onDone: () => void }) {
  const [platform] = useState<DevicePlatform>(() => detectPlatform());
  const [iosStarted, setIosStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [manualAndroid, setManualAndroid] = useState(false);

  function finish() {
    markInstallSeen();
    onDone();
  }

  // Already running as the installed app, or on a computer: nothing to install here.
  useEffect(() => {
    if (platform === "installed" || platform === "desktop") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);
  if (platform === "installed" || platform === "desktop") return null;

  const skip = (
    <button type="button" onClick={finish} className={skipBtn}>
      Continue without installing
    </button>
  );

  if (platform === "ios") {
    if (!iosStarted) {
      // Premium invitation first; "Install app" opens the 3-step tutorial.
      return (
        <div className="space-y-6 py-2">
          <InstallHeading />
          <HomeScreenMock />
          <button type="button" onClick={() => setIosStarted(true)} className={primaryBtn}>
            Install app
          </button>
          {skip}
        </div>
      );
    }
    const slides = [
      <div key="1">
        <SafariMock />
        <StepCaption step={1} of={3} title="Tap Share" body="Tap the Share button at the bottom of Safari." />
      </div>,
      <div key="2">
        <ShareSheetMock />
        <StepCaption step={2} of={3} title="Add to Home Screen" body="Choose Add to Home Screen from the menu." />
      </div>,
      <div key="3">
        <HomeScreenMock />
        <StepCaption step={3} of={3} title="Open Pashtun Nikah" body="Find Pashtun Nikah on your Home Screen and tap to open." />
      </div>,
    ];
    return (
      <div className="space-y-5 py-2">
        <InstallHeading />
        <Pager slides={slides} index={index} onIndex={setIndex} />
        <Dots count={3} index={index} />
        <button type="button" onClick={() => (index < 2 ? setIndex(index + 1) : finish())} className={primaryBtn}>
          Continue
        </button>
        {skip}
      </div>
    );
  }

  // Android: "Tap Install app" (real browser prompt) → "Open Pashtun Nikah".
  async function installAndroid() {
    if (deferredInstall) {
      await deferredInstall.prompt();
      const choice = await deferredInstall.userChoice.catch(() => ({ outcome: "dismissed" }));
      deferredInstall = null;
      if (choice.outcome === "accepted") setIndex(1);
      return;
    }
    // This browser didn't offer a one-tap install — show the menu route instead.
    setManualAndroid(true);
  }
  const slides = [
    <div key="1">
      <AndroidPromptMock />
      <StepCaption step={1} of={2} title="Tap Install app" />
      {manualAndroid ? (
        <p className="mx-auto mt-2 max-w-[280px] text-center text-[13px] text-ink-700/70">
          Open your browser menu <strong>⋮</strong> and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      ) : null}
    </div>,
    <div key="2">
      <HomeScreenMock android />
      <StepCaption step={2} of={2} title="Open Pashtun Nikah" />
    </div>,
  ];
  return (
    <div className="space-y-5 py-2">
      <InstallHeading />
      <Pager slides={slides} index={index} onIndex={setIndex} />
      {index === 0 ? (
        <button type="button" onClick={() => (manualAndroid ? setIndex(1) : void installAndroid())} className={primaryBtn}>
          {manualAndroid ? "I've installed it" : "Install app"}
        </button>
      ) : (
        <button type="button" onClick={finish} className={primaryBtn}>
          Continue
        </button>
      )}
      {skip}
      <Dots count={2} index={index} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Stay in the loop (optional notifications)                       */
/* ------------------------------------------------------------------ */
function LockScreenMock() {
  const notes = [
    { t: "now", h: "New match request", b: "Someone would like to get to know you." },
    { t: "2m ago", h: "New message", b: "You have a new message waiting for you." },
  ];
  return (
    <Phone>
      <div className="flex h-full flex-col items-center bg-gradient-to-b from-[#f7eef2] to-[#efe6ea] pt-8">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a3436" strokeWidth="2" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <p className="mt-1 text-[44px] font-bold leading-none text-ink-950">9:41</p>
        <p className="mt-1 text-[11px] text-ink-700/70">Tue, Jan 28</p>
        <div className="mt-5 w-full space-y-2 px-3">
          {notes.map((n) => (
            <div key={n.h} className="flex gap-2 rounded-2xl bg-white/90 p-2.5 text-left shadow-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: BRAND }}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path d="M24 41s-15-9.2-15-20.2C9 14.6 13.4 10 18.8 10c2.4 0 4.2 1 5.2 2.3C25 11 26.8 10 29.2 10 34.6 10 39 14.6 39 20.8 39 31.8 24 41 24 41Z" fill="none" stroke="#fff" strokeWidth="3.6" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex justify-between text-[9px] text-ink-700/60">
                  <span className="font-semibold text-ink-900">Pashtun Nikah</span>
                  {n.t}
                </p>
                <p className="text-[10.5px] font-semibold text-ink-950">{n.h}</p>
                <p className="text-[9.5px] text-ink-700/80">{n.b}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

export function NotifyStage({ onDone }: { onDone: () => void }) {
  const [platform] = useState<DevicePlatform>(() => detectPlatform());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // iPhone in the browser: push only works from the installed Home Screen app.
  const iosBrowser = platform === "ios";

  async function enable() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const r = await subscribeToPush().catch(() => ({ ok: false as const, reason: "error" as const }));
    setBusy(false);
    if (r.ok) return onDone();
    // Never block progress — explain, then let them carry on.
    setNote(
      r.reason === "denied"
        ? "Notifications are blocked in your browser settings. You can turn them on later in Settings."
        : "Notifications aren't available in this browser. You can turn them on later in Settings."
    );
  }

  return (
    <div className="space-y-6 py-2">
      <LockScreenMock />
      <div className="text-center">
        <h1 className="text-[28px] font-bold text-ink-950">Stay in the loop</h1>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-700/70">
          Get notified about new match requests, messages and important updates.
        </p>
      </div>
      {iosBrowser ? (
        <>
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-[13.5px] text-ink-900">
            On iPhone, notifications work from the installed app. Add Pashtun Nikah to your Home Screen (Share → Add to Home
            Screen), open it from there, then turn notifications on in Settings.
          </p>
          <button type="button" onClick={onDone} className={primaryBtn}>
            Continue
          </button>
        </>
      ) : (
        <>
          {note ? <p className="text-center text-[13px] text-ink-700/75">{note}</p> : null}
          <button type="button" onClick={note ? onDone : () => void enable()} disabled={busy} className={primaryBtn}>
            {busy ? "Turning on…" : note ? "Continue" : "Enable notifications"}
          </button>
        </>
      )}
      <button type="button" onClick={onDone} className={skipBtn}>
        Not now
      </button>
    </div>
  );
}
