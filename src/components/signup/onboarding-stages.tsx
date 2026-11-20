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
  // Android first: an Android user agent is never an iPhone/iPad (some Android tablets and
  // emulators report touch on a desktop-like platform, which the iPadOS check would catch).
  if (/Android/i.test(navigator.userAgent)) return "android";
  if (isIOS()) return "ios";
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
/** The real Pashtun Nikah mark (transparent PNGs cut from the brand logo). */
function Logo({ size = 44, white = false }: { size?: number; white?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={white ? "/images/logo-white.png" : "/images/logo-mark.png"} alt="" width={size} height={size} className="block" style={{ width: size, height: size }} />
  );
}

function StatusBar({ light = false }: { light?: boolean }) {
  const c = light ? "#fff" : "#111";
  return (
    <div className="flex items-center justify-between px-5 pt-[11px] text-[10px] font-semibold" style={{ color: c }}>
      <span>12:49</span>
      <span className="flex items-center gap-1">
        <svg width="13" height="9" viewBox="0 0 13 9" aria-hidden><g fill={c}><rect x="0" y="6" width="2.2" height="3" rx=".5" /><rect x="3.4" y="4.2" width="2.2" height="4.8" rx=".5" /><rect x="6.8" y="2.4" width="2.2" height="6.6" rx=".5" /><rect x="10.2" y="0" width="2.2" height="9" rx=".5" opacity=".35" /></g></svg>
        <svg width="12" height="9" viewBox="0 0 24 18" aria-hidden><path d="M12 17.5 15.6 13a5.6 5.6 0 0 0-7.2 0L12 17.5Zm-6.4-7.6 2 2.4a7.4 7.4 0 0 1 8.8 0l2-2.4a10.6 10.6 0 0 0-12.8 0ZM.8 4.2l2 2.4a14.6 14.6 0 0 1 18.4 0l2-2.4a17.8 17.8 0 0 0-22.4 0Z" fill={c} /></svg>
        <span className="rounded-[3px] px-[3px] text-[8px] leading-[11px]" style={{ background: c, color: light ? "#111" : "#fff" }}>78</span>
      </span>
    </div>
  );
}

/** A phone frame drawn in CSS — stays sharp at any size (no low-res screenshots). */
function Phone({ children, android = false, dark = false, fade = false }: { children: ReactNode; android?: boolean; dark?: boolean; fade?: boolean }) {
  return (
    <div
      className={`mx-auto w-[220px] p-[6px] shadow-[0_24px_50px_-22px_rgba(15,13,14,0.55)] ${android ? "rounded-[30px]" : "rounded-[36px]"}`}
      style={{
        background: "linear-gradient(145deg,#3a3637,#141213 45%,#2b2829)",
        ...(fade ? { WebkitMaskImage: "linear-gradient(#000 78%, transparent)", maskImage: "linear-gradient(#000 78%, transparent)" } : null),
      }}
    >
      <div
        className={`relative flex h-[440px] flex-col overflow-hidden ${android ? "rounded-[25px]" : "rounded-[31px]"}`}
        style={{ background: dark ? HOME_WALLPAPER : "#fff" }}
      >
        {android ? (
          <span className="absolute left-1/2 top-[9px] z-10 h-[11px] w-[11px] -translate-x-1/2 rounded-full bg-black" />
        ) : (
          <span className="absolute left-1/2 top-[8px] z-10 h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-black" />
        )}
        <StatusBar light={dark} />
        <div className="relative min-h-0 flex-1">{children}</div>
        {android ? null : <span className={`absolute bottom-[6px] left-1/2 h-[4px] w-[80px] -translate-x-1/2 rounded-full ${dark ? "bg-white/70" : "bg-black/80"}`} />}
      </div>
    </div>
  );
}

