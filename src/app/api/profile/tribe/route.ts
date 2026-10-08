import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTribeChoice, matchTribe, standardTribe } from "@/lib/tribes";

/**
 * Tribe confirmation for members who joined before the Confederacy → Tribe selector. A profile
 * needs it until its tribe is one of the listed tribes (or "Unsure").
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profiles.findUnique({
    where: { user_id: BigInt(session.userId) },
    select: { tribe: true },
  });
  if (!profile || isTribeChoice(profile.tribe)) return NextResponse.json({ needsConfirm: false });

  const previous = (profile.tribe ?? "").trim();
  // Pre-selected only on a confident match; otherwise the member chooses.
  return NextResponse.json({ needsConfirm: true, previous: previous || null, suggestion: matchTribe(previous) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { tribe?: unknown };
  const tribe = standardTribe(typeof body.tribe === "string" ? body.tribe : "");
  if (!tribe) return NextResponse.json({ error: "Please select your tribe from the list." }, { status: 400 });

  const { count } = await prisma.profiles.updateMany({
    where: { user_id: BigInt(session.userId) },
    data: { tribe, updated_at: new Date() },
  });
  if (!count) return NextResponse.json({ error: "No profile" }, { status: 404 });
  return NextResponse.json({ ok: true, tribe });
}
