import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";
import { type HubCard, compatScore } from "@/lib/requests-hub-shared";
import { getPlanSettings } from "@/lib/plan-settings";

export type { HubCard } from "@/lib/requests-hub-shared";
export { formatAgeLabel, compatScore } from "@/lib/requests-hub-shared";

async function loadProfile(userId: bigint) {
  return prisma.profiles.findUnique({
    where: { user_id: userId },
    select: {
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
    },
  });
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
  const meUser = await prisma.users.findUnique({ where: { id: userId }, select: { plan: true } });
  const isGold = (meUser?.plan || "").toLowerCase() === "gold";
  const settings = await getPlanSettings(meUser?.plan);
  const meProfile = await loadProfile(userId);

  const [incoming, sentAll, matched, ended, declined, expired] = await Promise.all([
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
  ]);

  async function mapRequest(
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
  ) {
    const peerId = r.sender_id === userId ? r.receiver_id : r.sender_id;
    const peer = await loadProfile(peerId);
    if (!peer) return null;
    let lastMessage: string | null = null;
    if (asMatch) {
      const last = await prisma.messages.findFirst({
        where: { request_id: r.id },
        orderBy: { created_at: "desc" },
        select: { body: true },
      });
      lastMessage = last?.body ?? null;
    }
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

  const [incomingCards, sentCards, matchedCards, endedCards, declinedCards, expiredCards] = await Promise.all([
    Promise.all(incoming.map((r) => mapRequest(r))).then((a) => a.filter(Boolean) as HubCard[]),
    Promise.all(sentAll.map((r) => mapRequest(r))).then((a) => a.filter(Boolean) as HubCard[]),
    Promise.all(matched.map((r) => mapRequest(r, true))).then((a) => a.filter(Boolean) as HubCard[]),
    Promise.all(ended.map((r) => mapRequest(r, true))).then((a) => a.filter(Boolean) as HubCard[]),
    Promise.all(declined.map((r) => mapRequest(r))).then((a) => a.filter(Boolean) as HubCard[]),
    Promise.all(expired.map((r) => mapRequest(r))).then((a) => a.filter(Boolean) as HubCard[]),
  ]);

  const viewRows = await prisma.profile_views.findMany({
    where: { viewed_id: userId },
    orderBy: { viewed_at: "desc" },
    take: 60,
  });

  let views: HubCard[] = [];
  let viewsSummary: { total: number; last7d: number; last30d: number } | null = null;
  const viewsLocked = !isGold;
  if (isGold) {
    views = (
      await Promise.all(
        viewRows.map(async (v) => {
          const peer = await loadProfile(v.viewer_id);
          if (!peer) return null;
          return toCard(peer, meProfile, {
            id: `view-${v.id}`,
            createdAt: v.viewed_at.toISOString(),
          });
        })
      )
    ).filter(Boolean) as HubCard[];
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

  const favs = await prisma.favourites.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 60,
  });
  const saved = (
    await Promise.all(
      favs.map(async (f) => {
        const peer = await loadProfile(f.profile_user_id);
        if (!peer) return null;
        return toCard(peer, meProfile, {
          id: `fav-${f.id}`,
          createdAt: f.created_at.toISOString(),
          note: f.note,
        });
      })
    )
  ).filter(Boolean) as HubCard[];
  const savedLimit = settings.savedProfileLimit;
  const savedLocked = false;

  const blockRows = await prisma.blocks.findMany({
    where: { blocker_id: userId },
    orderBy: { created_at: "desc" },
    take: 60,
  });
  const blocked = (
    await Promise.all(
      blockRows.map(async (b) => {
        const peer = await loadProfile(b.blocked_id);
        if (!peer) return null;
        return toCard(peer, meProfile, {
          id: `block-${b.id}`,
          createdAt: b.created_at.toISOString(),
          status: "blocked",
        });
      })
    )
  ).filter(Boolean) as HubCard[];

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
