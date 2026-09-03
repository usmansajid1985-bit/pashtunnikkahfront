import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import type { PushPayload } from "@/lib/push/types";
import { getFirebaseMessaging } from "@/lib/push/firebase-admin";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function isFcmSub(sub: { endpoint: string; p256dh_key: string }) {
  return sub.p256dh_key === "fcm" || sub.endpoint.startsWith("fcm:");
}

function fcmTokenOf(sub: { endpoint: string; auth_key: string }) {
  return sub.endpoint.startsWith("fcm:") ? sub.endpoint.slice(4) : sub.auth_key;
}

async function nextNotificationId() {
  const max = await prisma.notifications.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

function endpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint.startsWith("fcm:") ? "fcm" : "unknown";
  }
}

export type PushSendResult = {
  delivered: number;
  failed: number;
  reason?: "push_disabled" | "not_configured" | "no_subscriptions";
};

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_ORIGIN || "http://localhost:3001").replace(
    /\/$/,
    ""
  );
}

export async function sendPushNotification(
  userId: bigint,
  payload: PushPayload
): Promise<PushSendResult> {
  await prisma.notifications.create({
    data: {
      id: await nextNotificationId(),
      recipient_user_id: userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      url: payload.url ?? null,
      tag: payload.tag ?? null,
      related_request_id: payload.relatedRequestId ?? null,
      created_at: new Date(),
    },
  });

  const prefs = await prisma.notification_preferences.findUnique({ where: { user_id: userId } });
  if (prefs && !prefs.push_enabled) return { delivered: 0, failed: 0, reason: "push_disabled" };

  const subscriptions = await prisma.push_subscriptions.findMany({ where: { user_id: userId } });
  if (subscriptions.length === 0) return { delivered: 0, failed: 0, reason: "no_subscriptions" };

  const messaging = getFirebaseMessaging();
  const hasVapid = ensureVapid();
  if (!messaging && !hasVapid) return { delivered: 0, failed: 0, reason: "not_configured" };

  const clickUrl = payload.url?.startsWith("http") ? payload.url : `${appOrigin()}${payload.url || "/"}`;
  const data = {
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "",
    type: payload.type,
  };

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      if (isFcmSub(sub)) {
        if (!messaging) throw new Error("fcm_not_configured");
        await messaging.send({
          token: fcmTokenOf(sub),
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: `${appOrigin()}/icons/pn-icon-192.png`,
          },
          data,
          webpush: {
            headers: { Urgency: "high", TTL: "86400" },
            fcmOptions: { link: clickUrl },
            notification: {
              title: payload.title,
              body: payload.body,
              icon: `${appOrigin()}/icons/pn-icon-192.png`,
              badge: `${appOrigin()}/icons/pn-icon-96.png`,
              tag: payload.tag || "pashtun-nikah",
              requireInteraction: true,
            },
          },
        });
        return;
      }
      if (!hasVapid) throw new Error("vapid_not_configured");
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
          tag: payload.tag,
          type: payload.type,
          data: payload.data,
        })
      );
    })
  );

  let failed = 0;
  await Promise.all(
    results.map(async (result, i) => {
      if (result.status === "fulfilled") return;
      failed++;
      const sub = subscriptions[i];
      const err = result.reason as { statusCode?: number; code?: string; errorInfo?: { code?: string } };
      const code = err?.statusCode ?? err?.errorInfo?.code ?? err?.code;
      if (code === 404 || code === 410 || String(code).includes("registration-token-not-registered")) {
        await prisma.push_subscriptions.delete({ where: { id: sub.id } }).catch(() => {});
        return;
      }
      console.error(`[push] send failed for ${endpointHost(sub.endpoint)}:`, code ?? result.reason);
    })
  );

  return { delivered: results.length - failed, failed };
}
