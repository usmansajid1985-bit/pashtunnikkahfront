"use client";

import { useEffect, useState } from "react";
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

async function setServerPreference(pushEnabled: boolean) {
  await fetch("/api/push/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pushEnabled }),
  }).catch(() => {});
}

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

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
    })();
  }, []);

  async function onEnable() {
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeToPush();
      if (result.ok) {
        await setServerPreference(true);
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
    const ok = await unsubscribeFromPush();
    await setServerPreference(false);
    setStatus(ok ? "not_subscribed" : "not_subscribed");
    setBusy(false);
  }

  async function onTest() {
    setBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult(data.error || "Couldn't send test notification.");
      } else if (data.delivered > 0) {
        setTestResult("Test notification sent — check your device.");
      } else if (data.reason === "no_subscriptions") {
        setTestResult("No device is registered yet. Try disabling and re-enabling notifications.");
      } else if (data.reason === "push_disabled") {
        setTestResult("Push is turned off in your preferences.");
      } else if (data.reason === "not_configured") {
        setTestResult("Push isn't configured on the server yet.");
      } else if (data.failed > 0) {
        setTestResult("Delivery failed. Try disabling and re-enabling notifications.");
      } else {
        setTestResult("Couldn't send test notification.");
      }
    } catch {
      setTestResult("Couldn't send test notification.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
      <h3 className="font-bold text-ink-950">Notifications</h3>

      {status === "loading" && <p className="mt-2 text-sm text-ink-700/60">Checking device support…</p>}

      {status === "ios_not_installed" && (
        <div className="mt-2 space-y-2 text-sm text-ink-700/75 leading-relaxed">
          <p>To receive notifications on iPhone:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Tap the Share button in Safari</li>
            <li>Choose &quot;Add to Home Screen&quot;</li>
            <li>Open Pashtun Nikah from your Home Screen</li>
            <li>Return here and enable notifications</li>
          </ol>
        </div>
      )}

      {status === "unsupported" && (
        <p className="mt-2 text-sm text-ink-700/60">
          Notifications aren&apos;t available here yet. On Chrome and Android they work in the
          browser. On iPhone, add this site to your Home Screen first. If you just set up
          Firebase, restart the web app so the keys load.
        </p>
      )}

      {status === "denied" && (
        <div className="mt-2 text-sm text-ink-700/70 leading-relaxed">
          <p>
            Notifications are blocked for this site in your browser. You can still use in-app
            notifications, but to receive push alerts:
          </p>
          <ol className="mt-2 list-decimal list-inside space-y-1">
            <li>Click the lock/info icon next to the address bar</li>
            <li>Set &quot;Notifications&quot; to Allow</li>
            <li>Reload this page and try again</li>
          </ol>
        </div>
      )}

      {status === "not_subscribed" && (
        <>
          <p className="mt-1 text-sm text-ink-700/65">Get notified when you receive a new message.</p>
          <button
            type="button"
            onClick={onEnable}
            disabled={busy}
            className="mt-3 px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Enable Notifications"}
          </button>
        </>
      )}

      {status === "subscribed" && (
        <>
          <p className="mt-1 text-sm font-semibold text-emerald-700">Notifications enabled ✓</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDisable}
              disabled={busy}
              className="px-4 py-2 rounded-full border border-ink-900/12 text-sm font-semibold hover:border-rose-300 disabled:opacity-60"
            >
              Disable Notifications
            </button>
            <button
              type="button"
              onClick={onTest}
              disabled={busy}
              className="px-4 py-2 rounded-full border border-ink-900/12 text-sm font-semibold hover:border-rose-300 disabled:opacity-60"
            >
              Send Test Notification
            </button>
          </div>
          {testResult ? <p className="mt-2 text-xs text-ink-700/70">{testResult}</p> : null}
        </>
      )}

      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
