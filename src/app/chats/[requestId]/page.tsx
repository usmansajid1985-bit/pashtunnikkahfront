import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listThreadsForUser } from "@/lib/chat";
import { userTopic } from "@/lib/realtime-topics";
import { ChatApp } from "@/components/chat/chat-app";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { requestId } = await params;
  const threads = await listThreadsForUser(BigInt(session.userId));

  // SEC-01: only render chat controls for a conversation this member is part of. The APIs already
  // refuse other chats, but the shell used to show "Matched", a composer and End match anyway.
  if (!threads.some((t) => t.requestId === requestId)) {
    return (
      <main className="min-h-dvh bg-[#f7f4f2] flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-ink-950">Chat unavailable</h1>
          <p className="mt-2 text-sm text-ink-700/70 leading-relaxed">
            This conversation doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link
            href="/chats"
            className="mt-6 inline-flex px-6 py-3 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
          >
            Back to chats
          </Link>
        </div>
      </main>
    );
  }

  const unreadCount = threads.reduce((sum, t) => sum + t.unread, 0);
  return (
    <ChatApp
      initialThreads={threads}
      userId={session.userId}
      profileCode={session.profileCode}
      initialRequestId={requestId}
      unreadCount={unreadCount}
      userRealtimeTopic={userTopic(session.userId)}
    />
  );
}
