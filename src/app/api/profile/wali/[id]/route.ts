import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastChat } from "@/lib/chat-broadcast";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = BigInt(session.userId);
  const link = await prisma.wali_links.findUnique({ where: { id: BigInt(id) } });
  if (!link || link.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.wali_links.update({
    where: { id: link.id },
    data: { revoked_at: new Date() },
  });
  // Any open wali page wipes itself immediately (W07).
  broadcastChat("wali:revoked", [`wali:${link.id.toString()}`], { linkId: link.id.toString() });
  return NextResponse.json({ ok: true });
}
