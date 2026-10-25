"use client";

import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

// There is no store app yet, so "Get the app" installs the PWA: Chrome/Edge/Android get the
// native install prompt, everyone else (iOS Safari) gets the Add to Home Screen steps.
export function GetAppButton() {
  const deferred = useRef<InstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as InstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (deferred.current) {
      await deferred.current.prompt();
      deferred.current = null;
      return;
    }
    setShowHelp((v) => !v);
  }

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => void install()}
        className="font-display inline-flex items-center justify-center gap-2.5 w-[170px] h-[46px] rounded-full bg-black text-white text-[16px] font-medium hover:bg-ink-900 transition"
      >
        <svg width="18" height="22" viewBox="0 0 18 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="1.5" width="14" height="21" rx="2.5" />
          <path d="M7.5 19h3" strokeLinecap="round" />
        </svg>
        Get the app
      </button>
      {showHelp ? (
        <p className="mt-3 max-w-xs text-center text-[13px] leading-relaxed text-ink-700">
          On iPhone, tap <span className="font-semibold">Share</span> then{" "}
          <span className="font-semibold">Add to Home Screen</span>. On Android, open the browser menu and choose{" "}
          <span className="font-semibold">Install app</span>.
        </p>
      ) : null}
    </div>
  );
}