const HOME_WALLPAPER =
  "radial-gradient(120% 70% at 110% 30%, #b0623a 0%, transparent 45%), radial-gradient(90% 60% at -20% 75%, #a5532f 0%, transparent 50%), linear-gradient(160deg,#4a2c20,#2a1914 55%,#1b100c)";

/** Pashtun Nikah on a home screen: white rounded tile (iPhone) or pink round icon (Android). */
function AppIcon({ size = 58, android = false, sparkle = false }: { size?: number; android?: boolean; sparkle?: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {sparkle ? (
        <svg className="absolute -right-5 -top-4" width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M6 3l1.5 5M13 6l-4 4M18 12l-6 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : null}
      <div
        className={`flex items-center justify-center shadow-lg ${android ? "rounded-full" : "rounded-[23%]"}`}
        style={{ width: size, height: size, background: android ? "linear-gradient(140deg,#f0548f,#d81b63)" : "#fff" }}
      >
        <Logo size={size * 0.62} white={android} />
      </div>
      <span className="text-[10px] font-medium text-white drop-shadow">Pashtun Nikah</span>
    </div>
  );
}

function Dock({ android = false }: { android?: boolean }) {
  const tile = (bg: string, glyph: ReactNode, key: string) => (
    <span key={key} className={`flex h-[38px] w-[38px] items-center justify-center ${android ? "rounded-[12px]" : "rounded-[10px]"}`} style={{ background: bg }}>
      {glyph}
    </span>
  );
  const phone = <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z" /></svg>;
  const bubble = <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M12 3C6.5 3 2 6.8 2 11.4c0 2.6 1.4 4.9 3.7 6.4L5 21l3.6-1.9c1.1.3 2.2.5 3.4.5 5.5 0 10-3.8 10-8.4S17.5 3 12 3Z" /></svg>;
  const camera = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" aria-hidden><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>;
  const browser = android ? (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="10" fill="#db4437" /><path d="M12 2a10 10 0 0 1 8.7 5H12z" fill="#db4437" /><path d="M20.7 7A10 10 0 0 1 12 22l4.3-7.5z" fill="#ffcd40" /><path d="M12 22A10 10 0 0 1 3.3 7l4.4 7.5z" fill="#0f9d58" /><circle cx="12" cy="12" r="4.6" fill="#fff" /><circle cx="12" cy="12" r="3.5" fill="#4285f4" /></svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="10" fill="#fff" /><circle cx="12" cy="12" r="8.6" fill="#1e88e5" /><path d="m15.8 8.2-2.6 5-5 2.6 2.6-5z" fill="#fff" /><path d="m15.8 8.2-2.6 5-2.4-2.4z" fill="#ef4444" /></svg>
  );
  return (
    <div className={`mx-auto flex w-fit gap-3 px-3 py-2.5 ${android ? "" : "rounded-[22px] bg-white/15 backdrop-blur"}`}>
      {tile("#34c759", phone, "p")}
      {tile(android ? "#3b82f6" : "#2a9df4", bubble, "m")}
      {tile(android ? "#fff" : "#fff", browser, "b")}
      {tile("#e5e5e5", camera, "c")}
    </div>
  );
}

function AndroidNavBar({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`flex w-full self-stretch items-center justify-around py-2 text-[13px] ${dim ? "bg-black/40 text-white/80" : "text-white/80"}`}>
      <span>|||</span>
      <span className="inline-block h-3 w-3 rounded-[4px] border-[1.6px] border-current" />
      <span>‹</span>
    </div>
  );
}

