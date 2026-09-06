import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";
import { type HubCard, compatScore } from "@/lib/requests-hub-shared";
import { getPlanSettings } from "@/lib/plan-settings";

export type { HubCard } from "@/lib/requests-hub-shared";
export { formatAgeLabel, compatScore } from "@/lib/requests-hub-shared";

const HUB_PROFILE_SELECT = {
  id: true,
  user_id: true,
  profile_code: true,
  full_name: true,
  city: true,
  country: true,
  age: true,
  marital_status: true,
  religious_practice: true,
  ancestral_village: true,
  about_me: true,
  tribe: true,
  education: true,
  religious_methodology: true,
  dialect: true,
  willing_to_relocate: true,
} as const;

type HubProfile = {
  id: bigint;
  user_id: bigint;
  profile_code: string | null;
  full_name: string | null;
  city: string | null;
  country: string | null;
  age: number | null;
  marital_status: string | null;
  religious_practice: string | null;
  ancestral_village: string | null;
  about_me: string | null;
  tribe: string | null;
  education: string | null;
  religious_methodology: string | null;
  dialect: string | null;
  willing_to_relocate: string | null;
};

async function loadProfile(userId: bigint) {
  return prisma.profiles.findUnique({
    where: { user_id: userId },
    select: HUB_PROFILE_SELECT,
  });
}

/** One query for every peer profile the hub needs, keyed by user_id string. */
async function loadProfilesByUserId(
  userIds: bigint[]
): Promise<Map<string, HubProfile>> {
  const unique = [...new Set(userIds.map((id) => id.toString()))].map((s) => BigInt(s));
  if (unique.length === 0) return new Map();
  const rows = (await prisma.profiles.findMany({
    where: { user_id: { in: unique } },
    select: HUB_PROFILE_SELECT,
  })) as HubProfile[];
  return new Map(rows.map((r) => [r.user_id.toString(), r]));
}

function toCard(
  peer: NonNullable<Awaited<ReturnType<typeof loadProfile>>>,
  me: Awaited<ReturnType<typeof loadProfile>>,
  extra: Partial<HubCard> & { createdAt: string; id: string }
): HubCard {
  const place = [peer.city, peer.country].filter(Boolean).join(", ");
  const summaryBits = [peer.age ? `${peer.age} yrs` : null, peer.marital_status, peer.tribe].filter(Boolean);
  return {
    id: extra.id,
    requestId: extra.requestId,
    peerUserId: peer.user_id.toString(),
    code: peer.profile_code || "Member",
    name: peer.full_name || peer.profile_code || "Member",
    place,
    age: peer.age,
    maritalStatus: peer.marital_status,
    summary: summaryBits.join(" · ") || peer.about_me?.slice(0, 80) || "Member profile",
    avatarSeed: Number(peer.id % BigInt(70)),
    createdAt: extra.createdAt,
    status: extra.status,
    compat: compatScore(me, peer),
    lastMessage: extra.lastMessage,
    photoShared: extra.photoShared,
    communicationMode: extra.communicationMode,
    note: extra.note ?? null,
  };
}

