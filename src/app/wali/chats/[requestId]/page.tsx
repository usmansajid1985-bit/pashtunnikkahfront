import { getWaliSession } from "@/lib/wali";
import { assertMatchParticipant, conversationRows, getReactionsForMessages, loadPeer, loadPeerProfileView, peerUserId, serializeMessage } from "@/lib/chat";
import { withPeerPhotoUrls } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import { isBlockedBetween } from "@/lib/blocking";
import { WaliHeader } from "@/components/wali/wali-header";
import { WaliChatView } from "@/components/wali/wali-chat-view";
import { profileCodeOf } from "@/lib/notifications";
import { logWaliConversationView } from "@/lib/wali-activity";
import { WaliPrivatePhoto } from "@/components/wali/wali-private-photo";

export const dynamic = "force-dynamic";

export default async function WaliChatThreadPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await getWaliSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">This wali access link is invalid or has been revoked.</p>
      </div>
    );
  }

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const profileUserId = BigInt(session.profileUserId);

  // Read-only gate: accepted chats are "Live", ended chats stay readable (the member and her wali
  // can both still read an ended conversation; only new messages stop). The old write-gate here
  // rejected every ended chat as "Chat not found" even though it appears in the wali's list.
  const req = await assertMatchParticipant(requestId, profileUserId);
  if (!req) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">Chat not found.</p>
      </div>
    );
  }

  const peerId = await peerUserId(req, profileUserId);
  // A block (either way) ends wali oversight of that conversation too — old links / open tabs
  // must not keep showing it.
  if (await isBlockedBetween(profileUserId, peerId)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">This conversation is no longer available.</p>
      </div>
    );
  }
  const [peer, wardCode] = await Promise.all([loadPeer(peerId), profileCodeOf(profileUserId)]);
  // W09: the sister can see when her wali read which conversation.
  await logWaliConversationView(
    profileUserId,
    BigInt(session.linkId),
    requestId,
    `${session.name} viewed ${wardCode}'s conversation with ${peer?.code ?? "a match"}`
  );

  // One continuous conversation across the pair's original match and any rematches (Tweaks p1–5).
  const conv = await conversationRows(requestId).catch(() => null);
  const conversationIds = conv?.ids ?? [requestId];
  // Live messages arrive on the conversation's current match id (after a rematch, a newer row).
  const liveId = (conv?.current.id ?? requestId).toString();
  const rows = await prisma.messages.findMany({
    where: { request_id: { in: conversationIds } },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: 400,
  });

  const replyIds = [...new Set(rows.map((m) => m.reply_to_id).filter(Boolean))] as bigint[];
  const quoted =
    replyIds.length > 0
      ? await prisma.messages.findMany({
          where: { id: { in: replyIds } },
          select: { id: true, body: true, sender_id: true },
        })
      : [];
  const quoteMap = new Map(quoted.map((q) => [q.id.toString(), q]));

  // PN-AUD-001: the wali sees the same message reactions as the member (read-only).
  const reactionsMap = await getReactionsForMessages(rows.map((m) => m.id));
  const messages = rows.map((m) =>
    serializeMessage(
      m,
      m.reply_to_id ? quoteMap.get(m.reply_to_id.toString()) ?? null : null,
      undefined,
      reactionsMap.get(m.id.toString()) ?? []
    )
  );

  // Profile tab: the match's full profile, by ID only (N46 — his name never reaches the wali).
  const rawProfile = await loadPeerProfileView(peerId);
  const peerProfile = rawProfile
    ? { ...(await withPeerPhotoUrls(rawProfile)), fullName: rawProfile.profileCode }
    : null;
  const peerAvatarUrl =
    peerProfile?.photoUrl || `https://i.pravatar.cc/120?img=${((peer?.avatarSeed ?? 0) % 70) + 1}`;

  return (
    <div className="min-h-screen bg-white text-ink-900">
      {/* Desktop keeps the wali bar (Exit); on phones the chat is full-screen like a member's. */}
      <div className="hidden lg:block">
        <WaliHeader wardCode={wardCode} />
      </div>
      <WaliChatView
        requestId={liveId}
        profileUserId={session.profileUserId}
        peerName={peer?.name || "Member"}
        peerCode={peer?.code || ""}
        wardCode={wardCode}
        initialMessages={messages}
        ended={(conv?.current.status ?? req.status) === "ended"}
        peerAvatarUrl={peerAvatarUrl}
        peerStatusLabel={peer?.lastSeenLabel}
        peerProfile={peerProfile}
        backHref="/wali"
        photoSlot={<WaliPrivatePhoto requestId={raw} peerCode={peer?.code || "Member"} />}
      />
    </div>
  );
}
