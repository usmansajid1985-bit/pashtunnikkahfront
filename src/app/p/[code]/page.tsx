import { after } from "next/server";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { findRelation, relationStatus } from "@/lib/matches";
import { ProfilePreview } from "@/components/profile/profile-preview";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { recordBrowseOpened } from "@/lib/browse-rank";
import { computeCompatibilityOnce, getCachedCompatDetail, toCompatProfile } from "@/lib/compatibility-cache";
import { compatScore } from "@/lib/requests-hub-shared";
import { readHideGoldBadge } from "@/lib/ensure-p2-schema";
import { isOnline, formatLastSeen } from "@/lib/presence";
import { isBlockedBetween } from "@/lib/blocking";
import { fullProfilePhotoVisibility, applyPhotoVisibility } from "@/lib/photo-access";
import { signedPhotoUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { code } = await params;
  const { from } = await searchParams;
  // Restore the exact filtered Browse the user came from (PN-BROWSE-003).
  const browseHref = from && from.startsWith("?") ? `/browse${from}` : "/browse";
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

  // Mutual blocking: a blocked pair can't open each other's profile at all.
  if (await isBlockedBetween(viewerId, profile.user_id)) notFound();
  const [relation, unreadCount, viewerUser, viewerProfile, hideGoldBadge, cachedCompat] =
    await Promise.all([
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
      readHideGoldBadge(profile.user_id),
      getCachedCompatDetail(viewerId, profile.user_id),
    ]);
  const matchStatus = relationStatus(relation, viewerId);

  const isGold = (viewerUser?.plan ?? "").toLowerCase() === "gold";
  let viewerCompat: { score: number; reasons: string[] } | null = null;

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
    const meCompat = toCompatProfile(viewerProfile);
    if (cachedCompat?.aiComputed) {
      viewerCompat = { score: cachedCompat.score, reasons: cachedCompat.reasons };
    } else {
      // Never block the profile from opening on a live Gemini call — show the
      // heuristic score now, compute + cache the AI score after the response.
      viewerCompat = {
        score: cachedCompat?.score ?? compatScore(meCompat, peer),
        reasons: cachedCompat?.reasons ?? [],
      };
      after(async () => {
        try {
          await computeCompatibilityOnce(viewerId, meCompat, peer);
        } catch {
          // best-effort cache warming
        }
      });
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

  // Photo privacy: an unmatched viewer must not receive the photo URL at all; a matched viewer
  // sees it per the per-match photo-share rules (PN privacy defect — confirmed).
  const photoVis = await fullProfilePhotoVisibility(viewerId, profile.user_id);
  const photo = applyPhotoVisibility(view.photoUrl, photoVis);
  // When the photo is shown to a matched viewer, hand out a short-lived signed URL rather than
  // the permanent public one.
  view.photoUrl = photo.photoUrl ? await signedPhotoUrl(photo.photoUrl) : null;

  const lastSeenAt = profile.users.last_seen_at;
  const presence = {
    online: isOnline(lastSeenAt),
    label: formatLastSeen(lastSeenAt),
  };

  return (
    <ProfilePreview
      profile={view}
      showEditTab={false}
      matchStatus={matchStatus}
      navProfileCode={session.profileCode}
      closeHref={browseHref}
      backHref={browseHref}
      backLabel="Back to browse"
      unreadCount={unreadCount}
      viewerCompat={viewerCompat}
      presence={presence}
      photoVisible={photo.photoVisible}
    />
  );
}
