import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";
import {
  FAIR_EXPOSURE_WINDOW_DAYS,
  NEW_MEMBER_BOOST_DAYS,
  activityBucket,
  daysSinceJoined,
  formatLastSeen,
  isJustJoined,
  isOnline,
} from "@/lib/presence";
import { displayHeight } from "@/lib/height";

export type RankableBrowseRow = {
  id: bigint;
  user_id: bigint;
  profile_code: string | null;
  age: number | null;
  height: string | null;
  height_cm: number | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  about_me: string | null;
  photo_url: string | null;
  marital_status: string | null;
  religious_practice: string | null;
  religious_methodology: string | null;
  tribe: string | null;
  education: string | null;
  dialect: string | null;
  ancestral_village: string | null;
  willing_to_relocate: string | null;
  created_at: Date | null;
  users?: { last_seen_at: Date | null; approved_at: Date | null } | null;
};

export type BrowseCardDTO = {
  id: string;
  userId: string;
  profileCode: string | null;
  age: number | null;
  height: string | null;
  tribe: string | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  aboutMe: string | null;
  avatarSeed: number;
  photoUrl: string | null;
  matchScore?: number;
  matchReasons?: string[];
  /** Coarse activity bucket (0 = online). Used for Gold soft re-rank within bucket only. */
  activityBucket?: number;
  online: boolean;
  justJoined: boolean;
  lastSeenLabel: string;
};

