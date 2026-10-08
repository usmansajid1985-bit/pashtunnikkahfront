import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BROWSE_PAGE_SIZE,
  buildProfileWhere,
  parseBrowseFilters,
  stripGoldFilters,
} from "@/lib/browse-filters";
import { savedLocationFilter } from "@/lib/browse-location";
import {
  BEST_MATCH_POOL,
  BROWSE_PROFILE_SELECT,
  hardSortByCompat,
  rankBrowseProfiles,
  recordBrowseImpressions,
  softSortGoldCompat,
} from "@/lib/browse-rank";
import { applyGoldCompatToBrowseItems } from "@/lib/browse-gold-compat";
import { blockedUserIds } from "@/lib/blocking";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";
import { expansionStages, firstExpansionStage } from "@/lib/browse-expansion";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureBrowseAndWaliSchema();

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
        location_country_code: true,
      },
    }),
    prisma.users.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);
  const isGold = (meUser?.plan ?? "").toLowerCase() === "gold";
  const filters = isGold ? rawFilters : stripGoldFilters(rawFilters);

  const blockedIds = await blockedUserIds(userId);

  // Distance search requires a saved pin AND a saved radius. Missing either → return nothing
  // with a `needsLocation` flag rather than silently falling through to an unfiltered grid
  // (PN-BROWSE-006).
  const wantsDistance = filters.near;
  const { ids: radiusIds, needsLocation } = await savedLocationFilter(me, wantsDistance);

  const whereFor = (f: typeof filters, useDistance: boolean) =>
    buildProfileWhere(f, {
      excludeUserId: userId,
      excludeUserIds: blockedIds,
      viewerGender: me?.gender,
      isGold,
      locationIds: useDistance ? radiusIds : undefined,
    });

  const where = whereFor(filters, wantsDistance);

  // S03/S04: a member just returned to Browse — does their card belong in THIS viewer's results?
  // One row, no impressions recorded, so the check never affects Browse memory/rotation.
  const peekUser = url.searchParams.get("peekUser");
  if (peekUser && /^\d+$/.test(peekUser)) {
    const rows = await prisma.profiles.findMany({
      where: { AND: [where, { user_id: BigInt(peekUser) }] },
      take: 1,
      select: BROWSE_PROFILE_SELECT,
    });
    if (rows.length === 0) return NextResponse.json({ item: null });
    let peeked = await rankBrowseProfiles(userId, rows);
    if (isGold && me) peeked = await applyGoldCompatToBrowseItems(userId, me, peeked, rows);
    return NextResponse.json({ item: peeked[0] ?? null });
  }

  // B20: cheap "who became active since I loaded Browse?" check — ids only, no ranking.
  const freshSince = Number(url.searchParams.get("freshSince") || 0);
  if (freshSince > 0) {
    const fresh = await prisma.profiles.findMany({
      where: { AND: [where, { users: { last_seen_at: { gt: new Date(freshSince) } } }] },
      select: { user_id: true },
      take: 50,
    });
    return NextResponse.json({ userIds: fresh.map((f) => f.user_id.toString()) });
  }

  // B12/B21/B22 — expanded discovery once the member's own filters are exhausted.
  const stageParam = Number(url.searchParams.get("x") || 0);
  if (stageParam > 0) {
    const stages = expansionStages(filters);
    const stage = stages[stageParam - 1];
    if (!stage) return NextResponse.json({ items: [], page: filters.page, total: 0, hasMore: false, nextStage: null });
    const prev = stageParam === 1 ? { filters, useDistance: wantsDistance } : stages[stageParam - 2];
    const stageWhere = {
      AND: [whereFor(stage.filters, stage.useDistance), { NOT: whereFor(prev.filters, prev.useDistance) }],
    };
    const take = filters.page * BROWSE_PAGE_SIZE + BROWSE_PAGE_SIZE;
    const [stageTotal, rows] = await Promise.all([
      prisma.profiles.count({ where: stageWhere }),
      prisma.profiles.findMany({
        where: stageWhere,
        orderBy: { users: { last_seen_at: "desc" } },
        take,
        select: BROWSE_PROFILE_SELECT,
      }),
    ]);
    const ranked = await rankBrowseProfiles(userId, rows);
    const startAt = (filters.page - 1) * BROWSE_PAGE_SIZE;
    const stageItems = ranked
      .slice(startAt, startAt + BROWSE_PAGE_SIZE)
      .map((item) => ({ ...item, expandedLabel: stage.label }));
    const stageHasMore = filters.page * BROWSE_PAGE_SIZE < stageTotal;
    return NextResponse.json({
      items: stageItems,
      page: filters.page,
      total: stageTotal,
      hasMore: stageHasMore,
      stage: stageParam,
      nextStage: stageHasMore ? null : stages[stageParam] ? stageParam + 1 : null,
    });
  }

  const isBestMatch = filters.sort === "best_match";
  const useActivityRank = filters.sort === "newest" || filters.sort === "recently_active";
  const orderBy =
    filters.sort === "age_asc"
      ? ({ age: "asc" } as const)
      : filters.sort === "age_desc"
        ? ({ age: "desc" } as const)
        : ({ users: { last_seen_at: "desc" } } as const);

  const overFetch = isBestMatch
    ? BEST_MATCH_POOL
    : useActivityRank
      ? filters.page * BROWSE_PAGE_SIZE + BROWSE_PAGE_SIZE
      : BROWSE_PAGE_SIZE;
  const skip = isBestMatch || useActivityRank ? 0 : (filters.page - 1) * BROWSE_PAGE_SIZE;

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
    if (isBestMatch) items = hardSortByCompat(items);
    else if (useActivityRank) items = softSortGoldCompat(items);
  }

  const start = (filters.page - 1) * BROWSE_PAGE_SIZE;
  const pageItems = isBestMatch || useActivityRank
    ? items.slice(start, start + BROWSE_PAGE_SIZE)
    : items.slice(0, BROWSE_PAGE_SIZE);

  // Only record impressions for the first page of a browse session. Recording on every
  // paginated fetch grew each profile's fair-exposure penalty mid-scroll, reshuffling the
  // ranked set so profiles silently dropped out from under the user (PN-BROWSE-007).
  if (filters.page === 1) {
    void recordBrowseImpressions(
      userId,
      pageItems.map((p) => BigInt(p.userId))
    );
  }

  const hasMore = isBestMatch
    ? filters.page * BROWSE_PAGE_SIZE < Math.min(total, BEST_MATCH_POOL)
    : filters.page * BROWSE_PAGE_SIZE < total;

  return NextResponse.json({
    items: pageItems,
    page: filters.page,
    total,
    hasMore,
    needsLocation,
    nextStage: hasMore ? null : firstExpansionStage(filters),
  });
}
