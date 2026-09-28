import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastBrowseVisibility } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

/** Pause / resume the member's profile in Browse. Saved immediately and server-side (F01/S03). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused must be true or false" }, { status: 400 });
  }
  await prisma.profiles.update({
    where: { user_id: BigInt(session.userId) },
    data: { is_hidden: body.paused, updated_at: new Date() },
  });
  broadcastBrowseVisibility(session.userId, !body.paused);
  return NextResponse.json({ ok: true, paused: body.paused });
}
