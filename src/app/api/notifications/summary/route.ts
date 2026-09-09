import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNavCounts } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

/** Lightweight poll target for the nav bell + badges (spec §2: "update in real time"). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const counts = await getNavCounts(BigInt(session.userId));
  return NextResponse.json(counts);
}
