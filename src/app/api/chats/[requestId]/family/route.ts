import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertAcceptedParticipant, assertMatchParticipant, chatAccessError } from "@/lib/chat";
import {
  FamilyFlowError,
  answerWaliContacted,
  declineFamilyRequest,
  dismissAutoReminder,
  getFamilyView,
  noteWaliContactAction,
  requestFamilyInvolvement,
  shareWaliDetails,
} from "@/lib/family-flow";

export const dynamic = "force-dynamic";

/** Involve Family state for this chat, from the signed-in member's point of view. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const match = await assertMatchParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  // Ended matches have no family flow — the client simply shows nothing.
  return NextResponse.json({ family: await getFamilyView(requestId, userId) });
}

/**
 * Every Involve Family action, manual or automatic, goes through here.
 * Body: { action: "request" | "decline" | "share" | "contact_action" | "contacted" | "dismiss_auto",
 *         via?: "manual" | "auto", answer?: "yes" | "not_yet" }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const match = await assertAcceptedParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: await chatAccessError(userId) }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const via = body.via === "auto" ? "auto" : "manual";

  try {
    switch (String(body.action || "")) {
      case "request":
        await requestFamilyInvolvement(requestId, userId, via);
        break;
      case "decline":
        await declineFamilyRequest(requestId, userId);
        break;
      case "share":
        await shareWaliDetails(requestId, userId, via);
        break;
      case "contact_action":
        await noteWaliContactAction(requestId, userId);
        break;
      case "contacted":
        if (body.answer !== "yes" && body.answer !== "not_yet") {
          return NextResponse.json({ error: "Choose Yes or Not yet." }, { status: 400 });
        }
        await answerWaliContacted(requestId, userId, body.answer === "yes");
        break;
      case "dismiss_auto":
        await dismissAutoReminder(requestId, userId);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof FamilyFlowError) {
      return NextResponse.json(
        { error: err.message, family: await getFamilyView(requestId, userId).catch(() => null) },
        { status: err.status }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, family: await getFamilyView(requestId, userId) });
}
