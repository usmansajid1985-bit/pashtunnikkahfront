import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDataUrlPhoto } from "@/lib/photos";
import { logModeration } from "@/lib/moderation";
import { addProfilePhoto, setMainProfilePhoto } from "@/lib/profile-photos";

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

    // Legacy "upload my photo" call — route it through the gallery so there's one source of
    // truth, and make the new upload the main photo.
    if (kind === "public") {
      const add = await addProfilePhoto(userId, dataUrl);
      if (!add.ok) return NextResponse.json({ error: add.error }, { status: 400 });
      await setMainProfilePhoto(userId, BigInt(add.photo.id));
      await logModeration({ userId, action: "photo_uploaded", note: add.photo.url }).catch(() => {});
      return NextResponse.json({
        ok: true,
        url: add.photo.url,
        photoStatus: "pending",
        message: "Photo uploaded — awaiting moderation.",
      });
    }

    // kind === "verification"
    const saved = await saveDataUrlPhoto(userId, dataUrl, "verification");
    const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
    if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

    await prisma.profiles.update({
      where: { user_id: userId },
      data: { photo_verification_url: saved.url, updated_at: new Date() },
    });
    await logModeration({ userId, action: "photo_verification_uploaded", note: saved.url });

    return NextResponse.json({
      ok: true,
      url: saved.url,
      photoStatus: profile.photo_status,
      message: "Verification photo uploaded.",
    });
  } catch (err) {
    console.error("photo upload", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 }
    );
  }
}
