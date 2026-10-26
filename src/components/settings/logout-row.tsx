"use client";

import { useState } from "react";
import { writeSessionMarker } from "@/lib/session-marker";
import { clearChatDeviceState } from "@/lib/chat-outbox";

export function LogoutRow() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      clearChatDeviceState();
    } finally {
      writeSessionMarker(null);
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-ink-900/[0.02] transition disabled:opacity-60"
    >
      <span
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "#f4f2f3", color: "#e12d72" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="M10 17l5-5-5-5M15 12H4" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-[#e12d72]">{busy ? "Logging out…" : "Log out"}</span>
        <span className="block text-[12.5px] text-ink-700/65 mt-0.5 leading-snug">Sign out of your account</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b5b0b3" strokeWidth="2.2" className="shrink-0">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
