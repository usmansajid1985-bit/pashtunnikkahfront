import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getViewerPhotos, loadSharePhotoSource, watermarkLabelForViewer } from "@/lib/private-photos";
import { fetchPhotoBytes } from "@/lib/photos";
import { watermarkImageBuffer } from "@/lib/photo-watermark";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string; shareId: string; index: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw, shareId: rawShareId, index: rawIndex } = await params;
  const userId = BigInt(session.userId);
  const shareId = BigInt(rawShareId);
  const index = Number(rawIndex);

  try {
    // Re-runs the full session/match/block authorisation check on every image fetch (spec §24) —
    // a signed URL that outlives the session is exactly the leak this route exists to avoid.
    await getViewerPhotos({ shareId, recipientId: userId, requestId: BigInt(raw) });

    const source = await loadSharePhotoSource(shareId, index);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const bytes = await fetchPhotoBytes(source.photo.url);
    if (!bytes) return NextResponse.json({ error: "Photo unavailable" }, { status: 404 });

    const label = await watermarkLabelForViewer(source.share, userId);
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
