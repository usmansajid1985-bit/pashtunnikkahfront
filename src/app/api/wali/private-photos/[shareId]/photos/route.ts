import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";
import { getWaliViewerPhotos } from "@/lib/private-photos";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId: rawShareId } = await params;
  try {
    const result = await getWaliViewerPhotos({
      shareId: BigInt(rawShareId),
      waliProfileUserId: BigInt(session.profileUserId),
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load photos" },
      { status: 400 }
    );
  }
}
