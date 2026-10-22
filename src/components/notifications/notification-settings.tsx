"use client";

import { useEffect, useState } from "react";
import { IN_APP_BANNERS_EVENT } from "@/components/notifications/live-updates";
import { NOTIFY_ALL_EVENT } from "@/components/notifications/notification-category-toggles";
import {
  getExistingSubscription,
  getPushSupport,
  isIOS,
  isStandalone,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client";

type Status =
  | "loading"
  | "ios_not_installed"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "not_subscribed";

const ALL_KEYS = {
  notify_requests: true,
  notify_messages: true,
  notify_profile_views: true,
  notify_wali: true,
  notify_updates: true,
  in_app_banners: true,
};

async function setAllAlerts(on: boolean) {
  const flags = Object.fromEntries(Object.keys(ALL_KEYS).map((key) => [key, on]));
  const res = await fetch("/api/push/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pushEnabled: on, ...flags }),
  }).catch(() => null);
  if (!res?.ok) return false;
  window.dispatchEvent(new CustomEvent(NOTIFY_ALL_EVENT, { detail: { on } }));
  window.dispatchEvent(new CustomEvent(IN_APP_BANNERS_EVENT, { detail: { on } }));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("pn-prefs");
    channel.postMessage({ inAppBanners: on });
    channel.close();
  }
  return true;
}

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [masterOn, setMasterOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isIOS() && !isStandalone()) {
        setStatus("ios_not_installed");
        return;
      }
      const support = getPushSupport();
      if (!support.supported) {
        setStatus("unsupported");
        return;
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const existing = await getExistingSubscription();
      setStatus(existing ? "subscribed" : "not_subscribed");
      if (existing) setMasterOn(true);
    })();
  }, []);

  async function onEnable() {
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeToPush();
      if (result.ok) {
        setStatus("subscribed");
      } else if (result.reason === "denied") {
        setStatus("denied");
      } else if (result.reason === "ios_not_installed") {
        setStatus("ios_not_installed");
      } else if (result.reason === "unsupported") {
        setStatus("unsupported");
        setError(result.detail || "Notifications aren't available in this browser.");
      } else {
        setError(result.detail || "Couldn't enable notifications. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    setBusy(true);
    setError(null);
    await unsubscribeFromPush();
    setStatus("not_subscribed");
    setBusy(false);
  }

  async function onMaster(next: boolean) {
    setBusy(true);
    setError(null);
    const saved = await setAllAlerts(next);
    if (!saved) {
      setError("Couldn't update your notification settings. Please try again.");
      setBusy(false);
      return;
    }
    setMasterOn(next);
    if (next) await onEnable();
    else await onDisable();
  }

  return (
    <div className="mt-5 bg-white rounded-2xl border border-ink-900/8 shadow-[0_8px_30px_-20px_rgba(15,13,14,0.3)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-bold text-ink-950">Push notifications</h3>
          <p className="mt-0.5 text-[13px] text-ink-700/60">
            Device and browser alerts, including when you&apos;re away from the app.
          </p>
          {status === "subscribed" ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Enabled on this browser
            </p>
          ) : null}
          <p className="mt-1 text-[13px] text-ink-700/50">Turn all alerts below on or off together.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={masterOn}
          aria-label="Push notifications"
          disabled={busy || status === "loading"}
          onClick={() => void onMaster(!masterOn)}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            masterOn ? "bg-[#e12d72]" : "bg-ink-900/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              masterOn ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {status === "ios_not_installed" && masterOn ? (
        <div className="mt-3 space-y-1 text-[13px] text-ink-700/70 leading-relaxed">
          <p>To receive alerts on iPhone, add Pashtun Nikah to your Home Screen, then turn this on again.</p>
        </div>
      ) : null}
      {status === "denied" && masterOn ? (
        <p className="mt-3 text-[13px] text-ink-700/70">
          This browser is blocking alerts. Allow notifications for this site, then turn the switch off and on again.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
