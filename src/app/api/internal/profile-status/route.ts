import { NextResponse } from "next/server";
import { broadcastBrowseVisibility, broadcastChat } from "@/lib/chat-broadcast";
import { sendPushNotification } from "@/lib/push/server";
import { readSignedInternal } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { getPlanSettings } from "@/lib/plan-settings";

export const dynamic = "force-dynamic";

/**
 * N08: the admin app calls this right after it changes a member's profile status. Approval sends
 * the push + bell notification (deep link to Overview); every change is broadcast on the member's
 * live channel so an open PN tab updates without logging out and back in.
 */
export async function POST(req: Request) {
  const signed = await readSignedInternal(req);
  if (!signed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, status } = signed;

  if (status === "approved") {
    const member = await prisma.users.findUnique({ where: { id: BigInt(userId) }, select: { plan: true } });
    const { monthlyCredits } = await getPlanSettings(member?.plan);
    await sendPushNotification(BigInt(userId), {
      title: "Your Pashtun Nikah profile has been approved ✅",
      body: `You now have ${monthlyCredits} ${member?.plan?.toLowerCase() === "gold" ? "" : "free "}Match Tokens every month. Start exploring profiles and making connections!`,
      url: "/dashboard",
      tag: `profile-approved-${userId}`,
      type: "profile_status",
    }).catch((err) => console.error("[push] approval notification failed", err));
  }
  broadcastChat("account:status", [`user:${userId}`], { status });
  // Approved profiles appear in Browse; suspended/rejected ones leave it — live for everyone.
  if (status === "approved") broadcastBrowseVisibility(userId, true);
  else if (status === "suspended" || status === "rejected") broadcastBrowseVisibility(userId, false);
  return NextResponse.json({ ok: true });
}
