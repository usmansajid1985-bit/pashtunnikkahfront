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
import { buildCompatBreakdown, compatFingerprint, compatSideFromProfile } from "@/lib/compat-engine";
import { cachedCompatSummary, generateCompatSummary } from "@/lib/compat-summary";
import type { ViewerCompat } from "@/components/profile/compatibility-panel";
import { readHideGoldBadge } from "@/lib/ensure-p2-schema";
import { formatLastSeen, isActiveToday, isJustJoined } from "@/lib/presence";
import { isBlockedBetween } from "@/lib/blocking";
import { fullProfilePhotoVisibility, applyPhotoVisibility } from "@/lib/photo-access";
import { signedPhotoUrl } from "@/lib/photos";
import { PrivatePhotoShare } from "@/components/chat/private-photo-share";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";

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

  await ensureBrowseAndWaliSchema();
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
          // B26: the viewer's own preferences are checked against the other member too.
          profile_code: true,
          gender: true,
          has_children: true,
          wants_children: true,
          age_pref_from: true,
          age_pref_to: true,
          accept_widow: true,
          consider_divorcee: true,
          open_to: true,
          relocate: true,
          salah_pattern: true,
          education_pref: true,
        },
      }),
      readHideGoldBadge(profile.user_id),
      getCachedCompatDetail(viewerId, profile.user_id),
    ]);
  const matchStatus = relationStatus(relation, viewerId);

  const isGold = (viewerUser?.plan ?? "").toLowerCase() === "gold";
  let viewerCompat: ViewerCompat | null = null;

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
    // B10/B26/B27/B28: the written two-way breakdown is rule-based, instant and identical on every
    // open — Gold sees it as soon as the profile opens, before any Match Request.
    const meSide = compatSideFromProfile(viewerProfile, "you");
    const themSide = compatSideFromProfile(profile, profile.profile_code ?? "This member");
    const breakdown = buildCompatBreakdown(meSide, themSide);
    const fingerprint = compatFingerprint(meSide, themSide);
    const summary = await cachedCompatSummary(viewerId, profile.user_id, fingerprint);
    viewerCompat = { breakdown, summary };
    after(async () => {
      try {
        // The short AI note is generated once per pair + profile data, off the request path.
        if (!summary) {
          await generateCompatSummary({
            viewerId,
            candidateUserId: profile.user_id,
            fingerprint,
            peerCode: themSide.code,
            breakdown,
          });
        }
        // Internal score only (Browse ordering); never shown as a percentage.
        if (!cachedCompat?.aiComputed) await computeCompatibilityOnce(viewerId, meCompat, peer);
      } catch {
        // best-effort — the breakdown above never depends on this
      }
    });
  }

  void prisma.profile_views
    .findFirst({
      where: { viewer_id: viewerId, viewed_id: profile.user_id },
      orderBy: { viewed_at: "desc" },
    })
    .then(async (existingView) => {
      const recentlyViewed =
        existingView && Date.now() - existingView.viewed_at.getTime() < 6 * 60 * 60 * 1000;
      if (existingView) {
        await prisma.profile_views.update({
          where: { id: existingView.id },
          data: { viewed_at: new Date() },
        });
      } else {
        const max = await prisma.profile_views.aggregate({ _max: { id: true } });
        await prisma.profile_views.create({
          data: {
            id: (max._max.id ?? BigInt(0)) + BigInt(1),
            viewer_id: viewerId,
            viewed_id: profile.user_id,
            viewed_at: new Date(),
          },
        });
      }

      // Notify the viewed member (spec §4). Repeat views within the same day fold into one
      // row; a re-view within 6h doesn't re-notify at all.
      if (!recentlyViewed) {
        const { createNotification } = await import("@/lib/notifications");
        const day = new Date().toISOString().slice(0, 10);
        const viewerCode = session.profileCode || "A member";
        await createNotification({
          recipientUserId: profile.user_id,
          type: "profile_view",
          title: `${viewerCode} viewed your profile`,
          body: "",
          url: `/p/${session.profileCode ?? ""}`,
          actorUserId: viewerId,
          groupKey: `profile_view:${viewerId}:${day}`,
          groupedTitle: () => `${viewerCode} viewed your profile`,
          groupedBody: (n) => `Viewed ${n} times today`,
        }).catch(() => undefined);
      }
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
  // Visible → short-lived signed original. Otherwise (PH01) show the server-side BLURRED
  // derivative, so the member sees a blurred photo and the real image never reaches the browser.
  const blurredUrl = view.photoBlurUrl ? await signedPhotoUrl(view.photoBlurUrl) : null;
  view.photoUrl = photo.photoUrl ? await signedPhotoUrl(photo.photoUrl) : blurredUrl;
  view.photoBlurUrl = blurredUrl;

  const lastSeenAt = profile.users.last_seen_at;
  const presence = {
    online: isActiveToday(lastSeenAt),
    label: formatLastSeen(lastSeenAt),
    justJoined: isJustJoined(profile.users.approved_at ?? profile.created_at),
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
      photoAccessory={
        matchStatus.state === "accepted" ? (
          <PrivatePhotoShare
            requestId={matchStatus.requestId}
            matchEnded={false}
            peerName={profile.profile_code || "this member"}
            variant="banner"
          />
        ) : null
      }
    />
  );
}
