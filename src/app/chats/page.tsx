import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { listThreadsForUser } from "@/lib/chat";
import { userTopic } from "@/lib/realtime-topics";
import { ChatApp } from "@/components/chat/chat-app";

export const dynamic = "force-dynamic";

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sub?: string; request?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Account created but profile not finished yet — carry on with onboarding.
  if (!(await prisma.profiles.findUnique({ where: { user_id: BigInt(session.userId) }, select: { id: true } }))) {
    redirect("/signup");
  }
  const { tab, sub, request } = await searchParams;

  const threads = await listThreadsForUser(BigInt(session.userId));
  const unreadCount = threads.reduce((sum, t) => sum + t.unread, 0);
  return (
    <ChatApp
      initialThreads={threads}
      userId={session.userId}
      profileCode={session.profileCode}
      unreadCount={unreadCount}
      userRealtimeTopic={userTopic(session.userId)}
      initialInboxTab={tab === "requests" ? "requests" : "chats"}
      initialRequestSub={sub === "sent" ? "sent" : "received"}
      initialOpenRequestId={tab === "requests" && request && /^\d+$/.test(request) ? request : null}
    />
  );
}
