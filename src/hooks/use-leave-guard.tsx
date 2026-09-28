"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * P10: warn before unsaved changes are thrown away. Covers closing/reloading the tab
 * (beforeunload), in-app links (captured before Next.js navigates) and the browser Back button
 * (a sentinel history entry). Returns the confirm dialog to render.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const sentinelRef = useRef(false);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab/window — nothing lost
      const a = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };

    // Back button: park a duplicate entry so "Back" lands here first and we can ask.
    if (!sentinelRef.current) {
      window.history.pushState({ pnLeaveGuard: true }, "", window.location.href);
      sentinelRef.current = true;
    }
    const onPopState = () => {
      if (!dirtyRef.current) return;
      window.history.pushState({ pnLeaveGuard: true }, "", window.location.href);
      setPendingHref("__back__");
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);

  function leave() {
    const href = pendingHref;
    setPendingHref(null);
    dirtyRef.current = false;
    if (href === "__back__") {
      // Skip our sentinel entry as well as the page itself.
      window.history.go(-2);
    } else if (href) {
      router.push(href);
    }
  }

  const dialog = pendingHref ? (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-guard-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="leave-guard-title" className="font-bold text-ink-950">
          Discard unsaved changes?
        </h2>
        <p className="mt-1.5 text-sm text-ink-700/75">
          You&apos;ve made changes to your profile that haven&apos;t been saved. If you leave now they&apos;ll be
          lost.
        </p>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setPendingHref(null)}
            className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm font-semibold"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={leave}
            className="px-4 py-2 rounded-full border border-ink-900/12 text-sm font-semibold text-ink-700"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { dialog };
}
