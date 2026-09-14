import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";
import { waliShareForMatch } from "@/lib/private-photos";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId: raw } = await params;
  const share = await waliShareForMatch(BigInt(raw), BigInt(session.profileUserId));
  return NextResponse.json({ share });
}
