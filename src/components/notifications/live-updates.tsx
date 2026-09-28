"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { refreshNavCounts } from "@/components/browse/nav-notifications";

type Banner = { key: string; title: string; body: string; href: string };

type InboxEvent = { requestId: string; lastMessage: string; fromUserId: string; fromCode?: string | null };
type RequestEvent = { requestId: string; status: string; fromUserId?: string; fromCode?: string | null };
type PhotoEvent = { requestId: string; fromUserId?: string; fromCode?: string | null; kind?: string };
type AccountEvent = { status: string };

const BANNER_MS = 5000;
const AUTH_CHANNEL = "pn-auth";
/** Pages whose server-rendered data depends on request/match state. */
const REFRESH_PREFIXES = ["/requests", "/p/", "/dashboard"];

function preview(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

/**
 * App-wide realtime layer (mounted once in the root layout). Joins the signed-in member's user
 * channel on every page so badges, Requests lists and in-app banners update the moment something
 * happens — instead of waiting for the 45s poll. One shared system for message, request and
 * accepted-match banners (N01/N02); respects the "In-app notification banners" setting (N10).
 */
export function LiveUpdates() {
  const router = useRouter();
  const [me, setMe] = useState<{ userId: string; inAppBanners: boolean } | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const hideTimer = useRef<number | null>(null);
  const { joinUser, on } = useChatSocket(Boolean(me));

  useEffect(() => {
    if (window.location.pathname.startsWith("/wali")) return;
    let cancelled = false;
    // S10: every tab announces which account it is showing. If another tab signs in as someone
    // else (or signs out), this tab reloads so no previous-account data stays on screen.
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(AUTH_CHANNEL) : null;
    let shownUserId: string | null | undefined; // undefined = not resolved yet
    let shownStatus: string | null | undefined;

    const resolveAccount = async (announce: boolean) => {
      const res = await fetch("/api/realtime/me", { cache: "no-store" }).catch(() => null);
      if (!res || cancelled) return; // offline — don't guess
      const d = res.ok ? await res.json().catch(() => null) : null;
      const userId = d?.userId ? String(d.userId) : null;
      if (shownUserId !== undefined && userId !== shownUserId) {
        window.location.reload();
        return;
      }
      // N08 fallback: approval happened while this tab was in the background.
      const status: string | null = d?.profileStatus ?? null;
      if (shownStatus !== undefined && status !== shownStatus) {
        window.dispatchEvent(new CustomEvent("pn:account-status", { detail: { status } }));
      }
      shownStatus = status;
      if (shownUserId === undefined) {
        shownUserId = userId;
        if (d?.userTopic) {
          setMe({ userId: String(d.userId), inAppBanners: d.inAppBanners !== false });
          // PH09: lets the foreground push listener skip an OS notification the banner already covers.
          document.documentElement.dataset.pnInAppBanners = d.inAppBanners !== false ? "1" : "0";
          void joinUser(d.userTopic);
        }
      }
      if (announce) channel?.postMessage({ userId });
    };

    void resolveAccount(true);
    if (channel) {
      channel.onmessage = (e: MessageEvent<{ userId: string | null }>) => {
        if (shownUserId !== undefined && e.data?.userId !== shownUserId) window.location.reload();
      };
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void resolveAccount(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      channel?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [joinUser]);

  useEffect(() => {
    if (!me) return;

    const show = (b: Banner) => {
      if (!me.inAppBanners) return;
      setBanner(b);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setBanner(null), BANNER_MS);
    };

    const refreshPage = () => {
      const path = window.location.pathname;
      if (REFRESH_PREFIXES.some((p) => path.startsWith(p))) router.refresh();
    };

    const onInbox = (e: InboxEvent) => {
      refreshNavCounts();
      if (e.fromUserId === me.userId) return;
      // C02: this device has received the message → sender sees grey ✓✓.
      void fetch(`/api/chats/${e.requestId}/delivered`, { method: "POST" }).catch(() => {});
      // Already looking at that conversation — no banner.
      if (window.location.pathname === `/chats/${e.requestId}`) return;
      show({
        key: `msg-${e.requestId}-${Date.now()}`,
        title: e.fromCode || "New message",
        body: preview(e.lastMessage || "Sent you a message"),
        href: `/chats/${e.requestId}`,
      });
    };

    const onRequest = (e: RequestEvent) => {
      refreshNavCounts();
      refreshPage();
      if (!e.fromUserId || e.fromUserId === me.userId) return;
      if (e.status === "pending") {
        show({
          key: `req-${e.requestId}`,
          title: "New Match Request",
          body: `${e.fromCode || "A member"} sent you a Match Request.`,
          href: "/requests?tab=incoming",
        });
      } else if (e.status === "accepted") {
        show({
          key: `acc-${e.requestId}`,
          title: "Match accepted",
          body: `${e.fromCode || "A member"} accepted your Match Request.`,
          href: `/chats/${e.requestId}`,
        });
      }
    };

    const onGeneric = () => {
      refreshNavCounts();
      refreshPage();
    };

    // PH09: a match shared private photos — tap opens that conversation's photo gallery flow.
    const onPhoto = (e: PhotoEvent) => {
      if (e.kind !== "shared" || !e.fromUserId || e.fromUserId === me.userId) return;
      refreshNavCounts();
      // Already in that conversation: its own photo banner updates in place.
      if (window.location.pathname === `/chats/${e.requestId}`) return;
      show({
        key: `photo-${e.requestId}-${Date.now()}`,
        title: `${e.fromCode || "Your match"} shared private photos`,
        body: "Tap to view — one 60-second session.",
        href: `/chats/${e.requestId}?photos=1`,
      });
    };

    // N08: admin approved (or otherwise changed) this member's profile — update live, no re-login.
    const onAccount = (e: AccountEvent) => {
      refreshNavCounts();
      router.refresh();
      if (e.status === "approved") {
        show({
          key: `approved-${Date.now()}`,
          title: "Your profile is approved",
          body: "You can now browse and send Match Requests.",
          href: "/dashboard",
        });
      }
    };

    let lastStatus: string | null = null;
    const onAccountOnce = (status: string | undefined) => {
      if (!status || status === lastStatus) return;
      lastStatus = status;
      onAccount({ status });
    };

    const offs = [
      on("inbox:update", onInbox),
      on("inbox:read", () => refreshNavCounts()),
      on("request:update", onRequest),
      on("match:closed", onGeneric),
      on("private-photo:update", onPhoto),
      on("account:status", (e: AccountEvent) => onAccountOnce(e.status)),
    ];
    // The focus re-check (above) reports the same change too — the realtime event and the
    // re-check can both fire for one approval, so only the first one per status acts.
    const onLocal = (ev: Event) => onAccountOnce((ev as CustomEvent<AccountEvent>).detail?.status);
    window.addEventListener("pn:account-status", onLocal);
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener("pn:account-status", onLocal);
    };
  }, [me, on, router]);

  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    []
  );

  if (!banner) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pointer-events-none">
      <div
        key={banner.key}
        role="status"
        className="pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur px-3.5 py-3 shadow-[0_14px_40px_-12px_rgba(15,13,14,0.45)] border border-ink-900/8 animate-[pnBannerIn_220ms_ease-out]"
      >
        <button
          type="button"
          onClick={() => {
            setBanner(null);
            router.push(banner.href);
          }}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/pn-icon-180.png" alt="" className="h-9 w-9 shrink-0 rounded-xl" />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-ink-950 truncate">{banner.title}</span>
            <span className="block text-[13px] text-ink-700/80 truncate">{banner.body}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setBanner(null)}
          aria-label="Dismiss"
          className="shrink-0 h-7 w-7 rounded-full text-ink-700/50 hover:bg-ink-900/5 flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  );
}
