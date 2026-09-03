import { getWaliSession } from "@/lib/wali";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { ProfilePreview } from "@/components/profile/profile-preview";
import { WaliHeader } from "@/components/wali/wali-header";

export const dynamic = "force-dynamic";

export default async function WaliOwnProfilePage() {
  const session = await getWaliSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">This wali access link is invalid or has been revoked.</p>
      </div>
    );
  }

  const profileUserId = BigInt(session.profileUserId);
  const [user, profile] = await Promise.all([
    prisma.users.findUnique({ where: { id: profileUserId } }),
    prisma.profiles.findUnique({ where: { user_id: profileUserId } }),
  ]);
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">Profile not found.</p>
      </div>
    );
  }

  const view = mapProfileView(profile, user);

  return (
    <div className="bg-[#faf8f7] text-ink-900">
      <WaliHeader watchingName={view.fullName} />
      <ProfilePreview
        profile={view}
        showEditTab={false}
        closeHref="/wali"
        hideNav
        backHref="/wali"
        backLabel="Back to wali dashboard"
      />
    </div>
  );
}
