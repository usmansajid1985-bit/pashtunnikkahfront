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

  const png = await buildPushAvatar(actorUserId).catch(() => null);
  if (!png) return NextResponse.redirect(new URL("/icons/pn-icon-192.png", _req.url), 302);

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
  });
}
