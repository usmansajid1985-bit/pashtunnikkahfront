import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { allowWaliView } from "@/lib/private-photos";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId: rawShareId } = await params;
  const userId = BigInt(session.userId);

  try {
    await allowWaliView({ shareId: BigInt(rawShareId), recipientId: userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not allow wali access" },
      { status: 400 }
    );
  }
}
