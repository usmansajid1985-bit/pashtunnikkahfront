import { supabaseRealtimeAdmin } from "./supabase-realtime-admin";
import { prisma } from "./prisma";
import { threadTopic, userTopic, waliTopic } from "./realtime-topics";

function topicForRoom(room: string): string | null {
  if (room.startsWith("thread:")) return threadTopic(room.slice("thread:".length));
  if (room.startsWith("user:")) return userTopic(room.slice("user:".length));
  if (room.startsWith("wali:")) return waliTopic(room.slice("wali:".length));
  return null;
}

export function broadcastChat(event: string, rooms: string[], payload: unknown) {
  const client = supabaseRealtimeAdmin();
  if (!client) return;
  for (const room of rooms) {
    const topic = topicForRoom(room);
    if (!topic) continue;
    const channel = client.channel(topic);
    void channel
      .httpSend(event, payload)
      .catch(() => {})
      .finally(() => void client.removeChannel(channel));
  }
}

/** Fan a thread event out to every *currently active* wali link of either participant. Checked
 * at send time, so a revoked wali stops receiving live content immediately (W07). */
export async function broadcastToWalis(event: string, requestId: bigint, payload: unknown) {
  const req = await prisma.match_requests.findUnique({
    where: { id: requestId },
    select: { sender_id: true, receiver_id: true },
  });
  if (!req) return;
  const links = await prisma.wali_links.findMany({
    where: { user_id: { in: [req.sender_id, req.receiver_id] }, revoked_at: null },
    select: { id: true },
  });
  if (links.length === 0) return;
  broadcastChat(event, links.map((l) => `wali:${l.id.toString()}`), payload);
}
