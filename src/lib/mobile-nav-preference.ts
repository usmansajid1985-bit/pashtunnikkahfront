"use client";

import { useEffect, useState } from "react";

/**
 * Mobile-only navigation chrome. "bottomBar" is the sticky tab bar (new); "menu" is the
 * pre-existing hamburger/slide-in panel. Desktop always keeps the sidebar regardless of this.
 */
export type MobileNavStyle = "bottomBar" | "menu";

const STORAGE_KEY = "pn-mobile-nav-style";
const EVENT = "pn:mobile-nav-style";
const DEFAULT_STYLE: MobileNavStyle = "bottomBar";

function readStoredStyle(): MobileNavStyle {
  if (typeof window === "undefined") return DEFAULT_STYLE;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "menu" ? "menu" : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

export function setMobileNavStyle(style: MobileNavStyle) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    /* storage blocked (private browsing) — preference just won't persist */
  }
  window.dispatchEvent(new CustomEvent<MobileNavStyle>(EVENT, { detail: style }));
}

/**
 * Reads the mobile nav preference and keeps a `body` class in sync so CSS (the
 * `--pn-bottom-nav-h` variable that content padding and fixed CTAs read) always matches
 * whichever component last resolved the preference — every page renders this hook independently.
 */
export function useMobileNavStyle(): [MobileNavStyle, (style: MobileNavStyle) => void] {
  const [style, setStyle] = useState<MobileNavStyle>(DEFAULT_STYLE);

  useEffect(() => {
    setStyle(readStoredStyle());
    const onChange = (e: Event) => setStyle((e as CustomEvent<MobileNavStyle>).detail ?? readStoredStyle());
    const onStorage = () => setStyle(readStoredStyle());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("pn-has-bottom-nav", style === "bottomBar");
  }, [style]);

  return [style, setMobileNavStyle];
}
