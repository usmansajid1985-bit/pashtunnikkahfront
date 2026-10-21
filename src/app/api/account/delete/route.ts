import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DELETION_REASONS,
  deletionDate,
  scheduleAccountDeletion,
  type DeletionReasonCode,
} from "@/lib/account-deletion";

/**
 * N54: close the account. A reason from the list is required ("Other" needs a few words). The
 * profile is hidden now, the account is deleted after 30 days unless they log in again, and the
 * member is signed out.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string; other?: string; confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  const reason = DELETION_REASONS.find((r) => r.code === body.reason)?.code as DeletionReasonCode | undefined;
  if (!reason) return NextResponse.json({ error: "Please choose a reason for leaving." }, { status: 400 });
  const other = String(body.other ?? "").slice(0, 400);
  if (reason === "other" && other.trim().length < 3) {
    return NextResponse.json({ error: "Please tell us a little more about why you're leaving." }, { status: 400 });
  }

  const { deleteOn } = await scheduleAccountDeletion(BigInt(session.userId), reason, other);
  const res = NextResponse.json({ ok: true, deleteOn: deleteOn.toISOString() });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.users.findUnique({
    where: { id: BigInt(session.userId) },
    select: { deletion_requested_at: true, deletion_reason: true },
  });

  return NextResponse.json({
    requested: Boolean(user?.deletion_requested_at),
    requestedAt: user?.deletion_requested_at?.toISOString() ?? null,
    deleteOn: user?.deletion_requested_at ? deletionDate(user.deletion_requested_at).toISOString() : null,
    reason: user?.deletion_reason ?? null,
  });
}
