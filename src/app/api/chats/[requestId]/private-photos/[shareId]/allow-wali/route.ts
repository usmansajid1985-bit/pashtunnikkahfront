import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allowWaliView, withdrawWaliView } from "@/lib/private-photos";
import { broadcastChat } from "@/lib/chat-broadcast";
import { logWaliActivity } from "@/lib/wali-activity";

export const dynamic = "force-dynamic";

/** PH10: tell every active wali portal of this sister to refresh its photo state right away. */
async function pushToWalis(userId: bigint, requestId: string) {
  const links = await prisma.wali_links.findMany({
    where: { user_id: userId, revoked_at: null },
    select: { id: true },
  });
  if (links.length) {
    broadcastChat("private-photo:update", links.map((l) => `wali:${l.id.toString()}`), { requestId, wali: true });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ requestId: string; shareId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId, shareId: rawShareId } = await params;
  const userId = BigInt(session.userId);

  try {
    await allowWaliView({ shareId: BigInt(rawShareId), recipientId: userId });
    await pushToWalis(userId, requestId);
    await logWaliActivity({
      userId,
      event: "photo_access_granted",
      requestId: BigInt(requestId),
      detail: "You allowed your wali to view a private photo reveal",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not allow wali access" },
      { status: 400 }
    );
  }
}

/** PH10: withdraw wali access to this share. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ requestId: string; shareId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId, shareId: rawShareId } = await params;
  const userId = BigInt(session.userId);
  try {
    await withdrawWaliView({ shareId: BigInt(rawShareId), recipientId: userId });
    await pushToWalis(userId, requestId);
    await logWaliActivity({
      userId,
      event: "photo_access_withdrawn",
      requestId: BigInt(requestId),
      detail: "You withdrew your wali's access to a private photo reveal",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not withdraw" }, { status: 400 });
  }
}
