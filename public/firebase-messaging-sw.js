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

function showFromPayload(payload) {
  const n = (payload && payload.notification) || {};
  const d = (payload && payload.data) || {};
  const title = n.title || d.title || "Pashtun Nikah";
  return self.registration.showNotification(title, {
    body: n.body || d.body || "",
    icon: "/icons/pn-icon-192.png",
    badge: "/icons/pn-icon-96.png",
    tag: d.tag || n.tag || "pashtun-nikah",
    requireInteraction: true,
    data: { url: d.url || "/", type: d.type || "system" },
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
