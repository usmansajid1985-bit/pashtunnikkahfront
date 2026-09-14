import { prisma } from "@/lib/prisma";
import { ensurePrivatePhotosSchema } from "@/lib/ensure-private-photos-schema";
import { assertAcceptedParticipant, peerUserId } from "@/lib/chat";
import { profileCodeOf } from "@/lib/notifications";
import { sendPushNotification } from "@/lib/push/server";

/** Spec §9: one continuous 60-second session per share, server-authoritative. */
export const VIEW_DURATION_SEC = 60;
const MAX_SHARE_PHOTOS = 3;

export type PrivatePhotoSessionStatus = "none" | "shared" | "active" | "expired";

export type PrivatePhotoShareRow = {
  id: bigint;
  match_request_id: bigint;
  sender_id: bigint;
  recipient_id: bigint;
  photo_ids: bigint[];
  shared_at: Date;
  viewing_started_at: Date | null;
  expires_at: Date | null;
  wali_allowed_at: Date | null;
  wali_viewing_started_at: Date | null;
  wali_expires_at: Date | null;
};

async function log(shareId: bigint, event: string, actorId?: bigint | null) {
  await prisma.private_photo_access_log
    .create({ data: { share_id: shareId, event, actor_id: actorId ?? null } })
    .catch(() => undefined);
}

export function deriveStatus(share: PrivatePhotoShareRow | null): PrivatePhotoSessionStatus {
  if (!share) return "none";
  if (!share.viewing_started_at) return "shared";
  if (share.expires_at && share.expires_at.getTime() > Date.now()) return "active";
  return "expired";
}

function secondsRemaining(share: PrivatePhotoShareRow | null): number {
  if (!share?.expires_at) return 0;
  return Math.max(0, Math.ceil((share.expires_at.getTime() - Date.now()) / 1000));
}

function waliStatus(share: PrivatePhotoShareRow | null): PrivatePhotoSessionStatus {
  if (!share || !share.wali_allowed_at) return "none";
  if (!share.wali_viewing_started_at) return "shared";
  if (share.wali_expires_at && share.wali_expires_at.getTime() > Date.now()) return "active";
  return "expired";
}

function waliSecondsRemaining(share: PrivatePhotoShareRow | null): number {
  if (!share?.wali_expires_at) return 0;
  return Math.max(0, Math.ceil((share.wali_expires_at.getTime() - Date.now()) / 1000));
}

async function latestShare(opts: {
  requestId: bigint;
  senderId?: bigint;
  recipientId?: bigint;
}): Promise<PrivatePhotoShareRow | null> {
  await ensurePrivatePhotosSchema();
  const row = await prisma.private_photo_shares.findFirst({
    where: {
      match_request_id: opts.requestId,
      ...(opts.senderId ? { sender_id: opts.senderId } : {}),
      ...(opts.recipientId ? { recipient_id: opts.recipientId } : {}),
    },
    orderBy: { shared_at: "desc" },
  });
  return row as PrivatePhotoShareRow | null;
}

async function loadShareById(shareId: bigint): Promise<PrivatePhotoShareRow | null> {
  await ensurePrivatePhotosSchema();
  const row = await prisma.private_photo_shares.findUnique({ where: { id: shareId } });
  return row as PrivatePhotoShareRow | null;
}

