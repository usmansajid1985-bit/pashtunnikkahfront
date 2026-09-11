import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTraits } from "@/lib/communication";

export const dynamic = "force-dynamic";

// Niqab Mode and Wali-Only Mode were removed entirely (QA item 12).
const ALLOWED = new Set(["standard", "wali_oversight"]);

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });
  if (!(profile.gender || "").toLowerCase().startsWith("f")) {
    return NextResponse.json({ error: "Only sisters set a communication mode." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const communicationMode = String(body.communicationMode || "").toLowerCase();

  if (!ALLOWED.has(communicationMode)) {
    return NextResponse.json({ error: "Invalid communication mode" }, { status: 400 });
  }

  const extras = parseTraits(profile.traits);
  const next = { ...extras, communicationMode };
  delete (next as { niqabSubMode?: string }).niqabSubMode;

  await prisma.profiles.update({
    where: { id: profile.id },
    data: { traits: JSON.stringify(next), updated_at: new Date() },
  });

  return NextResponse.json({ ok: true, communicationMode });
}
