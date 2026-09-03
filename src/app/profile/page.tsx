import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { ProfilePreview } from "@/components/profile/profile-preview";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { readHideGoldBadge } from "@/lib/ensure-p2-schema";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, profile, unreadCount, hideGoldBadge] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    getUnreadMessageCount(userId),
    readHideGoldBadge(userId),
  ]);
  if (!user || !profile) redirect("/signup");

  const view = mapProfileView(profile, { ...user, hide_gold_badge: hideGoldBadge });

  return <ProfilePreview profile={view} showEditTab closeHref="/settings" unreadCount={unreadCount} />;
}
