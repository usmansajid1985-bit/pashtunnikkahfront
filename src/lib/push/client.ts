const FCM_TOKEN_KEY = "pn_fcm_token";

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: "unsupported" | "ios_not_installed" };

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mediaStandalone || iosStandalone);
}

function hasPushApis(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "unsupported" };
  if (isIOS() && !isStandalone()) return { supported: false, reason: "ios_not_installed" };
  if (!hasPushApis()) return { supported: false, reason: "unsupported" };
  return { supported: true };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      }
    );
  });
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (err) {
    console.error("[push] service worker registration failed", err);
    return null;
  }
}

export async function getExistingSubscription(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/push/subscribe");
    const data = await res.json().catch(() => null);
    return Boolean(res.ok && data?.deviceCount > 0);
  } catch {
    return Boolean(localStorage.getItem(FCM_TOKEN_KEY));
  }
}

function detectPlatform(): string {
  if (isIOS()) return "ios";
  if (typeof navigator === "undefined") return "unknown";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

async function saveFcmToken(token: string) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken: token, platform: detectPlatform() }),
  });
  if (!res.ok) throw new Error("Failed to save subscription");
  localStorage.setItem(FCM_TOKEN_KEY, token);
}

async function loadFirebaseConfig() {
  const res = await fetch("/api/push/firebase-config");
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.configured || !data.apiKey) return null;
  return data as {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    vapidKey: string;
  };
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unsupported" | "ios_not_installed" | "error"; detail?: string };

export async function subscribeToPush(): Promise<SubscribeResult> {
  const support = getPushSupport();
  if (!support.supported) return { ok: false, reason: support.reason };

  try {
    const permission = await withTimeout(Notification.requestPermission(), 20000, "Permission prompt");
    if (permission === "denied") return { ok: false, reason: "denied" };
    if (permission !== "granted") return { ok: false, reason: "error", detail: "Permission not granted" };

    const config = await loadFirebaseConfig();
    if (!config?.vapidKey) {
      return { ok: false, reason: "unsupported", detail: "Firebase is not configured" };
    }

    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) {
      return { ok: false, reason: "unsupported", detail: "This browser does not support FCM" };
    }

    const app = getApps()[0] ?? initializeApp(config);
    const messaging = getMessaging(app);
    const token = await withTimeout(getToken(messaging, { vapidKey: config.vapidKey }), 20000, "Firebase token");
    if (!token) return { ok: false, reason: "error", detail: "Firebase did not return a device token" };

    await saveFcmToken(token);
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Subscribe failed";
    console.error("[push] subscribe failed", err);
    return { ok: false, reason: "error", detail };
  }
}

export async function listenForegroundPush(): Promise<() => void> {
  if (typeof window === "undefined" || Notification.permission !== "granted") return () => {};
  try {
    const config = await loadFirebaseConfig();
    if (!config) return () => {};
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, onMessage, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return () => {};
    const app = getApps()[0] ?? initializeApp(config);
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || "Pashtun Nikah";
      const body = payload.notification?.body || payload.data?.body || "";
      const icon = "/icons/pn-icon-192.png";
      const url = payload.data?.url || payload.fcmOptions?.link || "/";
      if (typeof navigator !== "undefined" && navigator.serviceWorker?.ready) {
        void navigator.serviceWorker.ready.then((reg) => {
          void reg.showNotification(title, {
            body,
            icon,
            tag: payload.data?.tag || "pashtun-nikah",
            data: { url },
          });
        });
        return;
      }
      new Notification(title, { body, icon });
    });
  } catch (err) {
    console.error("[push] foreground listener failed", err);
    return () => {};
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem(FCM_TOKEN_KEY) : null;
    if (token) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fcmToken: token }),
      });
      localStorage.removeItem(FCM_TOKEN_KEY);
    }
    return true;
  } catch (err) {
    console.error("[push] unsubscribe failed", err);
    return false;
  }
}
