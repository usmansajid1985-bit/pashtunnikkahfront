import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReport, logModeration } from "@/lib/moderation";
import { assertMatchParticipant } from "@/lib/chat";
import {
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_MIN,
  REPORT_REASONS,
  reportReasonLabel,
} from "@/lib/report-reasons";

export const dynamic = "force-dynamic";

/**
 * A02: every report needs a reason from the agreed list plus written details. When it comes from
 * a chat, the conversation (and message, if one was reported) are recorded so the admin can
 * review it in context — only if the reporter really is in that conversation.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const category = String(body.category || "");
  const details = String(body.details || "").trim();
  if (!REPORT_REASONS.some((r) => r.value === category)) {
    return NextResponse.json({ error: "Please choose a reason." }, { status: 400 });
  }
  if (details.length < REPORT_DETAILS_MIN) {
    return NextResponse.json(
      { error: `Please add a few details (at least ${REPORT_DETAILS_MIN} characters).` },
      { status: 400 }
    );
  }

  const me = BigInt(session.userId);
  let reportedId: bigint | null = null;

  if (body.userId) {
    reportedId = BigInt(String(body.userId));
  } else if (body.profileCode) {
    const profile = await prisma.profiles.findFirst({
      where: { profile_code: { equals: String(body.profileCode), mode: "insensitive" } },
      select: { user_id: true },
    });
    reportedId = profile?.user_id ?? null;
  }

  if (!reportedId || reportedId === me) {
    return NextResponse.json({ error: "Invalid member" }, { status: 400 });
  }

  // Conversation context (optional) — must be a thread between these two members.
  let requestId: bigint | null = null;
  let messageId: bigint | null = null;
  let quoted: string | null = null;
  if (body.requestId && /^\d+$/.test(String(body.requestId))) {
    const match = await assertMatchParticipant(BigInt(String(body.requestId)), me);
    const between =
      match &&
      [match.sender_id, match.receiver_id].some((id) => id === reportedId) &&
      [match.sender_id, match.receiver_id].some((id) => id === me);
    if (between) {
      requestId = match.id;
      if (body.messageId && /^\d+$/.test(String(body.messageId))) {
        const msg = await prisma.messages.findFirst({
          where: { id: BigInt(String(body.messageId)), request_id: match.id, sender_id: reportedId },
          select: { id: true, body: true },
        });
        if (msg) {
          messageId = msg.id;
          quoted = msg.body;
        }
      }
    }
  }

  const label = reportReasonLabel(category)!;
  const trimmedDetails = details.slice(0, REPORT_DETAILS_MAX);
  const reason = [
    `${label}: ${trimmedDetails}`,
    quoted ? `Reported message: "${quoted.slice(0, 300)}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const report = await createReport({
    reporterId: me,
    reportedId,
    reason,
    category,
    details: trimmedDetails,
    requestId,
    messageId,
  });
  await logModeration({
    userId: reportedId,
    action: "user_reported",
    note: `by ${session.userId}: ${label} — ${trimmedDetails.slice(0, 160)}`,
  });

  return NextResponse.json({ ok: true, id: report.id.toString() });
}