/** Everything the chat/profile UI needs to render both directions of a thread's photo state. */
export async function privatePhotoSummary(requestId: bigint, viewerId: bigint) {
  const match = await assertAcceptedParticipant(requestId, viewerId);
  if (!match) return null;
  const peerId = await peerUserId(match, viewerId);

  const [incomingShare, outgoingShare, viewerProfile] = await Promise.all([
    latestShare({ requestId, senderId: peerId, recipientId: viewerId }),
    latestShare({ requestId, senderId: viewerId, recipientId: peerId }),
    prisma.profiles.findUnique({ where: { user_id: viewerId }, select: { gender: true } }),
  ]);

  const isFemaleViewer = (viewerProfile?.gender || "").toLowerCase().startsWith("f");
  const guardian = isFemaleViewer
    ? await prisma.profile_guardians.findFirst({ where: { user_id: viewerId } })
    : null;

  const incomingStatus = deriveStatus(incomingShare);
  const outgoingStatus = deriveStatus(outgoingShare);

  return {
    incoming:
      incomingStatus === "none"
        ? { status: "none" as const }
        : {
            status: incomingStatus,
            shareId: incomingShare!.id.toString(),
            secondsRemaining: secondsRemaining(incomingShare),
            photoCount: incomingShare!.photo_ids.length,
            waliEligible: isFemaleViewer && Boolean(guardian),
            waliAllowed: Boolean(incomingShare!.wali_allowed_at),
          },
    outgoing:
      outgoingStatus === "none"
        ? { status: "none" as const, canShare: true }
        : {
            status: outgoingStatus,
            shareId: outgoingShare!.id.toString(),
            // Re-share is only offered once the previous session has fully played out (spec §16).
            canShare: outgoingStatus === "expired",
          },
  };
}

/** Sender action: share 1-3 of the sender's own approved photos with the peer (spec §4). */
export async function createShare(opts: {
  requestId: bigint;
  senderId: bigint;
  photoIds: bigint[];
}) {
  await ensurePrivatePhotosSchema();
  const match = await assertAcceptedParticipant(opts.requestId, opts.senderId);
  if (!match) throw new Error("Chat not found");

  const photoIds = [...new Set(opts.photoIds)];
  if (photoIds.length < 1 || photoIds.length > MAX_SHARE_PHOTOS) {
    throw new Error(`Choose 1 to ${MAX_SHARE_PHOTOS} photos to share.`);
  }

  const owned = await prisma.profile_photos.findMany({
    where: { id: { in: photoIds }, user_id: opts.senderId, status: "approved" },
  });
  if (owned.length !== photoIds.length) {
    throw new Error("Only your own approved photos can be shared.");
  }

  const recipientId = await peerUserId(match, opts.senderId);

  // Spec §16: a new session can only be started once the previous one has fully played out.
  const inFlight = await latestShare({ requestId: opts.requestId, senderId: opts.senderId, recipientId });
  if (inFlight && deriveStatus(inFlight) !== "expired") {
    throw new Error("Wait for the current viewing session to finish before sharing again.");
  }

  // Preserve the order the sender picked them in.
  const orderedIds = photoIds.map((id) => owned.find((p) => p.id === id)!.id);

  const created = await prisma.private_photo_shares.create({
    data: {
      match_request_id: opts.requestId,
      sender_id: opts.senderId,
      recipient_id: recipientId,
      photo_ids: orderedIds,
      status: "shared",
    },
  });
  await log(created.id, "shared", opts.senderId);

  const senderCode = await profileCodeOf(opts.senderId);
  void sendPushNotification(recipientId, {
    title: `${senderCode} shared private photos with you`,
    body: "You have one 60-second session to view them.",
    url: `/chats/${opts.requestId.toString()}`,
    tag: `private-photo-${created.id.toString()}`,
    type: "photo",
    actorUserId: opts.senderId,
    relatedRequestId: opts.requestId,
  }).catch((err) => console.error("[push] private-photo-share notification failed", err));

  return created;
}

/**
 * Recipient action: begin the one 60-second viewing window (spec §6/§9). Atomic guard — the
 * update only matches (count===1) the very first caller while `viewing_started_at` is still
 * null, so Chat and Profile tapping "Start Viewing" in a race can never create two timers, and
 * a double-tap can't restart the clock.
 */
