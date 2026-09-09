import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BROWSE_PAGE_SIZE,
  buildProfileWhere,
  parseBrowseFilters,
  stripGoldFilters,
} from "@/lib/browse-filters";
import { locationRadiusIds } from "@/lib/browse-location";
import {
  BROWSE_PROFILE_SELECT,
  rankBrowseProfiles,
  recordBrowseImpressions,
  softSortGoldCompat,
} from "@/lib/browse-rank";
import { applyGoldCompatToBrowseItems } from "@/lib/browse-gold-compat";
import { blockedUserIds } from "@/lib/blocking";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawFilters = parseBrowseFilters(Object.fromEntries(url.searchParams.entries()));
  const userId = BigInt(session.userId);

  const [me, meUser] = await Promise.all([
    prisma.profiles.findUnique({
      where: { user_id: userId },
      select: {
        gender: true,
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
        location_lat: true,
        location_lng: true,
        location_radius_miles: true,
        location_country_only: true,
        location_country: true,
      },
    }),
    prisma.users.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);
  const isGold = (meUser?.plan ?? "").toLowerCase() === "gold";
  const filters = isGold ? rawFilters : stripGoldFilters(rawFilters);

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
  const orderBy =
    filters.sort === "age_asc"
      ? ({ age: "asc" } as const)
      : filters.sort === "age_desc"
        ? ({ age: "desc" } as const)
        : ({ users: { last_seen_at: "desc" } } as const);

  const overFetch = useActivityRank
    ? filters.page * BROWSE_PAGE_SIZE + BROWSE_PAGE_SIZE
    : BROWSE_PAGE_SIZE;
  const skip = useActivityRank ? 0 : (filters.page - 1) * BROWSE_PAGE_SIZE;

  const [total, profiles] = await Promise.all([
    prisma.profiles.count({ where }),
    prisma.profiles.findMany({
      where,
      orderBy,
      skip,
      take: overFetch,
      select: BROWSE_PROFILE_SELECT,
    }),
  ]);

  let items = await rankBrowseProfiles(userId, profiles);

  if (filters.sort === "age_asc" || filters.sort === "age_desc") {
    // Keep age primary; fair-exposure rank already applied as soft secondary via sortKey within ages roughly.
    items = items.sort((a, b) => {
      const aa = a.age ?? 0;
      const bb = b.age ?? 0;
      return filters.sort === "age_asc" ? aa - bb : bb - aa;
    });
  }

  // Gold: cached one-time AI compat + heuristic fallback (never touches activity order).
  if (isGold && me) {
    items = await applyGoldCompatToBrowseItems(userId, me, items, profiles);
    if (useActivityRank) items = softSortGoldCompat(items);
  }

  const start = (filters.page - 1) * BROWSE_PAGE_SIZE;
  const pageItems = useActivityRank
    ? items.slice(start, start + BROWSE_PAGE_SIZE)
    : items.slice(0, BROWSE_PAGE_SIZE);

  void recordBrowseImpressions(
    userId,
    pageItems.map((p) => BigInt(p.userId))
  );

  const hasMore = filters.page * BROWSE_PAGE_SIZE < total;

  return NextResponse.json({
    items: pageItems,
    page: filters.page,
    total,
    hasMore,
  });
}
