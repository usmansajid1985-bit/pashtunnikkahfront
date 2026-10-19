import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadRequestsHub } from "@/lib/requests-hub";

export const dynamic = "force-dynamic";

/** Pending requests for the Requests tab inside Chats: received (to answer) and sent (pending). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hub = await loadRequestsHub(BigInt(session.userId));
  return NextResponse.json(
    {
      received: hub.incoming,
      sent: hub.sent.filter((c) => (c.status || "pending") === "pending"),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
