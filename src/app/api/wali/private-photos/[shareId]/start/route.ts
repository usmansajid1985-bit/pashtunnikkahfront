import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";
import { waliStartViewing, VIEW_DURATION_SEC } from "@/lib/private-photos";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId: rawShareId } = await params;
  try {
    const share = await waliStartViewing(BigInt(rawShareId), BigInt(session.profileUserId));
    return NextResponse.json({
      ok: true,
      expiresAt: share.wali_expires_at?.toISOString() ?? null,
      durationSec: VIEW_DURATION_SEC,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start viewing" },
      { status: 400 }
    );
  }
}
