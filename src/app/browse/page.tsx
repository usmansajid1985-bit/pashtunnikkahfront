import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BROWSE_PAGE_SIZE,
  buildProfileWhere,
  parseBrowseFilters,
  stripGoldFilters,
  type BrowseSearchParams,
} from "@/lib/browse-filters";
import { locationRadiusIds } from "@/lib/browse-location";
import { blockedUserIds } from "@/lib/blocking";
import { EmailVerificationBanner } from "@/components/settings/email-verification-banner";
import { PaymentGraceBanner } from "@/components/settings/payment-grace-banner";
import { ensureP1Schema } from "@/lib/ensure-p1-schema";
import { getUnreadMessageCount } from "@/lib/dashboard";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { CompletenessBanner, PremiumBanner } from "@/components/browse/banners";
import { BrowseFiltersBar } from "@/components/browse/browse-filters";
import { BrowseInfiniteGrid } from "@/components/browse/browse-infinite-grid";
import { applyGoldCompatToBrowseItems } from "@/lib/browse-gold-compat";
import { loadCompatibilityCache } from "@/lib/compatibility-cache";
import type { Prisma } from "@/generated/prisma/client";
import { getBrowseFilterOptions } from "@/lib/browse-filter-options";
import {
  BROWSE_PROFILE_SELECT,
  rankBrowseProfiles,
  recordBrowseImpressions,
  softSortGoldCompat,
} from "@/lib/browse-rank";

export const dynamic = "force-dynamic";

