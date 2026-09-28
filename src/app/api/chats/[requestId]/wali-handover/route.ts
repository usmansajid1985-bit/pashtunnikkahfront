import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAcceptedParticipant } from "@/lib/chat";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";
import { broadcastChat } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

/**
 * Wali Handover state machine.
 * POST body: { action: "request"|"share"|"attempted"|"confirm"|"problem"|"end"|"continue_chat", note? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBrowseAndWaliSchema();

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const match = await assertAcceptedParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const now = new Date();

  const female = await prisma.profiles.findFirst({
    where: {
      user_id: { in: [match.sender_id, match.receiver_id] },
      OR: [
        { gender: { equals: "female", mode: "insensitive" } },
        { gender: { equals: "sister", mode: "insensitive" } },
      ],
    },
    select: { user_id: true },
  });
  const isFemale = female?.user_id === userId;
  const isMale = female != null && female.user_id !== userId;

  // W10: "Ready to involve family?" — each member answers Yes / Not yet. Both Yes unlocks the
  // family stage (only then can she share her wali's contact). "End" uses the End Match flow.
  if (action === "ready") {
    const answer = body.answer === "yes" ? "yes" : body.answer === "not_yet" ? "not_yet" : null;
    if (!answer) return NextResponse.json({ error: "Choose Yes or Not yet." }, { status: 400 });
    const column = match.sender_id === userId ? "family_ready_sender" : "family_ready_receiver";
    await prisma.$executeRawUnsafe(
      `UPDATE match_requests SET ${column} = $1, updated_at = NOW(),
         family_ready_at = CASE
           WHEN (CASE WHEN $2 = 'family_ready_sender' THEN $1 ELSE family_ready_sender END) = 'yes'
            AND (CASE WHEN $2 = 'family_ready_receiver' THEN $1 ELSE family_ready_receiver END) = 'yes'
           THEN COALESCE(family_ready_at, NOW()) ELSE NULL END
       WHERE id = $3`,
      answer,
      column,
      requestId
    );
    broadcastChat("family:update", [`thread:${raw}`], { requestId: raw });
    return NextResponse.json({ ok: true, answer });
  }

  let status: string;
  const sets: string[] = ["updated_at = NOW()"];

  switch (action) {
    case "request":
      if (!isMale) {
        return NextResponse.json({ error: "Only the brother can request wali details." }, { status: 400 });
      }
      status = "requested";
      sets.push("wali_details_requested_at = NOW()");
      break;
    case "share": {
      if (!isFemale) {
        return NextResponse.json({ error: "Only the sister can share wali details." }, { status: 400 });
      }
      const ready = await prisma.$queryRawUnsafe<{ family_ready_at: Date | null }[]>(
        `SELECT family_ready_at FROM match_requests WHERE id = $1`,
        requestId
      );
      if (!ready[0]?.family_ready_at) {
        return NextResponse.json(
          { error: "You can share your wali's details once you've both said you're ready to involve family." },
          { status: 400 }
        );
      }
      status = "involving";
      sets.push("wali_details_shared_at = NOW()");
      break;
    }
    case "attempted":
      if (!isMale) {
        return NextResponse.json({ error: "Only the brother can confirm contact attempt." }, { status: 400 });
      }
      status = "attempted";
      sets.push("wali_contact_attempted_at = NOW()");
      break;
    case "confirm":
      if (!isFemale) {
        return NextResponse.json({ error: "Only the sister can confirm wali contact." }, { status: 400 });
      }
      status = "established";
      sets.push("wali_contact_confirmed_at = NOW()");
      break;
    case "problem":
      status = "involving";
      sets.push(`wali_handover_note = ${sqlLiteral(String(body.note || "Problem reported").slice(0, 2000))}`);
      break;
    case "end":
      status = "ended";
      break;
    case "continue_chat":
      status = "established";
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  sets.push(`wali_handover_status = ${sqlLiteral(status)}`);
  await prisma.$executeRawUnsafe(
    `UPDATE match_requests SET ${sets.join(", ")} WHERE id = $1`,
    requestId
  );
  broadcastChat("family:update", [`thread:${raw}`], { requestId: raw });

  return NextResponse.json({ ok: true, status, at: now.toISOString() });
}

function sqlLiteral(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBrowseAndWaliSchema();

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const userId = BigInt(session.userId);
  const match = await assertAcceptedParticipant(requestId, userId);
  if (!match) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const rows = await prisma.$queryRawUnsafe<
    {
      wali_handover_status: string | null;
      wali_details_requested_at: Date | null;
      wali_details_shared_at: Date | null;
      wali_contact_attempted_at: Date | null;
      wali_contact_confirmed_at: Date | null;
      wali_handover_note: string | null;
      family_ready_sender: string | null;
      family_ready_receiver: string | null;
      family_ready_at: Date | null;
    }[]
  >(
    `SELECT wali_handover_status, wali_details_requested_at, wali_details_shared_at,
            wali_contact_attempted_at, wali_contact_confirmed_at, wali_handover_note,
            family_ready_sender, family_ready_receiver, family_ready_at
     FROM match_requests WHERE id = $1 LIMIT 1`,
    requestId
  );
  const row = rows[0] ?? null;
  const iAmSender = match.sender_id === userId;
  return NextResponse.json({
    handover: row,
    // W10: readiness from this viewer's point of view.
    family: row
      ? {
          mine: iAmSender ? row.family_ready_sender : row.family_ready_receiver,
          theirs: iAmSender ? row.family_ready_receiver : row.family_ready_sender,
          mutualAt: row.family_ready_at?.toISOString() ?? null,
        }
      : null,
  });
}
