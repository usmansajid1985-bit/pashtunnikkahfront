import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDataUrlPhoto } from "@/lib/photos";
import { logModeration } from "@/lib/moderation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const dataUrl = String(body.photoDataUrl || "");
    const kind = body.kind === "verification" ? "verification" : "public";
    if (!dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
    }

    const userId = BigInt(session.userId);
    const saved = await saveDataUrlPhoto(userId, dataUrl, kind);

    const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    let extras: Record<string, unknown> = {};
    try {
      extras = profile.traits ? JSON.parse(profile.traits) : {};
    } catch {
      extras = {};
    }
    extras.hasPhoto = true;

    const data =
      kind === "verification"
        ? {
            photo_verification_url: saved.url,
            updated_at: new Date(),
            traits: JSON.stringify(extras),
          }
        : {
            photo_url: saved.url,
            photo_status: "pending",
            photo_version: (profile.photo_version ?? 0) + 1,
            status: profile.status === "approved" ? "pending" : profile.status,
            updated_at: new Date(),
            traits: JSON.stringify(extras),
          };

    await prisma.profiles.update({ where: { user_id: userId }, data });
    await logModeration({
      userId,
      action: kind === "verification" ? "photo_verification_uploaded" : "photo_uploaded",
      note: saved.url,
    });

    return NextResponse.json({
      ok: true,
      url: saved.url,
      photoStatus: kind === "public" ? "pending" : profile.photo_status,
      message: "Photo uploaded — awaiting moderation.",
    });
  } catch (err) {
    console.error("photo upload", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 }
    );
  }
}