function profileCompleteness(p: {
  about_me: string | null;
  height: string | null;
  city: string | null;
  occupation: string | null;
  education: string | null;
  tribe: string | null;
  religious_practice: string | null;
  appearance: string | null;
  ancestral_village: string | null;
  phone: string | null;
} | null): number {
  if (!p) return 11;
  const checks = [
    p.about_me,
    p.height,
    p.city,
    p.occupation,
    p.education,
    p.tribe,
    p.religious_practice,
    p.appearance,
    p.ancestral_village,
    p.phone,
  ];
  const filled = checks.filter((x) => x && String(x).trim()).length;
  return Math.max(11, Math.round((filled / checks.length) * 100));
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  await ensureP1Schema();

  const sp = await searchParams;
  const rawFilters = { ...parseBrowseFilters(sp), page: 1 };
  const userId = BigInt(session.userId);

  const [me, meUser, unreadCount, savedFavourites] = await Promise.all([
    prisma.profiles.findUnique({
      where: { user_id: userId },
      select: {
        gender: true,
        about_me: true,
        height: true,
        city: true,
        country: true,
        age: true,
        marital_status: true,
        occupation: true,
        education: true,
        tribe: true,
        religious_practice: true,
        religious_methodology: true,
        dialect: true,
        willing_to_relocate: true,
        appearance: true,
        ancestral_village: true,
        phone: true,
        location_lat: true,
        location_lng: true,
        location_city: true,
        location_radius_miles: true,
        location_country_only: true,
        location_country: true,
        location_country_code: true,
      },
    }),
    prisma.users.findUnique({
      where: { id: userId },
      select: { plan: true, email_verified: true, subscription_status: true },
    }),
    getUnreadMessageCount(userId),
    prisma.favourites.findMany({ where: { user_id: userId }, select: { profile_user_id: true } }),
  ]);
  const initialSavedUserIds = savedFavourites.map((f) => f.profile_user_id.toString());
  const isGold = (meUser?.plan ?? "").toLowerCase() === "gold";
  // Gold-only filters never apply for a Basic viewer — drop them here so the query, the
  // active-filter count and the grid key all reflect what actually gets used (PN-BROWSE-002).
  const filters = isGold ? rawFilters : stripGoldFilters(rawFilters);

  let paymentGraceUntil: string | null = null;
  if (meUser?.subscription_status === "past_due") {
    const graceRows = await prisma.$queryRaw<{ payment_grace_until: Date | null }[]>`
      SELECT payment_grace_until FROM users WHERE id = ${userId} LIMIT 1
    `.catch(() => [] as { payment_grace_until: Date | null }[]);
    const grace = graceRows[0]?.payment_grace_until;
    if (grace && grace.getTime() > Date.now()) {
      paymentGraceUntil = grace.toISOString();
    }
  }

  const blockedIds = await blockedUserIds(userId);

  const locationIds =
    filters.near && me?.location_lat != null && me?.location_lng != null
      ? await locationRadiusIds({
          lat: me.location_lat,
          lng: me.location_lng,
          radiusMiles: me.location_radius_miles ?? 50,
          countryOnly: me.location_country_only ?? false,
          country: me.location_country,
        })
      : undefined;

  const where = buildProfileWhere(filters, {
    excludeUserId: userId,
    excludeUserIds: blockedIds,
    viewerGender: me?.gender,
    isGold,
    locationIds,
  });

  const useActivityRank = filters.sort === "newest" || filters.sort === "recently_active";
  const orderBy: Prisma.profilesOrderByWithRelationInput =
    filters.sort === "age_asc"
      ? { age: "asc" }
      : filters.sort === "age_desc"
        ? { age: "desc" }
        : { users: { last_seen_at: "desc" } };

  const [
    total,
    profiles,
    filterOptions,
  ] = await Promise.all([
    prisma.profiles.count({ where }),
    prisma.profiles.findMany({
      where,
      orderBy,
      take: useActivityRank ? BROWSE_PAGE_SIZE * 2 : BROWSE_PAGE_SIZE,
      select: BROWSE_PROFILE_SELECT,
    }),
    getBrowseFilterOptions(),
  ]);

  // Ranking and the Gold compatibility-cache read don't depend on each other —
  // the cache is keyed by peer user id, which we already have. Run them together.
  const [ranked, compatCache] = await Promise.all([
    rankBrowseProfiles(userId, profiles),
    isGold && me
      ? loadCompatibilityCache(
          userId,
          profiles.map((p) => p.user_id)
        )
      : Promise.resolve(undefined),
  ]);

  let initialItems = ranked;
  if (filters.sort === "age_asc" || filters.sort === "age_desc") {
    initialItems = [...initialItems].sort((a, b) => {
      const aa = a.age ?? 0;
      const bb = b.age ?? 0;
      return filters.sort === "age_asc" ? aa - bb : bb - aa;
    });
  }

  if (isGold && me) {
    initialItems = await applyGoldCompatToBrowseItems(userId, me, initialItems, profiles, compatCache);
    if (useActivityRank) initialItems = softSortGoldCompat(initialItems);
  }

  initialItems = initialItems.slice(0, BROWSE_PAGE_SIZE);
  void recordBrowseImpressions(
    userId,
    initialItems.map((p) => BigInt(p.userId))
  );

  const completeness = profileCompleteness(me);

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900 lg:pl-60">
      <BrowseAppNav profileCode={session.profileCode} active="browse" unreadCount={unreadCount} />

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <PremiumBanner isGold={isGold} />
        <CompletenessBanner percent={completeness} />
        {!meUser?.email_verified ? (
          <div className="mb-4">
            <EmailVerificationBanner emailVerified={false} compact />
          </div>
        ) : null}
        {paymentGraceUntil ? (
          <div className="mb-4">
            <PaymentGraceBanner graceUntil={paymentGraceUntil} compact />
          </div>
        ) : null}

        <BrowseFiltersBar
          filters={filters}
          isGold={isGold}
          savedLocation={{
            city: me?.location_city || me?.city || null,
            country: me?.location_country || me?.country || null,
            countryCode: me?.location_country_code || null,
            radiusMiles: me?.location_radius_miles ?? 50,
            hasPin: me?.location_lat != null && me?.location_lng != null,
          }}
          options={filterOptions}
        />

        <BrowseInfiniteGrid
          key={JSON.stringify({ ...filters, page: 1 })}
          initialItems={initialItems}
          initialHasMore={BROWSE_PAGE_SIZE < total}
          filters={filters}
          initialSavedUserIds={initialSavedUserIds}
        />
      </main>
    </div>
  );
}
