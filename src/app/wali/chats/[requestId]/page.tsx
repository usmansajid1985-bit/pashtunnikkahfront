import Link from "next/link";
import { getWaliSession } from "@/lib/wali";
import { assertAcceptedParticipant, loadPeer, peerUserId, serializeMessage, threadMetaFor } from "@/lib/chat";
import { threadTopic } from "@/lib/realtime-topics";
import { prisma } from "@/lib/prisma";
import { WaliHeader } from "@/components/wali/wali-header";
import { WaliChatView } from "@/components/wali/wali-chat-view";

export const dynamic = "force-dynamic";

export default async function WaliChatThreadPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await getWaliSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">This wali access link is invalid or has been revoked.</p>
      </div>
    );
  }

  const { requestId: raw } = await params;
  const requestId = BigInt(raw);
  const profileUserId = BigInt(session.profileUserId);

  const req = await assertAcceptedParticipant(requestId, profileUserId);
  if (!req) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">Chat not found.</p>
      </div>
    );
  }

  const peerId = await peerUserId(req, profileUserId);
  const peer = await loadPeer(peerId);
  const meta = await threadMetaFor(req, profileUserId);

  const rows = meta.privateChat
    ? await prisma.messages.findMany({
        where: { request_id: requestId },
        orderBy: { created_at: "asc" },
        take: 400,
      })
    : [];

  const replyIds = [...new Set(rows.map((m) => m.reply_to_id).filter(Boolean))] as bigint[];
  const quoted =
    replyIds.length > 0
      ? await prisma.messages.findMany({
          where: { id: { in: replyIds } },
          select: { id: true, body: true, sender_id: true },
        })
      : [];
  const quoteMap = new Map(quoted.map((q) => [q.id.toString(), q]));

  const messages = rows.map((m) =>
    serializeMessage(m, m.reply_to_id ? quoteMap.get(m.reply_to_id.toString()) ?? null : null)
  );

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900">
      <WaliHeader watchingName={peer?.name || "Chat"} />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <Link href="/wali" className="inline-flex items-center gap-1 text-sm text-ink-700/60 hover:text-ink-900">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to chats
          </Link>
          <Link href={`/wali/chats/${raw}/profile`} className="text-sm font-semibold text-rose-600 hover:text-rose-700">
            View {peer?.name?.split(" ")[0] || "member"}&apos;s full profile →
          </Link>
        </div>
        <WaliChatView
          requestId={raw}
          profileUserId={session.profileUserId}
          peerName={peer?.name || "Member"}
          peerCode={peer?.code || ""}
          privateChat={meta.privateChat}
          initialMessages={messages}
          realtimeTopic={threadTopic(raw)}
        />
      </div>
    </div>
  );
}
