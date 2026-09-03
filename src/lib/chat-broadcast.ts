import { supabaseRealtimeAdmin } from "./supabase-realtime-admin";
import { threadTopic, userTopic } from "./realtime-topics";

function topicForRoom(room: string): string | null {
  if (room.startsWith("thread:")) return threadTopic(room.slice("thread:".length));
  if (room.startsWith("user:")) return userTopic(room.slice("user:".length));
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
