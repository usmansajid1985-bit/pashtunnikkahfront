importScripts("/firebase/firebase-app-compat.js");
importScripts("/firebase/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyABYRFV4kae0URx4n2qjWhQqBqx0iWN6hc",
  authDomain: "wedding-c3ffa.firebaseapp.com",
  projectId: "wedding-c3ffa",
  storageBucket: "wedding-c3ffa.firebasestorage.app",
  messagingSenderId: "289037527100",
  appId: "1:289037527100:web:1cd636342b94a2b3e23b39",
});

const messaging = firebase.messaging();

// K11/N03: every push (message, request, photo, grouped…) is drawn here with the same PN look:
// the sender's blurred photo (or the PN logo) as the icon and the monochrome PN heart as the
// Android status-bar badge. A full-colour badge is what rendered as a solid square before.
//
// N47: all PN notifications share ONE tag, so a new one replaces the last instead of stacking.
// Once 2+ notifications from a site pile up, Android/Chrome bundles them under a summary that
// Chrome draws with its own generic stacked-square icon — a website can't change that icon. One
// notification at a time (with a running count) keeps the PN heart in the status bar.
const PN_TAG = "pashtun-nikah";

async function showFromPayload(payload) {
  const n = (payload && payload.notification) || {};
  const d = (payload && payload.data) || {};
  const title = n.title || d.title || "Pashtun Nikah";
  const body = n.body || d.body || "";
  let count = 1;
  try {
    const open = await self.registration.getNotifications({ tag: PN_TAG });
    for (const existing of open) count += (existing.data && existing.data.count) || 1;
  } catch (e) {
    /* getNotifications unsupported — just show this one */
  }
  return self.registration.showNotification(title, {
    body: count > 1 ? `${body}${body ? "\n" : ""}${count} new notifications` : body,
    icon: d.icon || "/icons/pn-icon-192.png",
    badge: d.badge || "/icons/pn-badge-v2-96.png",
    tag: PN_TAG,
    renotify: true,
    requireInteraction: true,
    data: { url: d.url || "/", type: d.type || "system", count },
  });
}

messaging.onBackgroundMessage((payload) => showFromPayload(payload || {}));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const target = new URL(targetUrl, self.location.origin);
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin) {
          if ("focus" in client) await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target.href);
            } catch {
              client.postMessage({ type: "navigate", url: target.pathname + target.search });
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