/** Pink curved "tap here" arrow. */
function PointArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="34" height="34" viewBox="0 0 34 34" fill="none" stroke={BRAND} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M30 4C16 5 9 14 9 28" />
      <path d="M3.5 22.5 9 29l5.5-6.5" />
    </svg>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  return (
    <div className="flex justify-center gap-2.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full transition" style={{ background: i === index ? BRAND : "#dcd8da" }} />
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
export function EmailCodeStage({
  email,
  onVerified,
  sendFailed = false,
}: {
  email: string;
  onVerified: () => void;
  /** The account was created but the first code email didn't go out. */
  sendFailed?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    sendFailed ? "We couldn't send your code just now. Tap Resend code to try again." : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(sendFailed ? 0 : 60);
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
        <div className="mx-3 mt-1.5 flex items-center justify-between rounded-[10px] bg-[#f0eff1] px-2.5 py-[5px] text-[9px] text-ink-900">
          <span className="font-semibold">ᴀA</span>
          <span>🔒 pashtunnikah.com</span>
          <span>↻</span>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden px-4 text-center">
          <Logo size={50} />
          <p className="text-[13px] font-semibold text-ink-950">Pashtun Nikah</p>
          <p className="mt-4 whitespace-nowrap text-[20px] font-bold leading-tight text-ink-950">
            Where <span style={{ color: BRAND }}>Pashtuns</span>
            <br />
            marry.
          </p>
          <span className="absolute inset-x-[-20%] bottom-[-30px] h-24 rounded-[50%] bg-[#fde6ef]" />
          <PointArrow className="absolute bottom-2 left-[46%]" />
        </div>
        <div className="flex items-center justify-around border-t border-ink-900/10 bg-white pb-5 pt-2 text-[#2f7cf6]">
          <span className="text-[16px]">‹</span>
          <span className="text-[16px] opacity-40">›</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ boxShadow: `0 0 0 2px ${BRAND}`, color: "#2f7cf6" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M12 3v12M8 7l4-4 4 4" />
              <path d="M6 11v9h12v-9" />
            </svg>
          </span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z" /></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="7" y="7" width="13" height="13" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>
        </div>
      </div>
    </Phone>
  );
}

function ShareSheetMock() {
  const apps: [string, string, ReactNode][] = [
    ["AirDrop", "#e8f2ff", <svg key="a" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f7cf6" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="2" /><path d="M8 16a6 6 0 1 1 8 0M5 19a10 10 0 1 1 14 0" /></svg>],
    ["Messages", "#34c759", <svg key="m" width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M12 3C6.5 3 2 6.8 2 11.4c0 2.6 1.4 4.9 3.7 6.4L5 21l3.6-1.9c1.1.3 2.2.5 3.4.5 5.5 0 10-3.8 10-8.4S17.5 3 12 3Z" /></svg>],
    ["Mail", "#2f8cf6", <svg key="e" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m4 7 8 6 8-6" /></svg>],
    ["WhatsApp", "#25d366", <svg key="w" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden><path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z" /></svg>],
  ];
  const rows: [string, string][] = [
    ["Copy", "⧉"],
    ["Add to Reading List", "◯◯"],
    ["Add Bookmark", "📖"],
    ["Add to Favourites", "☆"],
    ["Add to Home Screen", "⊞"],
    ["Find on Page", "⌕"],
  ];
  return (
    <Phone>
      <div className="flex h-full flex-col bg-[#1d1b1c] pt-2">
        <div className="mx-3 h-3 rounded-t-xl bg-white/25" />
        <div className="relative flex-1 rounded-t-2xl bg-[#f2f1f3] px-2.5 pt-3">
          <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-white p-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <Logo size={20} />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-semibold text-ink-950">Pashtun Nikah</p>
              <p className="text-[8.5px] text-ink-700/60">pashtunnikah.com</p>
            </div>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ink-900/10 text-[8px] text-ink-700">✕</span>
          </div>
          <div className="mb-2.5 flex justify-around">
            {apps.map(([name, bg, icon]) => (
              <div key={name} className="flex flex-col items-center gap-0.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: bg }}>
                  {icon}
                </span>
                <span className="text-[6.5px] text-ink-700">{name}</span>
              </div>
            ))}
          </div>
          <div className="mb-1.5 flex items-center justify-between rounded-[10px] bg-white px-2.5 py-[7px] text-[9.5px] text-ink-950">
            Copy <span className="text-[10px]">⧉</span>
          </div>
          <div className="space-y-[3px] rounded-[10px] bg-white py-1">
            {rows.slice(1).map(([r, icon]) => {
              const hit = r === "Add to Home Screen";
              return (
                <div
                  key={r}
                  className="relative mx-1 flex items-center justify-between rounded-[9px] px-2 py-[6px] text-[9.5px] text-ink-950"
                  style={hit ? { boxShadow: `inset 0 0 0 2px ${BRAND}`, fontWeight: 600 } : undefined}
                >
                  {r}
                  <span className="text-[10px] text-ink-700">{icon}</span>
                  {hit ? <PointArrow className="absolute -top-7 right-10 scale-75" /> : null}
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
      <div className="flex h-full flex-col items-center pt-14">
        <AppIcon size={62} android={android} sparkle={!android} />
        <div className="mt-auto mb-2 flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1 w-1 rounded-full ${i === 1 ? "bg-white" : "bg-white/50"}`} />
          ))}
        </div>
        <div className={android ? "mb-1" : "mb-5"}>
          <Dock android={android} />
        </div>
        {android ? <AndroidNavBar /> : null}
      </div>
    </Phone>
  );
}

function AndroidPromptMock() {
  return (
    <Phone android>
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-1.5 px-2.5 pb-1.5 pt-1 text-[9px] text-ink-900">
          <span>⌂</span>
          <span className="flex-1 truncate rounded-full bg-[#f0eff1] px-2 py-[4px]">🔒 pashtunnikah.com</span>
          <span>+</span>
          <span className="rounded-[3px] border border-current px-[3px] text-[7px] leading-[10px]">1</span>
          <span>⋮</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1.5 bg-[#9c9a9b] px-4 pt-6 text-center">
          <Logo size={40} />
          <p className="text-[11px] font-medium text-ink-950">Pashtun Nikah</p>
          <p className="mt-3 text-[18px] font-bold text-ink-950">
            Where <span style={{ color: BRAND }}>Pashtuns</span>
          </p>
        </div>
        <div className="absolute inset-x-3 top-[46%] rounded-2xl bg-white p-3 shadow-xl">
          <p className="text-[11.5px] font-semibold text-ink-950">Install app</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50">
              <Logo size={26} />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-semibold text-ink-950">Pashtun Nikah</p>
              <p className="text-[8.5px] text-ink-700/60">pashtunnikah.com</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 text-[10px] font-semibold">
            <span className="text-[#2f7cf6]">Cancel</span>
            <span className="rounded-full px-3.5 py-1.5 text-white" style={{ background: BRAND }}>
              Install
            </span>
          </div>
        </div>
        <AndroidNavBar dim />
      </div>
    </Phone>
  );
}

function InstallHeading() {
  return (
    <div className="text-center">
      <h1 className="text-[27px] font-bold leading-tight text-ink-950 sm:text-[30px]">
        Add Pashtun Nikah to your <span style={{ color: BRAND }}>Home Screen</span>
      </h1>
      <p className="mt-2 text-[14.5px] text-ink-700/70">Install the app for a faster, app-like experience and instant updates.</p>
    </div>
  );
}

/** iPhone caption: pink "Step N" pill, title, one-line help. */
function IosCaption({ step, title, body }: { step: number; title: string; body: string }) {
  return (
    <div className="mt-4 text-center">
      <span className="inline-block rounded-full bg-rose-50 px-3 py-0.5 text-[12.5px] font-semibold" style={{ color: BRAND }}>
        Step {step}
      </span>
      <h2 className="mt-2 text-[19px] font-bold text-ink-950">{title}</h2>
      <p className="mx-auto mt-1 max-w-[220px] text-[13px] leading-snug text-ink-700/65">{body}</p>
    </div>
  );
}

/** Android caption: big title with a grey "Step X of 2" underneath. */
function AndroidCaption({ step, title }: { step: number; title: string }) {
  return (
    <div className="mt-5 text-center">
      <h2 className="text-[26px] font-bold text-ink-950">{title}</h2>
      <p className="mt-1 text-[14px] text-ink-700/60">Step {step} of 2</p>
    </div>
  );
}

/** Scales a 220px-wide phone down for the side-by-side layout. */
function Scaled({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div className="mx-auto" style={{ width: 220 * scale, height: 452 * scale }}>
      <div style={{ width: 220, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

const IOS_STEPS = [
  { title: "Tap Share", body: "Tap the Share button in Safari.", mock: <SafariMock key="s" /> },
  { title: "Add to Home Screen", body: "Select Add to Home Screen from the menu.", mock: <ShareSheetMock key="h" /> },
  { title: "Open Pashtun Nikah", body: "Find Pashtun Nikah on your Home Screen and tap to open.", mock: <HomeScreenMock key="o" /> },
];

export function InstallStage({ onDone }: { onDone: () => void }) {
  const [platform] = useState<DevicePlatform>(() => detectPlatform());
  const [iosStarted, setIosStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [manualAndroid, setManualAndroid] = useState(false);
  // Wide screens (iPad / desktop-size browser on iOS) show the three steps side by side.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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
    if (wide) {
      return (
        <div className="space-y-6 py-2">
          <InstallHeading />
          <div className="grid grid-cols-3 gap-2">
            {IOS_STEPS.map((s, i) => (
              <div key={s.title}>
                <Scaled scale={0.62}>{s.mock}</Scaled>
                <IosCaption step={i + 1} title={s.title} body={s.body} />
              </div>
            ))}
          </div>
          <Dots count={3} index={0} />
          <button type="button" onClick={finish} className={primaryBtn}>
            Continue
          </button>
          {skip}
        </div>
      );
    }
    const slides = IOS_STEPS.map((s, i) => (
      <div key={s.title}>
        {s.mock}
        <IosCaption step={i + 1} title={s.title} body={s.body} />
      </div>
    ));
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
      <AndroidCaption step={1} title="Tap Install app" />
      {manualAndroid ? (
        <p className="mx-auto mt-2 max-w-[280px] text-center text-[13px] text-ink-700/70">
          Open your browser menu <strong>⋮</strong> and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      ) : null}
    </div>,
    <div key="2">
      <HomeScreenMock android />
      <AndroidCaption step={2} title="Open Pashtun Nikah" />
    </div>,
  ];
  return (
    <div className="space-y-5 py-2">
      {index === 0 ? <InstallHeading /> : null}
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
    <Phone fade>
      <div className="flex h-full flex-col items-center bg-gradient-to-br from-[#f8f1f4] via-[#f3eef0] to-[#efe8eb] pt-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a3436" strokeWidth="2" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <p className="mt-1 text-[50px] font-medium leading-none text-ink-950">9:41</p>
        <p className="mt-1 text-[11px] text-ink-700/70">Tue, Jan 28</p>
        <div className="mt-5 w-full space-y-2 px-2.5">
          {notes.map((n) => (
            <div key={n.h} className="flex gap-2 rounded-2xl bg-white p-2.5 text-left shadow-[0_6px_18px_-10px_rgba(0,0,0,0.25)]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(140deg,#f0548f,#d81b63)" }}>
                <Logo size={22} white />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex justify-between text-[9px] text-ink-700/60">
                  <span className="font-semibold text-ink-900">Pashtun Nikah</span>
                  {n.t}
                </p>
                <p className="text-[10.5px] font-semibold text-ink-950">{n.h}</p>
                <p className="text-[9.5px] leading-snug text-ink-700/80">{n.b}</p>
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
    if (r.ok) {
      // A confirmation straight away, so they can see notifications really arrive on this device.
      void fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "welcome" }),
      }).catch(() => undefined);
      return onDone();
    }
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
