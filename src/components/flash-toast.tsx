"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SuccessToast } from "@/components/success-toast";

const EVENT = "pn:flash-toast";
const KEY = "pn_flash_toast";

/**
 * Show the approved white success toast — call only *after* the server confirmed the action.
 * Survives a navigation/refresh that the action triggers (e.g. "Filters applied", "Profile updated"):
 * the message is parked for a few seconds and the global host shows it on the next page.
 */
export function flashToast(message: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ message, at: Date.now() }));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

function takeParked(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const { message, at } = JSON.parse(raw) as { message: string; at: number };
    return Date.now() - at < 6000 ? message : null; // stale ones are dropped
  } catch {
    return null;
  }
}

/** Mounted once in the root layout. */
export function FlashToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onFlash = (e: Event) => {
      takeParked(); // shown right here — don't show it again after a navigation
      setMessage((e as CustomEvent<string>).detail);
    };
    window.addEventListener(EVENT, onFlash);
    return () => window.removeEventListener(EVENT, onFlash);
  }, []);

  // After a navigation / full reload, show a toast the previous page parked.
  useEffect(() => {
    const parked = takeParked();
    if (parked) setMessage(parked);
  }, [pathname]);

  return <SuccessToast message={message} onClose={() => setMessage(null)} />;
}
