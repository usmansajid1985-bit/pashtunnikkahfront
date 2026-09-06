import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushNotification } from "@/lib/push/server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Self-service test — the notification only ever goes to the caller's own
  // devices. Cap it so the button can't be used to hammer FCM.
  if (!rateLimit(`push-test:${session.userId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many test notifications — wait a minute and try again." },
      { status: 429 }
    );
  }

  const result = await sendPushNotification(BigInt(session.userId), {
    title: "Pashtun Nikah",
    body: "Notifications are working correctly.",
    url: "/settings",
    tag: "test",
    type: "system",
  });

  return NextResponse.json({ ok: true, ...result });
}
