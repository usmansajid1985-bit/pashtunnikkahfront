import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReport, logModeration } from "@/lib/moderation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (reason.length < 3) {
    return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });
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

  const report = await createReport({
    reporterId: me,
    reportedId,
    reason,
  });
  await logModeration({
    userId: reportedId,
    action: "user_reported",
    note: `by ${session.userId}: ${reason.slice(0, 200)}`,
  });

  return NextResponse.json({ ok: true, id: report.id.toString() });
}
