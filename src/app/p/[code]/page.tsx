import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { findRelation, relationStatus } from "@/lib/matches";
import { ProfilePreview } from "@/components/profile/profile-preview";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { recordBrowseOpened } from "@/lib/browse-rank";
import { computeCompatibilityOnce, getCachedCompatDetail, toCompatProfile } from "@/lib/compatibility-cache";
import { readHideGoldBadge } from "@/lib/ensure-p2-schema";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { code } = await params;
  const profile = await prisma.profiles.findFirst({
    where: {
      profile_code: { equals: code, mode: "insensitive" },
      status: "approved",
      is_hidden: false,
    },
    include: { users: true },
  });
  if (!profile?.users) notFound();

  const isOwn = profile.user_id.toString() === session.userId;
  if (isOwn) redirect("/profile");

  const viewerId = BigInt(session.userId);
  const [relation, unreadCount, viewerUser, viewerProfile] = await Promise.all([
    findRelation(viewerId, profile.user_id),
    getUnreadMessageCount(viewerId),
    prisma.users.findUnique({ where: { id: viewerId }, select: { plan: true } }),
    prisma.profiles.findUnique({
      where: { user_id: viewerId },
      select: {
        country: true,
        city: true,
        age: true,
        marital_status: true,
        religious_practice: true,
        religious_methodology: true,
        tribe: true,
        education: true,
        dialect: true,
        ancestral_village: true,
        willing_to_relocate: true,
      },
    }),
  ]);
  const matchStatus = relationStatus(relation, viewerId);

  const isGold = (viewerUser?.plan ?? "").toLowerCase() === "gold";
  let viewerCompat: { score: number; reasons: string[] } | null = null;

  const [hideGoldBadge] = await Promise.all([
    readHideGoldBadge(profile.user_id),
  ]);

  if (isGold && viewerProfile) {
    const peer = {
      id: profile.id.toString(),
      userId: profile.user_id.toString(),
      country: profile.country,
      city: profile.city,
      marital_status: profile.marital_status,
      religious_practice: profile.religious_practice,
      ancestral_village: profile.ancestral_village,
      age: profile.age,
      tribe: profile.tribe,
      education: profile.education,
      religious_methodology: profile.religious_methodology,
      dialect: profile.dialect,
      willing_to_relocate: profile.willing_to_relocate,
      about_me: profile.about_me,
      occupation: profile.occupation,
    };
    const cached = await getCachedCompatDetail(viewerId, profile.user_id);
    if (cached?.aiComputed) {
      viewerCompat = { score: cached.score, reasons: cached.reasons };
    } else {
      const result = await computeCompatibilityOnce(viewerId, toCompatProfile(viewerProfile), peer);
      viewerCompat = { score: result.finalScore, reasons: result.reasons };
    }
  }

  void prisma.profile_views
    .findFirst({
      where: { viewer_id: viewerId, viewed_id: profile.user_id },
      orderBy: { viewed_at: "desc" },
    })
    .then(async (existingView) => {
      if (existingView) {
        await prisma.profile_views.update({
          where: { id: existingView.id },
          data: { viewed_at: new Date() },
        });
        return;
      }
      const max = await prisma.profile_views.aggregate({ _max: { id: true } });
      await prisma.profile_views.create({
        data: {
          id: (max._max.id ?? BigInt(0)) + BigInt(1),
          viewer_id: viewerId,
          viewed_id: profile.user_id,
          viewed_at: new Date(),
        },
      });
    })
    .catch(() => {});

  void recordBrowseOpened(viewerId, profile.user_id);

  const view = mapProfileView(profile, {
    ...profile.users,
    hide_gold_badge: hideGoldBadge,
  });

  return (
    <ProfilePreview
      profile={view}
      showEditTab={false}
      matchStatus={matchStatus}
      navProfileCode={session.profileCode}
      closeHref="/browse"
      unreadCount={unreadCount}
      viewerCompat={viewerCompat}
    />
  );
}
