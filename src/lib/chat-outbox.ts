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
const DRAFTS_KEY = "pn_chat_drafts_v1";

export function readDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveDraft(requestId: string, text: string) {
  const all = readDrafts();
  if (text.trim()) all[requestId] = text;
  else delete all[requestId];
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}
