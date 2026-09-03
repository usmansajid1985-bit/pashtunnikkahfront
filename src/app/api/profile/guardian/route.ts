import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function serialize(g: {
  name: string | null;
  contact: string | null;
  email: string | null;
  notes: string | null;
  updated_at: Date;
} | null) {
  if (!g) return null;
  return {
    name: g.name,
    contact: g.contact,
    email: g.email,
    notes: g.notes,
    updatedAt: g.updated_at.toISOString(),
  };
}

async function requireFemaleProfile(userId: bigint) {
  const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
  if (!profile || !(profile.gender || "").toLowerCase().startsWith("f")) return null;
  return profile;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = BigInt(session.userId);

  const profile = await requireFemaleProfile(userId);
  if (!profile) return NextResponse.json({ guardian: null });

  const guardian = await prisma.profile_guardians.findUnique({ where: { profile_id: profile.id } });
  return NextResponse.json({ guardian: serialize(guardian) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = BigInt(session.userId);

  const profile = await requireFemaleProfile(userId);
  if (!profile) {
    return NextResponse.json(
      { error: "Guardian/wali contact is only available on sister profiles." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 255) || null;
  const contact = String(body.contact ?? "").trim().slice(0, 128) || null;
  const email = String(body.email ?? "").trim().slice(0, 255) || null;
  if (!name) return NextResponse.json({ error: "Enter the wali's name." }, { status: 400 });
  if (!contact) return NextResponse.json({ error: "Enter a contact phone number." }, { status: 400 });

  const guardian = await prisma.profile_guardians.upsert({
    where: { profile_id: profile.id },
    update: { name, contact, email, updated_at: new Date() },
    create: {
      profile_id: profile.id,
      user_id: userId,
      name,
      contact,
      email,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ guardian: serialize(guardian) });
}
