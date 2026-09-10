import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logModeration } from "@/lib/moderation";
import {
  addProfilePhoto,
  deleteProfilePhoto,
  listProfilePhotos,
  setMainProfilePhoto,
} from "@/lib/profile-photos";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const photos = await listProfilePhotos(BigInt(session.userId));
  return NextResponse.json({ photos });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dataUrl = String(body.photoDataUrl || "");
  const userId = BigInt(session.userId);

  const result = await addProfilePhoto(userId, dataUrl);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await logModeration({ userId, action: "photo_uploaded", note: result.photo.url }).catch(() => {});
  return NextResponse.json({
    ok: true,
    photo: result.photo,
    photos: await listProfilePhotos(userId),
    message: "Photo uploaded — awaiting moderation.",
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId = String(body.photoId || "");
  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  const userId = BigInt(session.userId);
  await setMainProfilePhoto(userId, BigInt(photoId));
  return NextResponse.json({ ok: true, photos: await listProfilePhotos(userId) });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId = String(body.photoId || "");
  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  const userId = BigInt(session.userId);
  await deleteProfilePhoto(userId, BigInt(photoId));
  return NextResponse.json({ ok: true, photos: await listProfilePhotos(userId) });
}
