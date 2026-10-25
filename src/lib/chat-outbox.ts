"use client";

import type { ChatMessageDTO } from "@/lib/chat";

/**
 * Device-local outbox for chat messages the server hasn't confirmed yet (C14). Survives the app
 * being closed; retried when the connection returns. The server dedupes on clientId, so a retry
 * can never deliver the same message twice.
 */
const KEY = "pn_chat_outbox_v1";

export type OutboxItem = ChatMessageDTO & { clientId: string };

function read(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — message stays in memory only */
  }
}

export function outboxFor(requestId: string): OutboxItem[] {
  return read().filter((m) => m.requestId === requestId);
}

export function outboxAll(): OutboxItem[] {
  return read();
}

export function outboxAdd(item: OutboxItem) {
  write([...read().filter((m) => m.clientId !== item.clientId), item]);
}

export function outboxRemove(clientId: string) {
  write(read().filter((m) => m.clientId !== clientId));
}

/* ---------- Drafts (K08 / C12): unsent text per conversation, kept on the device. ---------- */
// SEC-03: drafts are stored per signed-in account, so switching accounts in the same browser never
// shows the previous member's text. The old shared key couldn't be attributed, so it is dropped.
const DRAFTS_PREFIX = "pn_chat_drafts_v2:";
const LEGACY_DRAFTS_KEY = "pn_chat_drafts_v1";

function draftsKey(userId: string) {
  return `${DRAFTS_PREFIX}${userId}`;
}

export function readDrafts(userId: string): Record<string, string> {
  try {
    localStorage.removeItem(LEGACY_DRAFTS_KEY);
    return JSON.parse(localStorage.getItem(draftsKey(userId)) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveDraft(userId: string, requestId: string, text: string) {
  const all = readDrafts(userId);
  if (text.trim()) all[requestId] = text;
  else delete all[requestId];
  try {
    localStorage.setItem(draftsKey(userId), JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

/** On logout: forget this device's drafts and queued messages so the next account starts clean. */
export function clearChatDeviceState() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DRAFTS_PREFIX) || key === LEGACY_DRAFTS_KEY || key === KEY) localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable — nothing stored */
  }
}