export async function startViewing(shareId: bigint, recipientId: bigint) {
  await ensurePrivatePhotosSchema();
  const share = await loadShareById(shareId);
  if (!share || share.recipient_id !== recipientId) throw new Error("Share not found");
  const match = await assertAcceptedParticipant(share.match_request_id, recipientId);
  if (!match) throw new Error("This conversation is no longer available.");

  if (share.viewing_started_at) {
    // Already started (e.g. opened from Chat, then Profile) — same session, same clock.
    if (deriveStatus(share) === "expired") throw new Error("This viewing session has ended.");
    return share;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + VIEW_DURATION_SEC * 1000);
  const result = await prisma.private_photo_shares.updateMany({
    where: { id: shareId, recipient_id: recipientId, viewing_started_at: null },
    data: { viewing_started_at: now, expires_at: expiresAt, status: "active" },
  });
  if (result.count === 0) {
    // Lost the race to another concurrent start — re-read and hand back the session that won.
    const fresh = await loadShareById(shareId);
    if (fresh?.viewing_started_at) return fresh;
    throw new Error("This share is no longer available.");
  }
  await log(shareId, "start_viewing", recipientId);
  return (await loadShareById(shareId))!;
}

/** Recipient action: fetch the active session's photo list (URLs point at the image-bytes route). */
export async function getViewerPhotos(opts: { shareId: bigint; recipientId: bigint; requestId: bigint }) {
  await ensurePrivatePhotosSchema();
  const share = await loadShareById(opts.shareId);
  if (!share || share.recipient_id !== opts.recipientId || share.match_request_id !== opts.requestId) {
    throw new Error("Share not found");
  }
  const match = await assertAcceptedParticipant(share.match_request_id, opts.recipientId);
  if (!match) {
    await log(opts.shareId, "blocked_access_attempt", opts.recipientId);
    throw new Error("This conversation is no longer available.");
  }
  const status = deriveStatus(share);
  if (status !== "active") {
    if (status === "expired") await log(opts.shareId, "expired_access_attempt", opts.recipientId);
    throw new Error(
      status === "shared" ? "Press Start Viewing first." : "Private photo preview ended."
    );
  }

  const recipientCode = await profileCodeOf(opts.recipientId);
  return {
    secondsRemaining: secondsRemaining(share),
    watermark: `${recipientCode} • PRIVATE • Pashtun Nikah`,
    photos: share.photo_ids.map((_, index) => ({
      index,
      url: `/api/chats/${opts.requestId.toString()}/private-photos/${opts.shareId.toString()}/image/${index}`,
    })),
  };
}

/** Loads the original bytes for one shared photo by position — used only by the image route. */
export async function loadSharePhotoSource(shareId: bigint, index: number) {
  const share = await loadShareById(shareId);
  if (!share) return null;
  const photoId = share.photo_ids[index];
  if (photoId === undefined) return null;
  const photo = await prisma.profile_photos.findFirst({
    where: { id: photoId, user_id: share.sender_id },
  });
  return photo ? { share, photo } : null;
}

/** Recipient action (spec §29): let her own wali access this share via their own permission. */
export async function allowWaliView(opts: { shareId: bigint; recipientId: bigint }) {
  await ensurePrivatePhotosSchema();
  const share = await loadShareById(opts.shareId);
  if (!share || share.recipient_id !== opts.recipientId) throw new Error("Share not found");
  const match = await assertAcceptedParticipant(share.match_request_id, opts.recipientId);
  if (!match) throw new Error("This conversation is no longer available.");

  const profile = await prisma.profiles.findUnique({
    where: { user_id: opts.recipientId },
    select: { gender: true },
  });
  if (!(profile?.gender || "").toLowerCase().startsWith("f")) {
    throw new Error("Wali oversight applies to the sister's account only.");
  }
  const guardian = await prisma.profile_guardians.findFirst({ where: { user_id: opts.recipientId } });
  if (!guardian) throw new Error("Add your wali's contact in Profile → Edit first.");

  await prisma.private_photo_shares.update({
    where: { id: opts.shareId },
    data: { wali_allowed_at: new Date() },
  });
  await log(opts.shareId, "wali_allowed", opts.recipientId);
}

