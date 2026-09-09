import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleRequests } from "@/lib/matches";
import { sendPushNotification } from "@/lib/push/server";
import { profileCodeOf } from "@/lib/notifications";
import { maybeSendActivityEmail } from "@/lib/notification-email";
import {
  allowsPrivateChat,
  loadWaliContact,
  resolveModeForMatch,
} from "@/lib/communication";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await expireStaleRequests();

  const { id: raw } = await params;
  const id = BigInt(raw);
  const me = BigInt(session.userId);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "accept").toLowerCase();

  const match = await prisma.match_requests.findUnique({ where: { id } });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "accept") {
    if (match.receiver_id !== me) {
      return NextResponse.json({ error: "Only the recipient can accept" }, { status: 403 });
    }
    if (match.status !== "pending") {
      return NextResponse.json({ error: `Cannot accept a ${match.status} request` }, { status: 400 });
    }

    const mode = await resolveModeForMatch(match.sender_id, match.receiver_id);
    await prisma.match_requests.update({
      where: { id },
      data: {
        status: "accepted",
        communication_mode: mode,
        photo_shared: false,
        photo_shared_at: null,
        updated_at: new Date(),
      },
    });

    const accepterCode = await profileCodeOf(match.receiver_id);
    void maybeSendActivityEmail({
      userId: match.sender_id,
      kind: "request_accepted",
      heading: `${accepterCode} accepted your match request`,
      lines: ["You can now start a conversation on Pashtun Nikah."],
      ctaLabel: "Open conversation",
      ctaUrl: `/chats/${id}`,
    });
    void sendPushNotification(match.sender_id, {
      title: `${accepterCode} accepted your match request`,
      body: "You can now begin your conversation.",
      url: `/chats/${id}`,
      tag: `match-${id}`,
      type: "request_accepted",
      actorUserId: match.receiver_id,
      relatedRequestId: id,
    }).catch((err) => console.error("[push] match-accepted notification failed", err));

    if (!allowsPrivateChat(mode)) {
      // Identify female for wali contact
      const profiles = await prisma.profiles.findMany({
        where: { user_id: { in: [match.sender_id, match.receiver_id] } },
        select: { user_id: true, gender: true },
      });
      const female = profiles.find((p) => (p.gender || "").toLowerCase().startsWith("f"));
      const wali = female ? await loadWaliContact(female.user_id) : null;
      return NextResponse.json({
        ok: true,
        status: "accepted",
        requestId: raw,
        communicationMode: mode,
        privateChat: false,
        wali,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "accepted",
      requestId: raw,
      communicationMode: mode,
      privateChat: true,
    });
  }

  if (action === "decline") {
    if (match.receiver_id !== me) {
      return NextResponse.json({ error: "Only the recipient can decline" }, { status: 403 });
    }
    await prisma.match_requests.update({
      where: { id },
      data: { status: "declined", updated_at: new Date() },
    });
    return NextResponse.json({ ok: true, status: "declined", requestId: raw });
  }

  if (action === "withdraw") {
    if (match.sender_id !== me) {
      return NextResponse.json({ error: "Only the sender can withdraw" }, { status: 403 });
    }
    if (match.status !== "pending") {
      return NextResponse.json({ error: "Only pending requests can be withdrawn" }, { status: 400 });
    }
    await prisma.match_requests.update({
      where: { id },
      data: { status: "cancelled", updated_at: new Date() },
    });
    return NextResponse.json({ ok: true, status: "cancelled", requestId: raw });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