/** Day-stable salt so the same viewer + filters don't reshuffle on every refresh. */
function daySalt(viewerId: bigint, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  let h = 0;
  const s = `${viewerId}:${day}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function tieBreak(userId: bigint, salt: number) {
  return Number((userId ^ BigInt(salt)) % BigInt(1000));
}

/**
 * Activity-first ranking with viewer-specific fair exposure.
 * Never promotes a colder activity bucket above a hotter one.
 */
export async function rankBrowseProfiles(
  viewerId: bigint,
  rows: RankableBrowseRow[],
  now = new Date()
): Promise<BrowseCardDTO[]> {
  if (rows.length === 0) return [];

  await ensureBrowseAndWaliSchema();

  const peerIds = rows.map((r) => r.user_id);
  const since = new Date(now.getTime() - FAIR_EXPOSURE_WINDOW_DAYS * 24 * 60 * 60_000);

  type ImpRow = {
    shown_user_id: bigint;
    last_shown_at: Date;
    times_shown: number;
    opened_at: Date | null;
    skipped_at: Date | null;
  };

  const [impressions, pendingRows] = await Promise.all([
    peerIds.length === 0
      ? Promise.resolve([] as ImpRow[])
      : prisma.$queryRaw<ImpRow[]>`
    SELECT shown_user_id, last_shown_at, times_shown, opened_at, skipped_at
    FROM browse_impressions
    WHERE viewer_id = ${viewerId}
      AND last_shown_at >= ${since}
      AND shown_user_id IN (${Prisma.join(peerIds)})
  `.catch(() => [] as ImpRow[]),
    prisma.match_requests.groupBy({
      by: ["receiver_id"],
      where: { receiver_id: { in: peerIds }, status: "pending" },
      _count: { _all: true },
    }).catch(() => [] as { receiver_id: bigint; _count: { _all: number } }[]),
  ]);

  const peerSet = new Set(peerIds.map((id) => id.toString()));
  const seen = new Map(
    impressions
      .filter((i) => peerSet.has(i.shown_user_id.toString()))
      .map((i) => [
        i.shown_user_id.toString(),
        {
          at: i.last_shown_at.getTime(),
          n: Number(i.times_shown) || 1,
          opened: Boolean(i.opened_at),
          skipped: Boolean(i.skipped_at),
        },
      ])
  );

  const salt = daySalt(viewerId, now);

  const pendingByUser = new Map(
    pendingRows.map((p) => [p.receiver_id.toString(), p._count._all])
  );

  const scored = rows.map((r) => {
    const lastSeen = r.users?.last_seen_at ?? null;
    const joined = r.users?.approved_at ?? r.created_at ?? null;
    const bucket = activityBucket(lastSeen, now);
    const imp = seen.get(r.user_id.toString());
    const recentlySeen = Boolean(imp);
    // Soft demotion only — never enough to cross an activity bucket boundary.
    // Skip/X was removed as a Browse action — the algorithm no longer depends on a skipped state.
    const seenPenalty = imp
      ? Math.min(50, imp.n * 8 + (imp.opened ? 18 : 0))
      : 0;
    const popularPenalty = Math.min(35, (pendingByUser.get(r.user_id.toString()) ?? 0) * 4);
    const joinedDays = daysSinceJoined(joined, now);
    const newBoost =
      joinedDays != null && joinedDays <= NEW_MEMBER_BOOST_DAYS && !recentlySeen ? 12 : 0;
    const lastMs = lastSeen ? lastSeen.getTime() : 0;
    // Lower sortKey = higher in list. Bucket dominates; then freshness; then fair exposure; then stable salt.
    const sortKey =
      bucket * 1_000_000_000 -
      lastMs / 1000 +
      seenPenalty * 1000 +
      popularPenalty * 800 -
      newBoost * 100 +
      tieBreak(r.user_id, salt);

    return { r, sortKey, lastSeen, joined };
  });

  scored.sort((a, b) => a.sortKey - b.sortKey);

  return scored.map(({ r, lastSeen, joined, sortKey: _sk }) => {
    const bucket = activityBucket(lastSeen, now);
    return {
      id: r.id.toString(),
      userId: r.user_id.toString(),
      profileCode: r.profile_code,
      age: r.age,
      height: displayHeight(r.height_cm, r.height),
      tribe: r.tribe,
      country: r.country,
      city: r.city,
      occupation: r.occupation,
      aboutMe: r.about_me,
      avatarSeed: Number(r.id % BigInt(70)),
      photoUrl: r.photo_url,
      activityBucket: bucket,
      online: isOnline(lastSeen, now),
      justJoined: isJustJoined(joined, now),
      lastSeenLabel: formatLastSeen(lastSeen, now),
    };
  });
}

/**
 * Gold layer only: keep activity buckets primary, then prefer higher compatibility
 * within the same bucket. Never promotes a colder bucket above a hotter one.
 */
export function softSortGoldCompat(items: BrowseCardDTO[]): BrowseCardDTO[] {
  return items
    .map((p, index) => ({ p, index }))
    .sort((a, b) => {
      const ba = a.p.activityBucket ?? 99;
      const bb = b.p.activityBucket ?? 99;
      if (ba !== bb) return ba - bb;
      const sa = a.p.matchScore ?? 0;
      const sb = b.p.matchScore ?? 0;
      if (sb !== sa) return sb - sa;
      return a.index - b.index;
    })
    .map(({ p }) => p);
}

export async function recordBrowseImpressions(viewerId: bigint, shownUserIds: bigint[]) {
  if (shownUserIds.length === 0) return;
  await ensureBrowseAndWaliSchema();
  const now = new Date();
  await Promise.all(
    shownUserIds.map((shown) =>
      prisma.$executeRaw`
      INSERT INTO browse_impressions (viewer_id, shown_user_id, times_shown, last_shown_at, created_at, updated_at)
      VALUES (${viewerId}, ${shown}, 1, ${now}, ${now}, ${now})
      ON CONFLICT (viewer_id, shown_user_id)
      DO UPDATE SET
        times_shown = browse_impressions.times_shown + 1,
        last_shown_at = ${now},
        updated_at = ${now}
    `.catch(() => undefined)
    )
  );
}

/** Mark that the viewer opened a profile (stronger fair-exposure demotion next time). */
export async function recordBrowseOpened(viewerId: bigint, shownUserId: bigint) {
  await ensureBrowseAndWaliSchema();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO browse_impressions (viewer_id, shown_user_id, times_shown, last_shown_at, opened_at, created_at, updated_at)
    VALUES (${viewerId}, ${shownUserId}, 1, ${now}, ${now}, ${now}, ${now})
    ON CONFLICT (viewer_id, shown_user_id)
    DO UPDATE SET
      opened_at = ${now},
      updated_at = ${now}
  `.catch(() => undefined);
}

export const BROWSE_PROFILE_SELECT = {
  id: true,
  user_id: true,
  profile_code: true,
  age: true,
  height: true,
  height_cm: true,
  country: true,
  city: true,
  occupation: true,
  about_me: true,
  photo_url: true,
  marital_status: true,
  religious_practice: true,
  religious_methodology: true,
  tribe: true,
  education: true,
  dialect: true,
  ancestral_village: true,
  willing_to_relocate: true,
  created_at: true,
  users: { select: { last_seen_at: true, approved_at: true } },
} as const;
