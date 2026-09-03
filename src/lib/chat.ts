import { prisma } from "@/lib/prisma";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";
import {
  allowsPhotoShare,
  allowsPrivateChat,
  effectiveCommMode,
  loadWaliContact,
  peerPhotoVisible,
  type CommMode,
} from "@/lib/communication";
import { sendPushNotification } from "@/lib/push/server";
import { mapProfileView } from "@/lib/profile";
import { ALL_REACTIONS, isAllowedReaction } from "@/lib/reactions";

export type ReactionSummary = { emoji: string; userIds: string[] }[];

/** @deprecated import from "@/lib/reactions" instead — kept for compatibility. */
export const ALLOWED_REACTIONS = ALL_REACTIONS;

export type MessageType = "text" | "contact_card";

export type ContactCardData = {
  name: string;
  contact: string | null;
  email: string | null;
};

export type ChatMessageDTO = {
  id: string;
  requestId: string;
  senderId: string;
  receiverId: string;
  body: string;
  isRead: boolean;
  replyToId: string | null;
  replyTo: { id: string; body: string; senderId: string } | null;
  createdAt: string;
  clientId?: string;
  reactions?: ReactionSummary;
  type: MessageType;
  card?: ContactCardData | null;
};

export type ChatThreadDTO = {
  requestId: string;
  peerUserId: string;
  peerCode: string;
  peerName: string;
  peerVerified: boolean;
  peerAvatarSeed: number;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  matchedAt: string;
  communicationMode: CommMode;
  privateChat: boolean;
  photoShared: boolean;
  photoVisible: boolean;
};

export type PhotoOnceStatus = "none" | "pending" | "viewed";

export type ChatThreadMeta = {
  communicationMode: CommMode;
  privateChat: boolean;
  photoShared: boolean;
  photoVisible: boolean;
  canSharePhoto: boolean;
  isFemaleViewer: boolean;
  wali: Awaited<ReturnType<typeof loadWaliContact>>;
  photoOnceStatus: PhotoOnceStatus;
  canSendPhotoOnce: boolean;
  canRevealPhotoOnce: boolean;
};

export function serializeMessage(
  m: {
    id: bigint;
    request_id: bigint;
    sender_id: bigint;
    receiver_id: bigint;
    body: string;
    is_read: boolean;
    reply_to_id: bigint | null;
    created_at: Date;
    message_type?: string;
    metadata?: unknown;
  },
  replyTo?: { id: bigint; body: string; sender_id: bigint } | null,
  clientId?: string,
  reactions?: ReactionSummary
): ChatMessageDTO {
  const type: MessageType = m.message_type === "contact_card" ? "contact_card" : "text";
  const card =
    type === "contact_card" && m.metadata && typeof m.metadata === "object"
      ? (m.metadata as ContactCardData)
      : null;
  return {
    id: m.id.toString(),
    requestId: m.request_id.toString(),
    senderId: m.sender_id.toString(),
    receiverId: m.receiver_id.toString(),
    body: m.body,
    isRead: m.is_read,
    replyToId: m.reply_to_id?.toString() ?? null,
    replyTo: replyTo
      ? {
          id: replyTo.id.toString(),
          body: replyTo.body,
          senderId: replyTo.sender_id.toString(),
        }
      : null,
    createdAt: m.created_at.toISOString(),
    clientId,
    reactions: reactions ?? [],
    type,
    card,
  };
}

export async function getReactionsForMessages(
  messageIds: bigint[]
): Promise<Map<string, ReactionSummary>> {
  if (messageIds.length === 0) return new Map();
  const rows = await prisma.message_reactions.findMany({
    where: { message_id: { in: messageIds } },
    orderBy: { created_at: "asc" },
  });
  const byMessage = new Map<string, Map<string, string[]>>();
  for (const r of rows) {
    const mid = r.message_id.toString();
    if (!byMessage.has(mid)) byMessage.set(mid, new Map());
    const byEmoji = byMessage.get(mid)!;
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, []);
    byEmoji.get(r.emoji)!.push(r.user_id.toString());
  }
  const result = new Map<string, ReactionSummary>();
  for (const [mid, byEmoji] of byMessage) {
    result.set(
      mid,
      [...byEmoji.entries()].map(([emoji, userIds]) => ({ emoji, userIds }))
    );
  }
  return result;
}

