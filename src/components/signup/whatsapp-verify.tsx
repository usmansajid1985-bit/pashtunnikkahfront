"use client";

import { useEffect, useRef, useState } from "react";

/** The official WhatsApp glyph (green). */
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"
      />
    </svg>
  );
}

/**
 * WhatsApp phone verification for the signup "phone" step (Twilio Verify, WhatsApp only).
 * Calls /api/verify/whatsapp/send then /check; on approval hands the signed proof to the wizard,
 * which account creation requires. Changing the number invalidates it (needs verifying again).
 */
export function WhatsAppVerify({
  phoneIso,
  phone,
  e164,
  verified,
  onVerified,
}: {
  phoneIso: string;
  phone: string;
  /** The number in E.164, or null while it isn't a valid number yet. */
  e164: string | null;
  /** True when the current number already has a valid proof. */
  verified: boolean;
  onVerified: (proof: string, e164: string) => void;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const honeypot = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // A different number than the one the code went to → start over.
  useEffect(() => {
    if (sentTo && e164 !== sentTo) {
      setSentTo(null);
      setCode("");
      setError(null);
    }
  }, [e164, sentTo]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function send() {
    if (!e164 || busy) return;
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/api/verify/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneIso, phone, website: honeypot.current?.value ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't send the WhatsApp code. Please try again.");
        if (data.retryAfter) setCooldown(Number(data.retryAfter));
        return;
      }
      setSentTo(e164);
      setCode("");
      setCooldown(Number(data.retryAfter) || 60);
      window.setTimeout(() => codeRef.current?.focus(), 50);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function check(value = code) {
    if (!sentTo || busy || value.length !== 6) return;
    setBusy("check");
    setError(null);
    try {
      const res = await fetch("/api/verify/whatsapp/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneIso, phone, code: value, website: honeypot.current?.value ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.proof) {
        setError(data.error || "That code isn't right. Please try again.");
        if (data.code === "expired" || data.code === "max_checks") {
          setSentTo(null);
          setCode("");
        }
        return;
      }
      onVerified(String(data.proof), String(data.phone || sentTo));
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (verified) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13.5px] font-semibold text-emerald-800" role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
        WhatsApp number verified
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Honeypot — invisible to people, often filled in by bots. */}
      <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      {!sentTo ? (
        <button
          type="button"
          onClick={send}
          disabled={!e164 || busy !== null || cooldown > 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-ink-900/12 bg-white text-[15px] font-semibold text-ink-950 transition hover:bg-ink-900/[0.03] disabled:opacity-50"
        >
          <WhatsAppIcon />
          {busy === "send" ? "Sending…" : cooldown > 0 ? `Send code on WhatsApp (${cooldown}s)` : "Send code on WhatsApp"}
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-ink-900/8 bg-ink-900/[0.02] p-3.5">
          <p className="flex items-start gap-2 text-[13.5px] text-ink-900">
            <span className="mt-0.5 shrink-0">
              <WhatsAppIcon size={16} />
            </span>
            <span>
              We sent a 6-digit code to <strong className="whitespace-nowrap">{sentTo}</strong> on WhatsApp.
            </span>
          </p>
          <div className="flex gap-2">
            <input
              ref={codeRef}
              className="field flex-1 text-center text-[18px] tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              aria-label="6-digit WhatsApp code"
              placeholder="••••••"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) void check(v);
              }}
            />
            <button
              type="button"
              onClick={() => void check()}
              disabled={code.length !== 6 || busy !== null}
              className="shrink-0 rounded-full bg-[#e12d72] px-5 text-[14.5px] font-semibold text-white disabled:opacity-50"
            >
              {busy === "check" ? "Checking…" : "Verify"}
            </button>
          </div>
          <div className="flex items-center justify-between text-[12.5px]">
            <button
              type="button"
              onClick={send}
              disabled={cooldown > 0 || busy !== null}
              className="font-semibold text-[#e12d72] disabled:text-ink-700/45"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setCode("");
                setError(null);
              }}
              className="text-ink-700/60 hover:text-ink-900"
            >
              Change number
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-[12.5px] text-rose-700">
          {error}
        </p>
      ) : (
        <p className="text-[12px] text-ink-700/55">
          We verify numbers by WhatsApp only. Make sure this number has WhatsApp.
        </p>
      )}
    </div>
  );
}
