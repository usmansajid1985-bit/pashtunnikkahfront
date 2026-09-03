import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Public feed of published announcements. */
export async function GET() {
  const rows = await prisma.announcements.findMany({
    where: {
      status: "published",
      OR: [{ publish_at: null }, { publish_at: { lte: new Date() } }],
    },
    orderBy: { publish_at: "desc" },
    take: 20,
  });

  return NextResponse.json({
    announcements: rows.map((a) => ({
      id: a.id.toString(),
      title: a.title,
      body: a.body,
      ctaLabel: a.cta_label,
      ctaUrl: a.cta_url,
      type: a.type,
      publishAt: a.publish_at?.toISOString() ?? a.created_at.toISOString(),
    })),
  });
}
