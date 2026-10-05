import { NextResponse } from "next/server";
import { buildPushAvatar, readPushAvatarToken } from "@/lib/push/avatar";

export const dynamic = "force-dynamic";

/**
 * Picture shown in a push notification: the sender's blurred photo with the PN badge. Fetched by
 * the phone's notification system, so there is no session — the signed, short-lived token in the
 * path is the only way in.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actorUserId = readPushAvatarToken(token);
  if (!actorUserId) return new NextResponse(null, { status: 404 });

  let reason = "no approved photo";
  const png = await buildPushAvatar(actorUserId).catch((err) => {
    reason = err instanceof Error ? err.message : String(err);
    console.error("[push] avatar build failed", err);
    return null;
  });
  if (!png) {
    // Fall back to the plain PN icon; the header says why, for debugging.
    const res = NextResponse.redirect(new URL("/icons/pn-icon-192.png", _req.url), 302);
    res.headers.set("X-Avatar-Fallback", reason.replace(/[^\x20-\x7e]/g, " ").slice(0, 300));
    return res;
  }

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
