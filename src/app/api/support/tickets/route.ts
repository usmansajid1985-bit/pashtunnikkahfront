import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  SUPPORT_CHANNELS,
  SUPPORT_DETAILS_MAX,
  SUPPORT_TOPICS,
  SupportRateLimitError,
  createSupportTicket,
  supportWhatsAppNumber,
  type SupportChannel,
  type SupportTopic,
} from "@/lib/support";

export const dynamic = "force-dynamic";

/** Help & Support → create a ticket. JSON: topic, reason, details?, channel. Returns the INC reference. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in to create a support request." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "We could not read your request. Please try again." }, { status: 400 });

  const topic = String(body.topic || "") as SupportTopic;
  if (!(topic in SUPPORT_TOPICS)) return NextResponse.json({ error: "Choose what you need help with." }, { status: 400 });
  const reason = String(body.reason || "");
  if (!(SUPPORT_TOPICS[topic].reasons as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "Choose a reason." }, { status: 400 });
  }
  const channel = String(body.channel || "") as SupportChannel;
  if (!SUPPORT_CHANNELS.includes(channel) || (channel === "whatsapp" && !supportWhatsAppNumber())) {
    return NextResponse.json({ error: "Choose a contact method." }, { status: 400 });
  }
  const details = String(body.details || "").trim().slice(0, SUPPORT_DETAILS_MAX) || null;

  try {
    const reference = await createSupportTicket({
      userId: BigInt(session.userId),
      topic,
      reason,
      details,
      channel,
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    });
    return NextResponse.json({ ok: true, reference });
  } catch (err) {
    if (err instanceof SupportRateLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
    console.error("[support] ticket create failed", err);
    return NextResponse.json({ error: "We could not create your request. Please try again." }, { status: 500 });
  }
}
