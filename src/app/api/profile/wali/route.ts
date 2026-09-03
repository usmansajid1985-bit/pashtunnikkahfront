import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeWaliLinkCount, generateWaliToken, isFemaleProfile, listWaliLinks, MAX_ACTIVE_LINKS } from "@/lib/wali";

export const dynamic = "force-dynamic";

function serialize(link: {
  id: bigint;
  name: string;
  relation: string | null;
  token: string;
  revoked_at: Date | null;
  last_accessed_at: Date | null;
  created_at: Date;
}) {
  const origin = process.env.WEB_ORIGIN || "http://localhost:3001";
  return {
    id: link.id.toString(),
    name: link.name,
    relation: link.relation,
    link: `${origin}/wali/${link.token}`,
    revoked: Boolean(link.revoked_at),
    lastAccessedAt: link.last_accessed_at?.toISOString() ?? null,
    createdAt: link.created_at.toISOString(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = BigInt(session.userId);
  if (!(await isFemaleProfile(userId))) return NextResponse.json({ waliLinks: [] });

  const links = await listWaliLinks(userId);
  return NextResponse.json({ waliLinks: links.map(serialize) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = BigInt(session.userId);

  const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
  if (!profile || !(profile.gender || "").toLowerCase().startsWith("f")) {
    return NextResponse.json(
      { error: "Wali access links are only available on sister profiles." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 255);
  const relation = String(body.relation ?? "").trim().slice(0, 64) || null;
  if (!name) return NextResponse.json({ error: "Enter a name for this wali." }, { status: 400 });

  if ((await activeWaliLinkCount(userId)) >= MAX_ACTIVE_LINKS) {
    return NextResponse.json(
      { error: `You can have up to ${MAX_ACTIVE_LINKS} active wali links.` },
      { status: 400 }
    );
  }

  const created = await prisma.wali_links.create({
    data: {
      profile_id: profile.id,
      user_id: userId,
      name,
      relation,
      token: generateWaliToken(),
      created_at: new Date(),
    },
  });

  return NextResponse.json({ waliLink: serialize(created) });
}
