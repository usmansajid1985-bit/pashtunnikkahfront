import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastChat } from "@/lib/chat-broadcast";
import { logWaliActivity, normalizeWaliMode, WALI_MODES } from "@/lib/wali-activity";

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
  await logWaliActivity({ userId, linkId: link.id, event: "revoked", detail: `Removed ${link.name}'s access` });
  return NextResponse.json({ ok: true });
}

/** W05: change a connected wali's mode (notifications on/off) and email later. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = BigInt(session.userId);
  const link = await prisma.wali_links.findUnique({ where: { id: BigInt(id) } });
  if (!link || link.user_id !== userId || link.revoked_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const mode = body.mode !== undefined ? normalizeWaliMode(body.mode) : normalizeWaliMode(link.mode);
  const email =
    body.email !== undefined ? String(body.email ?? "").trim().toLowerCase().slice(0, 255) || null : link.email;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email, or leave it blank." }, { status: 400 });
  }
  if (mode === "oversight_notify" && !email) {
    return NextResponse.json({ error: "Add your wali's email to turn on notifications." }, { status: 400 });
  }
  const updated = await prisma.wali_links.update({ where: { id: link.id }, data: { mode, email } });
  const changes: string[] = [];
  if (mode !== normalizeWaliMode(link.mode)) {
    changes.push(`access changed to ${WALI_MODES.find((m) => m.value === mode)?.label ?? mode}`);
  }
  if ((email ?? null) !== (link.email ?? null)) changes.push(email ? `email set to ${email}` : "email removed");
  if (changes.length) {
    await logWaliActivity({ userId, linkId: link.id, event: "mode_changed", detail: `${link.name}: ${changes.join(", ")}` });
  }
  return NextResponse.json({ ok: true, mode: updated.mode, email: updated.email });
}
