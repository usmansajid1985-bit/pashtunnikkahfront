import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushAvatarPath } from "@/lib/push/avatar";

export const dynamic = "force-dynamic";

/**
 * Picture for an in-app banner: the sender's BLURRED photo with the PN badge — the same image
 * their push notification uses. Signed-in members only; 404 (banner shows the PN logo) when the
 * sender has no approved photo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await params;
  if (!/^\d{1,20}$/.test(userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await prisma.profiles.findUnique({
    where: { user_id: BigInt(userId) },
    select: { photo_blur_url: true, photo_status: true },
  });
  const path = profile?.photo_blur_url && profile.photo_status === "approved" ? pushAvatarPath(BigInt(userId)) : null;
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = NextResponse.redirect(new URL(path, _req.url), 302);
  res.headers.set("Cache-Control", "private, max-age=3600");
  return res;
}
