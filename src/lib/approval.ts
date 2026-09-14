import { prisma } from "@/lib/prisma";

/**
 * Central "is this actor allowed to perform a protected action right now" gate (QA PN-BACKEND-002 /
 * PN-REG-004: a profile moved back to Awaiting Approval could still send messages / create match
 * requests / spend credits — there was no server-side approval check anywhere). Read access
 * (viewing an existing chat, wali contact info already shared) is deliberately left alone; this
 * only gates actions that create or mutate a relationship (messages, requests, accept/decline,
 * wali actions, photo shares) — matching the QA report's "at minimum" scope.
 */
export async function isProfileApproved(userId: bigint): Promise<boolean> {
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: { status: true },
  });
  return profile?.status === "approved";
}
