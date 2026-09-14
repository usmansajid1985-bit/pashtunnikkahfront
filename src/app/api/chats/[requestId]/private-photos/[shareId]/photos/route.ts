import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getViewerPhotos } from "@/lib/private-photos";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string; shareId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw, shareId: rawShareId } = await params;
  const userId = BigInt(session.userId);

  try {
    const result = await getViewerPhotos({
      shareId: BigInt(rawShareId),
      recipientId: userId,
      requestId: BigInt(raw),
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load photos" },
      { status: 400 }
    );
  }
}
