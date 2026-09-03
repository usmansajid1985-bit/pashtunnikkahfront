"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseRealtimeBrowser } from "@/lib/supabase-realtime-browser";
import type { ChatMessageDTO, ReactionSummary } from "@/lib/chat";

/** Every event name a chat thread or user channel can carry — kept in sync with the broadcastChat
 * call sites in src/app/api/chats/** and the client-side typing broadcast below. */
const CHAT_EVENTS = [
  "message:new",
  "messages:read",
  "typing",
  "inbox:update",
  "photo:update",
  "reaction:update",
  "photo-once:update",
] as const;

type Listener = () => void;
type EventHandler = (payload: unknown) => void;

/** One realtime manager per tab — mirrors the old "one shared socket" model, now backed by
 * Supabase Realtime channels instead of a single socket.io connection. */
class RealtimeManager {
  private userChannel: RealtimeChannel | null = null;
  private userChannelTopic: string | null = null;
  private threadChannels = new Map<string, RealtimeChannel>();
  private topicByRequestId = new Map<string, string>();
  private subscribedKeys = new Set<string>();
  private listeners = new Set<Listener>();
  private eventBus = new Map<string, Set<EventHandler>>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  isConnected() {
    return this.subscribedKeys.size > 0;
  }

  private emitChange() {
    for (const fn of this.listeners) fn();
  }

  private dispatch(event: string, payload: unknown) {
    const handlers = this.eventBus.get(event);
    if (!handlers) return;
    for (const h of handlers) h(payload);
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventBus.has(event)) this.eventBus.set(event, new Set());
    this.eventBus.get(event)!.add(handler);
    return () => {
      this.eventBus.get(event)?.delete(handler);
    };
  }

  private attachEvents(channel: RealtimeChannel) {
    for (const event of CHAT_EVENTS) {
      channel.on("broadcast", { event }, ({ payload }: { payload: unknown }) => {
        this.dispatch(event, payload);
      });
    }
    return channel;
  }

  private subscribeChannel(key: string, channel: RealtimeChannel): Promise<boolean> {
    return new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.subscribedKeys.add(key);
          this.emitChange();
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          this.subscribedKeys.delete(key);
          this.emitChange();
          resolve(false);
        }
      });
    });
  }

  async joinUser(topic: string): Promise<boolean> {
    if (!topic) return false;
    if (this.userChannelTopic === topic && this.subscribedKeys.has("user")) return true;
    if (this.userChannel) {
      void supabaseRealtimeBrowser().removeChannel(this.userChannel);
      this.subscribedKeys.delete("user");
    }
    this.userChannelTopic = topic;
    const channel = this.attachEvents(supabaseRealtimeBrowser().channel(topic));
    this.userChannel = channel;
    return this.subscribeChannel("user", channel);
  }

  async joinThread(requestId: string, topic?: string): Promise<boolean> {
    const resolvedTopic = topic || this.topicByRequestId.get(requestId);
    if (!resolvedTopic) return false;

    const existing = this.threadChannels.get(requestId);
    if (existing && this.topicByRequestId.get(requestId) === resolvedTopic && this.subscribedKeys.has(`thread:${requestId}`)) {
      return true;
    }
    if (existing) {
      void supabaseRealtimeBrowser().removeChannel(existing);
      this.subscribedKeys.delete(`thread:${requestId}`);
    }

    this.topicByRequestId.set(requestId, resolvedTopic);
    const channel = this.attachEvents(supabaseRealtimeBrowser().channel(resolvedTopic));
    this.threadChannels.set(requestId, channel);
    return this.subscribeChannel(`thread:${requestId}`, channel);
  }

  leaveThread(requestId: string) {
    const channel = this.threadChannels.get(requestId);
    if (!channel) return;
    void supabaseRealtimeBrowser().removeChannel(channel);
    this.threadChannels.delete(requestId);
    this.subscribedKeys.delete(`thread:${requestId}`);
    this.emitChange();
  }

  sendTyping(requestId: string, payload: unknown) {
    const channel = this.threadChannels.get(requestId);
    if (!channel || !this.subscribedKeys.has(`thread:${requestId}`)) return;
    void channel.send({ type: "broadcast", event: "typing", payload });
  }
}

const realtimeManager = new RealtimeManager();

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

export function useChatSocket(enabled = true, userId?: string) {
  const connected = useSyncExternalStore(
    (cb) => {
      if (!enabled) return () => {};
      return realtimeManager.subscribe(cb);
    },
    () => (enabled ? realtimeManager.isConnected() : false),
    () => false
  );
  const userIdRef = useRef<string | null>(userId ?? null);
  userIdRef.current = userId ?? null;

  const joinUser = useCallback(async (topic: string) => {
    return realtimeManager.joinUser(topic);
  }, []);

  const joinThread = useCallback(async (requestId: string, topic?: string) => {
    return realtimeManager.joinThread(requestId, topic);
  }, []);

  const leaveThread = useCallback((requestId: string) => {
    realtimeManager.leaveThread(requestId);
  }, []);

  const sendMessage = useCallback(
    async (payload: {
      requestId: string;
      body: string;
      replyToId?: string | null;
      clientId: string;
    }) => {
      try {
        const { ok, data } = await postJson(`/api/chats/${payload.requestId}`, {
          body: payload.body,
          replyToId: payload.replyToId ?? null,
          clientId: payload.clientId,
        });
        if (ok && data?.message) {
          return { ok: true as const, message: data.message as ChatMessageDTO };
        }
        if (data?.warning) {
          return { ok: false as const, warning: true as const, error: data.error || "That message wasn't sent." };
        }
        return { ok: false as const, offline: true as const };
      } catch {
        return { ok: false as const, offline: true as const };
      }
    },
    []
  );

  const emitTyping = useCallback((requestId: string, typing: boolean) => {
    realtimeManager.sendTyping(requestId, {
      requestId,
      userId: userIdRef.current,
      typing,
    });
  }, []);

  const markRead = useCallback((requestId: string) => {
    void postJson(`/api/chats/${requestId}/read`);
  }, []);

  const toggleReaction = useCallback(
    async (requestId: string, messageId: string, emoji: string): Promise<ReactionSummary | null> => {
      try {
        const { ok, data } = await postJson(`/api/chats/${requestId}/reactions`, { messageId, emoji });
        return ok && data?.reactions ? (data.reactions as ReactionSummary) : null;
      } catch {
        return null;
      }
    },
    []
  );

  const sendContactCard = useCallback(async (requestId: string) => {
    try {
      const { ok, data } = await postJson(`/api/chats/${requestId}/contact-card`);
      return ok && data?.message ? { message: data.message as ChatMessageDTO } : { error: data?.error };
    } catch {
      return { error: "offline" };
    }
  }, []);

  const on = useCallback((event: string, handler: (payload: never) => void) => {
    return realtimeManager.on(event, handler as EventHandler);
  }, []);

  return {
    connected,
    joinUser,
    joinThread,
    leaveThread,
    sendMessage,
    emitTyping,
    markRead,
    toggleReaction,
    sendContactCard,
    on,
  };
}
