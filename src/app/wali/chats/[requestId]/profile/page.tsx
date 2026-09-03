import { getWaliSession } from "@/lib/wali";
import { assertAcceptedParticipant, peerUserId } from "@/lib/chat";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { ProfilePreview } from "@/components/profile/profile-preview";
import { WaliHeader } from "@/components/wali/wali-header";

export const dynamic = "force-dynamic";

export default async function WaliPeerProfilePage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await getWaliSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">This wali access link is invalid or has been revoked.</p>
      </div>
    );
  }

  const { requestId: raw } = await params;
  const profileUserId = BigInt(session.profileUserId);
  const req = await assertAcceptedParticipant(BigInt(raw), profileUserId);
  if (!req) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">Chat not found.</p>
      </div>
    );
  }

  const peerId = await peerUserId(req, profileUserId);
  const [user, profile] = await Promise.all([
    prisma.users.findUnique({ where: { id: peerId } }),
    prisma.profiles.findUnique({ where: { user_id: peerId } }),
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
        closeHref={`/wali/chats/${raw}`}
        hideNav
        backHref={`/wali/chats/${raw}`}
        backLabel="Back to chat"
      />
    </div>
  );
}
