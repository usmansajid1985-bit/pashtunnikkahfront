import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listThreadsForUser } from "@/lib/chat";
import { userTopic } from "@/lib/realtime-topics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threads = await listThreadsForUser(BigInt(session.userId));
  return NextResponse.json({
    threads,
    userId: session.userId,
    realtimeUserTopic: userTopic(session.userId),
  });
}
