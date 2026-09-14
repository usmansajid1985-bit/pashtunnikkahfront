import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";
import { getWaliViewerPhotos, loadSharePhotoSource, watermarkLabelForViewer } from "@/lib/private-photos";
import { fetchPhotoBytes } from "@/lib/photos";
import { watermarkImageBuffer } from "@/lib/photo-watermark";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareId: string; index: string }> }
) {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId: rawShareId, index: rawIndex } = await params;
  const waliProfileUserId = BigInt(session.profileUserId);
  const shareId = BigInt(rawShareId);
  const index = Number(rawIndex);

  try {
    await getWaliViewerPhotos({ shareId, waliProfileUserId });

    const source = await loadSharePhotoSource(shareId, index);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const bytes = await fetchPhotoBytes(source.photo.url);
    if (!bytes) return NextResponse.json({ error: "Photo unavailable" }, { status: 404 });

    // The wali always sees the wali-labelled watermark — pass a viewer id that will never equal
    // the share's recipient so watermarkLabelForViewer falls through to the "Wali ·" branch.
    const label = await watermarkLabelForViewer(source.share, BigInt(-1));
    const watermarked = await watermarkImageBuffer(bytes, label);

    return new NextResponse(new Uint8Array(watermarked), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load photo" },
      { status: 400 }
    );
  }
}