export async function toggleReaction(opts: {
  messageId: bigint;
  requestId: bigint;
  userId: bigint;
  emoji: string;
}): Promise<ReactionSummary> {
  if (!isAllowedReaction(opts.emoji)) throw new Error("Unsupported reaction");
  const message = await prisma.messages.findFirst({
    where: { id: opts.messageId, request_id: opts.requestId },
  });
  if (!message) throw new Error("Message not found");

  const existing = await prisma.message_reactions.findUnique({
    where: { message_id_user_id: { message_id: opts.messageId, user_id: opts.userId } },
  });
  if (existing && existing.emoji === opts.emoji) {
    await prisma.message_reactions.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.message_reactions.update({
      where: { id: existing.id },
      data: { emoji: opts.emoji },
    });
  } else {
    await prisma.message_reactions.create({
      data: { message_id: opts.messageId, user_id: opts.userId, emoji: opts.emoji },
    });
  }

  const summary = await getReactionsForMessages([opts.messageId]);
  return summary.get(opts.messageId.toString()) ?? [];
}

export async function nextMessageId() {
  try {
    const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('messages_id_seq') as nextval`;
    if (rows[0]?.nextval) return rows[0].nextval;
  } catch {
    /* fall through — messages_id_seq doesn't exist in this database */
  }
  const max = await prisma.messages.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function assertAcceptedParticipant(requestId: bigint, userId: bigint) {
  await ensureMatchRequestsSchema();
  const req = await prisma.match_requests.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "accepted") return null;
  if (req.sender_id !== userId && req.receiver_id !== userId) return null;
  return req;
}

/** Read-only access for accepted or ended matches. */
export async function assertMatchParticipant(requestId: bigint, userId: bigint) {
  await ensureMatchRequestsSchema();
  const req = await prisma.match_requests.findUnique({ where: { id: requestId } });
  if (!req || !["accepted", "ended"].includes(req.status)) return null;
  if (req.sender_id !== userId && req.receiver_id !== userId) return null;
  return req;
}

export async function peerUserId(request: { sender_id: bigint; receiver_id: bigint }, me: bigint) {
  return request.sender_id === me ? request.receiver_id : request.sender_id;
}

export async function loadPeer(peerId: bigint) {
  const [user, profile] = await Promise.all([
    prisma.users.findUnique({
      where: { id: peerId },
      select: { id: true, display_name: true, email_verified: true, cultural_verified: true },
    }),
    prisma.profiles.findUnique({
      where: { user_id: peerId },
      select: { id: true, profile_code: true, full_name: true, status: true, gender: true },
    }),
  ]);
  if (!user || !profile) return null;
  return {
    userId: peerId.toString(),
    code: profile.profile_code || "Member",
    name: profile.full_name || user.display_name || profile.profile_code || "Member",
    verified: Boolean(user.email_verified || user.cultural_verified || profile.status === "approved"),
    avatarSeed: Number(profile.id % BigInt(70)),
    gender: profile.gender,
  };
}

/** Full profile view for embedding inline in the chat Profile tab (not the slim Peer header info). */
export async function loadPeerProfileView(peerId: bigint) {
  const [user, profile] = await Promise.all([
    prisma.users.findUnique({
      where: { id: peerId },
      select: {
        email: true,
        plan: true,
        requests_remaining: true,
        email_verified: true,
        cultural_verified: true,
        display_name: true,
      },
    }),
    prisma.profiles.findUnique({ where: { user_id: peerId } }),
  ]);
  if (!user || !profile) return null;
  const view = mapProfileView(profile, user);
  // This is served to the OTHER chat participant over a plain JSON API — never include the
  // profile owner's real email/phone here, unlike the RSC-embedded /p/[code] page.
  return { ...view, email: "", phone: null };
}

function modeOf(req: { communication_mode: string | null }): CommMode {
  return effectiveCommMode(req.communication_mode || "standard", null);
}

export async function threadMetaFor(
  req: {
    id: bigint;
    sender_id: bigint;
    receiver_id: bigint;
    communication_mode: string | null;
    photo_shared: boolean;
    photo_once_shared_at?: Date | null;
    photo_once_viewed_at?: Date | null;
  },
  viewerId: bigint
): Promise<ChatThreadMeta> {
  const mode = modeOf(req);
  const privateChat = allowsPrivateChat(mode);
  const peerId = await peerUserId(req, viewerId);
  const [viewerProfile, peerProfile] = await Promise.all([
    prisma.profiles.findUnique({ where: { user_id: viewerId }, select: { gender: true } }),
    prisma.profiles.findUnique({ where: { user_id: peerId }, select: { gender: true, user_id: true } }),
  ]);
  const isFemaleViewer = (viewerProfile?.gender || "").toLowerCase().startsWith("f");
  const femaleId = isFemaleViewer
    ? viewerId
    : (peerProfile?.gender || "").toLowerCase().startsWith("f")
      ? peerId
      : null;

  const photoVisible = peerPhotoVisible({
    matched: true,
    photoShared: req.photo_shared,
    mode,
  });

  const photoOnceStatus: PhotoOnceStatus = !req.photo_once_shared_at
    ? "none"
    : req.photo_once_viewed_at
      ? "viewed"
      : "pending";
  const canSendPhotoOnce = isFemaleViewer && allowsPhotoShare(mode);

  return {
    communicationMode: mode,
    privateChat,
    photoShared: req.photo_shared,
    photoVisible,
    canSharePhoto: canSendPhotoOnce,
    isFemaleViewer,
    wali: !privateChat && femaleId ? await loadWaliContact(femaleId) : null,
    photoOnceStatus,
    canSendPhotoOnce,
    canRevealPhotoOnce: !isFemaleViewer && photoOnceStatus === "pending",
  };
}

export async function sendPhotoOnce(requestId: bigint, viewerId: bigint) {
  const match = await assertAcceptedParticipant(requestId, viewerId);
  if (!match) throw new Error("Chat not found");
  const meta = await threadMetaFor(match, viewerId);
  if (!meta.canSendPhotoOnce) {
    throw new Error("Only the sister can send a one-time photo in this match.");
  }
  return prisma.match_requests.update({
    where: { id: requestId },
    data: { photo_once_shared_at: new Date(), photo_once_viewed_at: null, updated_at: new Date() },
  });
}

/**
 * Atomic view-once consumption: the update only matches (count===1) for the very first caller
 * while the photo is still pending, so concurrent/duplicate reveal attempts can never both
 * succeed — this is what actually enforces "viewable exactly once", not just the UI state.
 */
export async function consumePhotoOnce(requestId: bigint, viewerId: bigint) {
  const match = await assertAcceptedParticipant(requestId, viewerId);
  if (!match) throw new Error("Chat not found");
  const meta = await threadMetaFor(match, viewerId);
  if (meta.isFemaleViewer) {
    throw new Error("You can't reveal your own one-time photo.");
  }

  const result = await prisma.match_requests.updateMany({
    where: { id: requestId, photo_once_shared_at: { not: null }, photo_once_viewed_at: null },
    data: { photo_once_viewed_at: new Date(), updated_at: new Date() },
  });
  if (result.count === 0) {
    throw new Error("This photo has already been viewed or is no longer available.");
  }

  const femaleId = await peerUserId(match, viewerId);
  const femaleProfile = await prisma.profiles.findUnique({
    where: { user_id: femaleId },
    select: { id: true, photo_url: true, photo_status: true },
  });
  return {
    photoUrl: femaleProfile?.photo_status === "approved" ? femaleProfile.photo_url : null,
    avatarSeed: femaleProfile ? Number(femaleProfile.id % BigInt(70)) : 0,
  };
}

export async function listThreadsForUser(userId: bigint): Promise<ChatThreadDTO[]> {
  const requests = await prisma.match_requests.findMany({
    where: {
      status: "accepted",
      OR: [{ sender_id: userId }, { receiver_id: userId }],
    },
    orderBy: { updated_at: "desc" },
  });

  const threads: ChatThreadDTO[] = [];

  for (const req of requests) {
    const peerId = await peerUserId(req, userId);
    const peer = await loadPeer(peerId);
    if (!peer) continue;
    const meta = await threadMetaFor(req, userId);

    const last = await prisma.messages.findFirst({
      where: { request_id: req.id },
      orderBy: { created_at: "desc" },
    });

    const unread = await prisma.messages.count({
      where: {
        request_id: req.id,
        receiver_id: userId,
        is_read: false,
      },
    });

    threads.push({
      requestId: req.id.toString(),
      peerUserId: peer.userId,
      peerCode: peer.code,
      peerName: peer.name,
      peerVerified: peer.verified,
      peerAvatarSeed: peer.avatarSeed,
      lastMessage: meta.privateChat
        ? last?.body ?? null
        : "Wali-Only — contact through wali",
      lastAt: last?.created_at.toISOString() ?? req.updated_at.toISOString(),
      unread: meta.privateChat ? unread : 0,
      matchedAt: req.created_at.toISOString(),
      communicationMode: meta.communicationMode,
      privateChat: meta.privateChat,
      photoShared: meta.photoShared,
      photoVisible: meta.photoVisible,
    });
  }

  threads.sort((a, b) => {
    const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
    const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
    return bt - at;
  });

  return threads;
}

export async function createMessage(opts: {
  requestId: bigint;
  senderId: bigint;
  receiverId: bigint;
  body: string;
  replyToId?: bigint | null;
}) {
  const match = await prisma.match_requests.findUnique({ where: { id: opts.requestId } });
  if (!match || match.status !== "accepted") throw new Error("Chat not found");
  const mode = modeOf(match);
  if (!allowsPrivateChat(mode)) {
    throw new Error("This match is Wali-Only — private chat is not available.");
  }

  const body = opts.body.trim().slice(0, 4000);
  if (!body) throw new Error("Empty message");

  const { screenOutgoingMessage } = await import("@/lib/moderation");
  await screenOutgoingMessage({
    senderId: opts.senderId,
    requestId: opts.requestId,
    body,
  });

  let replyTo: { id: bigint; body: string; sender_id: bigint } | null = null;
  if (opts.replyToId) {
    const quoted = await prisma.messages.findFirst({
      where: { id: opts.replyToId, request_id: opts.requestId },
    });
    if (quoted) {
      replyTo = { id: quoted.id, body: quoted.body, sender_id: quoted.sender_id };
    }
  }

  const id = await nextMessageId();
  const created = await prisma.messages.create({
    data: {
      id,
      request_id: opts.requestId,
      sender_id: opts.senderId,
      receiver_id: opts.receiverId,
      body,
      is_read: false,
      is_flagged: false,
      flagged_by: null,
      reply_to_id: replyTo?.id ?? null,
      created_at: new Date(),
    },
  });

  await prisma.match_requests.update({
    where: { id: opts.requestId },
    data: { updated_at: new Date() },
  });

  // Privacy-safe: never put actual message content in a push payload — it can surface on a
  // locked phone or shared device.
  void sendPushNotification(opts.receiverId, {
    title: "Pashtun Nikah",
    body: "You have a new message.",
    url: `/chats/${opts.requestId}`,
    tag: `message-${opts.requestId}`,
    type: "message",
    relatedRequestId: opts.requestId,
  }).catch((err) => console.error("[push] message notification failed", err));

  return serializeMessage(created, replyTo);
}

export async function createContactCardMessage(opts: {
  requestId: bigint;
  senderId: bigint;
  receiverId: bigint;
}) {
  const match = await prisma.match_requests.findUnique({ where: { id: opts.requestId } });
  if (!match || match.status !== "accepted") throw new Error("Chat not found");
  const mode = modeOf(match);
  if (!allowsPrivateChat(mode)) {
    throw new Error("This match is Wali-Only — private chat is not available.");
  }

  const senderProfile = await prisma.profiles.findUnique({
    where: { user_id: opts.senderId },
    select: { gender: true },
  });
  if (!(senderProfile?.gender || "").toLowerCase().startsWith("f")) {
    throw new Error("Only the sister can send a wali contact card.");
  }

  const wali = await loadWaliContact(opts.senderId);
  if (!wali?.contact) {
    throw new Error("Add your wali's phone number in Profile → Edit before sending a contact card.");
  }

  const card: ContactCardData = { name: wali.name, contact: wali.contact, email: wali.email };
  const id = await nextMessageId();
  const created = await prisma.messages.create({
    data: {
      id,
      request_id: opts.requestId,
      sender_id: opts.senderId,
      receiver_id: opts.receiverId,
      body: `📇 Wali contact card: ${wali.name}`,
      is_read: false,
      message_type: "contact_card",
      metadata: card,
      created_at: new Date(),
    },
  });

  await prisma.match_requests.update({
    where: { id: opts.requestId },
    data: { updated_at: new Date() },
  });

  void sendPushNotification(opts.receiverId, {
    title: "Pashtun Nikah",
    body: "You received a wali contact card.",
    url: `/chats/${opts.requestId}`,
    tag: `message-${opts.requestId}`,
    type: "message",
    relatedRequestId: opts.requestId,
  }).catch((err) => console.error("[push] contact-card notification failed", err));

  return serializeMessage(created, null, undefined, []);
}

export async function markThreadRead(requestId: bigint, userId: bigint) {
  const result = await prisma.messages.updateMany({
    where: {
      request_id: requestId,
      receiver_id: userId,
      is_read: false,
    },
    data: { is_read: true },
  });
  return result.count;
}

export async function setPhotoShared(requestId: bigint, viewerId: bigint, shared: boolean) {
  const match = await assertAcceptedParticipant(requestId, viewerId);
  if (!match) throw new Error("Chat not found");
  const meta = await threadMetaFor(match, viewerId);
  if (!meta.canSharePhoto) {
    throw new Error("Only the sister can share or hide her photo in this match.");
  }
  if (!allowsPhotoShare(meta.communicationMode)) {
    throw new Error("Photo sharing is not available in Wali-Only mode.");
  }
  const updated = await prisma.match_requests.update({
    where: { id: requestId },
    data: {
      photo_shared: shared,
      photo_shared_at: shared ? new Date() : null,
      updated_at: new Date(),
    },
  });
  return updated;
}