export async function loadRequestsHub(userId: bigint) {
  await ensureMatchRequestsSchema();

  // Fresh DB read of plan — a JWT session claim can be stale until next login/refresh,
  // and this gates real limits (saved-profile cap, viewer identity), not just cosmetics.
  const meUserP = prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });

  // All top-level list reads fire together — previously each block awaited the
  // one before it, and every card then did its own per-peer profile lookup.
  const [
    meUser,
    meProfile,
    incoming,
    sentAll,
    matched,
    ended,
    declined,
    expired,
    viewRows,
    favs,
    blockRows,
  ] = await Promise.all([
    meUserP,
    loadProfile(userId),
    prisma.match_requests.findMany({
      where: { receiver_id: userId, status: "pending" },
      orderBy: { created_at: "desc" },
      take: 80,
    }),
    prisma.match_requests.findMany({
      where: { sender_id: userId },
      orderBy: { created_at: "desc" },
      take: 80,
    }),
    prisma.match_requests.findMany({
      where: {
        status: "accepted",
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
      orderBy: { updated_at: "desc" },
      take: 80,
    }),
    prisma.match_requests.findMany({
      where: {
        status: "ended",
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
      orderBy: { ended_at: "desc" },
      take: 40,
    }),
    prisma.match_requests.findMany({
      where: {
        status: "declined",
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
      orderBy: { updated_at: "desc" },
      take: 40,
    }),
    prisma.match_requests.findMany({
      where: {
        status: "expired",
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
      orderBy: { updated_at: "desc" },
      take: 40,
    }),
    prisma.profile_views.findMany({
      where: { viewed_id: userId },
      orderBy: { viewed_at: "desc" },
      take: 60,
    }),
    prisma.favourites.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 60,
    }),
    prisma.blocks.findMany({
      where: { blocker_id: userId },
      orderBy: { created_at: "desc" },
      take: 60,
    }),
  ]);

  const isGold = (meUser?.plan || "").toLowerCase() === "gold";

  const allRequests = [...incoming, ...sentAll, ...matched, ...ended, ...declined, ...expired];
  const matchRequestIds = [...matched, ...ended].map((r) => r.id);

  // Two batched lookups replace the old N+1: every peer profile in one query,
  // every thread's latest message in another.
  const [settings, profileMap, lastMsgRows] = await Promise.all([
    getPlanSettings(meUser?.plan),
    loadProfilesByUserId([
      ...allRequests.map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id)),
      ...(isGold ? viewRows.map((v) => v.viewer_id) : []),
      ...favs.map((f) => f.profile_user_id),
      ...blockRows.map((b) => b.blocked_id),
    ]),
    matchRequestIds.length === 0
      ? Promise.resolve([] as { request_id: bigint; body: string }[])
      : prisma.messages.findMany({
          where: { request_id: { in: matchRequestIds } },
          orderBy: [{ request_id: "asc" }, { created_at: "desc" }],
          distinct: ["request_id"],
          select: { request_id: true, body: true },
        }),
  ]);

  const lastMsgByRequest = new Map(
    lastMsgRows.map((m) => [m.request_id.toString(), m.body])
  );

  function mapRequest(
    r: {
      id: bigint;
      sender_id: bigint;
      receiver_id: bigint;
      status: string;
      created_at: Date;
      updated_at: Date;
      ended_at?: Date | null;
      communication_mode: string | null;
      photo_shared: boolean;
      intro_message?: string | null;
    },
    asMatch = false
  ): HubCard | null {
    const peerId = r.sender_id === userId ? r.receiver_id : r.sender_id;
    const peer = profileMap.get(peerId.toString());
    if (!peer) return null;
    const lastMessage = asMatch ? lastMsgByRequest.get(r.id.toString()) ?? null : null;
    const stamp =
      r.status === "ended" && r.ended_at
        ? r.ended_at
        : asMatch
          ? r.updated_at
          : r.created_at;
    return toCard(peer, meProfile, {
      id: r.id.toString(),
      requestId: r.id.toString(),
      createdAt: stamp.toISOString(),
      status: r.status,
      lastMessage,
      photoShared: r.photo_shared,
      communicationMode: r.communication_mode,
      introMessage: r.intro_message ?? null,
    });
  }

  const filterCards = (a: (HubCard | null)[]) => a.filter(Boolean) as HubCard[];
  const incomingCards = filterCards(incoming.map((r) => mapRequest(r)));
  const sentCards = filterCards(sentAll.map((r) => mapRequest(r)));
  const matchedCards = filterCards(matched.map((r) => mapRequest(r, true)));
  const endedCards = filterCards(ended.map((r) => mapRequest(r, true)));
  const declinedCards = filterCards(declined.map((r) => mapRequest(r)));
  const expiredCards = filterCards(expired.map((r) => mapRequest(r)));

  let views: HubCard[] = [];
  let viewsSummary: { total: number; last7d: number; last30d: number } | null = null;
  const viewsLocked = !isGold;
  if (isGold) {
    views = filterCards(
      viewRows.map((v) => {
        const peer = profileMap.get(v.viewer_id.toString());
        if (!peer) return null;
        return toCard(peer, meProfile, {
          id: `view-${v.id}`,
          createdAt: v.viewed_at.toISOString(),
        });
      })
    );
  } else {
    // Free: reveal that they were viewed and roughly when, never who — full identity is Gold-only.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    viewsSummary = {
      total: viewRows.length,
      last7d: viewRows.filter((v) => now - v.viewed_at.getTime() <= 7 * day).length,
      last30d: viewRows.filter((v) => now - v.viewed_at.getTime() <= 30 * day).length,
    };
  }

  const saved = filterCards(
    favs.map((f) => {
      const peer = profileMap.get(f.profile_user_id.toString());
      if (!peer) return null;
      return toCard(peer, meProfile, {
        id: `fav-${f.id}`,
        createdAt: f.created_at.toISOString(),
        note: f.note,
      });
    })
  );
  const savedLimit = settings.savedProfileLimit;
  const savedLocked = false;

  const blocked = filterCards(
    blockRows.map((b) => {
      const peer = profileMap.get(b.blocked_id.toString());
      if (!peer) return null;
      return toCard(peer, meProfile, {
        id: `block-${b.id}`,
        createdAt: b.created_at.toISOString(),
        status: "blocked",
      });
    })
  );

  return {
    isGold,
    counts: {
      incoming: incomingCards.length,
      sent: sentCards.length,
      matches: matchedCards.length,
      ended: endedCards.length,
      views: viewRows.length,
      saved: saved.length,
      blocked: blocked.length,
    },
    incoming: incomingCards,
    sent: sentCards,
    matches: matchedCards,
    ended: endedCards,
    declined: declinedCards,
    expired: expiredCards,
    views,
    viewsLocked,
    viewsSummary,
    saved,
    savedLocked,
    savedLimit,
    blocked,
  };
}
