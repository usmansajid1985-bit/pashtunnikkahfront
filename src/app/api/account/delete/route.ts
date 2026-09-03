import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureP3Schema } from "@/lib/ensure-p3-schema";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string; confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type DELETE in confirm field.' }, { status: 400 });
  }

  const userId = BigInt(session.userId);
  const now = new Date();
  await prisma.users.update({
    where: { id: userId },
    data: {
      deletion_requested_at: now,
      deletion_reason: String(body.reason ?? "").slice(0, 500) || null,
      account_status: "pending_deletion",
      updated_at: now,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Account scheduled for deletion. You will be signed out.",
  });
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
    reason: user?.deletion_reason ?? null,
  });
}
