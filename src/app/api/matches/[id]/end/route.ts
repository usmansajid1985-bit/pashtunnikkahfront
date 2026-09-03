import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endMatchRequest } from "@/lib/matches";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: raw } = await params;
  const requestId = BigInt(raw);
  const me = BigInt(session.userId);

  try {
    await ensureMatchRequestsSchema();
    const match = await prisma.match_requests.findUnique({ where: { id: requestId } });
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (match.sender_id !== me && match.receiver_id !== me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await endMatchRequest({
      requestId,
      endedBy: me,
      reason: "user",
    });

    return NextResponse.json({
      ok: true,
      status: "ended",
      requestId: raw,
      endedAt: result.endedAt.toISOString(),
      endReason: result.reason,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not end match" },
      { status: 400 }
    );
  }
}
