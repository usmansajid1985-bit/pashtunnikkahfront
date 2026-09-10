import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { listProfilePhotos } from "@/lib/profile-photos";

export const dynamic = "force-dynamic";

export default async function ProfileEditPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = BigInt(session.userId);
  const [user, profile, unreadCount, photos] = await Promise.all([
    prisma.users.findUnique({ where: { id: userId } }),
    prisma.profiles.findUnique({ where: { user_id: userId } }),
    getUnreadMessageCount(userId),
    listProfilePhotos(userId),
  ]);
  if (!user || !profile) redirect("/signup");

  const view = mapProfileView(profile, user);
  return <ProfileEditForm initial={view} unreadCount={unreadCount} photos={photos} />;
}
