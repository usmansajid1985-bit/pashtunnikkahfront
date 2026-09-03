import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setHideGoldBadge, readHideGoldBadge } from "@/lib/ensure-p2-schema";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  if ((user?.plan ?? "").toLowerCase() !== "gold") {
    return NextResponse.json({ error: "Gold membership required." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { hide?: boolean };
  const hide = Boolean(body.hide);
  await setHideGoldBadge(userId, hide);

  return NextResponse.json({ ok: true, hideGoldBadge: hide });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hide = await readHideGoldBadge(BigInt(session.userId));
  return NextResponse.json({ hideGoldBadge: hide });
}
