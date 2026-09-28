import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requestOrigin } from "@/lib/site-url";
import { createWaliSessionToken, waliCookieOptions, WALI_COOKIE } from "@/lib/wali";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const origin = (await requestOrigin()) || new URL(req.url).origin;

  const link = await prisma.wali_links.findUnique({ where: { token } });
  if (!link || link.revoked_at) {
    return NextResponse.redirect(`${origin}/wali?error=invalid`);
  }

  await prisma.wali_links.update({
    where: { id: link.id },
    data: { last_accessed_at: new Date(), ...(link.accepted_at ? {} : { accepted_at: new Date() }) },
  });
  // W09: first time the wali opens their link = invitation accepted.
  if (!link.accepted_at) {
    const { logWaliActivity } = await import("@/lib/wali-activity");
    await logWaliActivity({
      userId: link.user_id,
      linkId: link.id,
      event: "accepted",
      detail: `${link.name} accepted the invitation and opened the wali portal`,
    });
  }

  const sessionToken = await createWaliSessionToken({
    linkId: link.id.toString(),
    profileUserId: link.user_id.toString(),
    profileId: link.profile_id.toString(),
    name: link.name,
  });

  const res = NextResponse.redirect(`${origin}/wali`);
  res.cookies.set(WALI_COOKIE, sessionToken, waliCookieOptions());
  return res;
}
