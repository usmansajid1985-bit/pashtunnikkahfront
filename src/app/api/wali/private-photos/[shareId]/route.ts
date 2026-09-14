import { NextResponse } from "next/server";
import { getWaliSession } from "@/lib/wali";
import { waliShareStatus } from "@/lib/private-photos";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const session = await getWaliSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId: rawShareId } = await params;
  const status = await waliShareStatus(BigInt(rawShareId), BigInt(session.profileUserId));
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(status);
}
