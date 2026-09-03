import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listThreadsForUser } from "@/lib/chat";
import { userTopic } from "@/lib/realtime-topics";
import { ChatApp } from "@/components/chat/chat-app";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const threads = await listThreadsForUser(BigInt(session.userId));
  const unreadCount = threads.reduce((sum, t) => sum + t.unread, 0);
  return (
    <ChatApp
      initialThreads={threads}
      userId={session.userId}
      profileCode={session.profileCode}
      unreadCount={unreadCount}
      userRealtimeTopic={userTopic(session.userId)}
    />
  );
}