/** Finds the share (if any) a wali is currently allowed to see for this match (spec §29/§30). */
export async function waliShareForMatch(requestId: bigint, waliProfileUserId: bigint) {
  await ensurePrivatePhotosSchema();
  const share = await prisma.private_photo_shares.findFirst({
    where: { match_request_id: requestId, recipient_id: waliProfileUserId, wali_allowed_at: { not: null } },
    orderBy: { shared_at: "desc" },
  });
  if (!share) return null;
  const row = share as PrivatePhotoShareRow;
  return {
    shareId: row.id.toString(),
    status: waliStatus(row),
    secondsRemaining: waliSecondsRemaining(row),
    photoCount: row.photo_ids.length,
  };
}

/** Status of one share from the wali's point of view (only meaningful once she's allowed it). */
export async function waliShareStatus(shareId: bigint, waliProfileUserId: bigint) {
  await ensurePrivatePhotosSchema();
  const share = await loadShareById(shareId);
  if (!share || share.recipient_id !== waliProfileUserId) return null;
  return {
    status: waliStatus(share),
    secondsRemaining: waliSecondsRemaining(share),
    photoCount: share.photo_ids.length,
  };
}

/** Wali action: their own 60s session, independent of the sister's — never consumes her timer. */
export async function waliStartViewing(shareId: bigint, waliProfileUserId: bigint) {
  await ensurePrivatePhotosSchema();
  const share = await loadShareById(shareId);
  if (!share || share.recipient_id !== waliProfileUserId) throw new Error("Share not found");
  if (!share.wali_allowed_at) throw new Error("The sister hasn't allowed wali access to these photos.");
  const match = await assertAcceptedParticipant(share.match_request_id, waliProfileUserId);
  if (!match) throw new Error("This conversation is no longer available.");

  if (share.wali_viewing_started_at) {
    if (waliStatus(share) === "expired") throw new Error("This viewing session has ended.");
    return share;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + VIEW_DURATION_SEC * 1000);
  const result = await prisma.private_photo_shares.updateMany({
    where: { id: shareId, wali_viewing_started_at: null },
    data: { wali_viewing_started_at: now, wali_expires_at: expiresAt },
  });
  if (result.count === 0) {
    const fresh = await loadShareById(shareId);
    if (fresh?.wali_viewing_started_at) return fresh;
    throw new Error("This share is no longer available.");
  }
  await log(shareId, "wali_start_viewing", waliProfileUserId);
  return (await loadShareById(shareId))!;
}

export async function getWaliViewerPhotos(opts: { shareId: bigint; waliProfileUserId: bigint }) {
  await ensurePrivatePhotosSchema();
  const share = await loadShareById(opts.shareId);
  if (!share || share.recipient_id !== opts.waliProfileUserId) {
    throw new Error("Share not found");
  }
  const match = await assertAcceptedParticipant(share.match_request_id, opts.waliProfileUserId);
  if (!match) {
    await log(opts.shareId, "wali_blocked_access_attempt", opts.waliProfileUserId);
    throw new Error("This conversation is no longer available.");
  }
  const status = waliStatus(share);
  if (status !== "active") {
    if (status === "expired") await log(opts.shareId, "wali_expired_access_attempt", opts.waliProfileUserId);
    throw new Error(
      status === "shared" ? "Press Start Viewing first." : "Private photo preview ended."
    );
  }

  return {
    secondsRemaining: waliSecondsRemaining(share),
    watermark: "Wali · PRIVATE · Pashtun Nikah",
    photos: share.photo_ids.map((_, index) => ({
      index,
      url: `/api/wali/private-photos/${opts.shareId.toString()}/image/${index}`,
    })),
  };
}

/** Used by both the member and wali image routes to decide which watermark label applies. */
export async function watermarkLabelForViewer(share: PrivatePhotoShareRow, viewerId: bigint) {
  if (viewerId === share.recipient_id) {
    const code = await profileCodeOf(viewerId);
    return `${code} • PRIVATE • Pashtun Nikah`;
  }
  return "Wali · PRIVATE · Pashtun Nikah";
}
