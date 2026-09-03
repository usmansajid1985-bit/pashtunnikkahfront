import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPushNotification } from "@/lib/push/server";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Test notifications are disabled in production" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sendPushNotification(BigInt(session.userId), {
    title: "Pashtun Nikah",
    body: "Notifications are working correctly.",
    url: "/settings",
    tag: "test",
    type: "system",
  });

  return NextResponse.json({ ok: true, ...result });
}
