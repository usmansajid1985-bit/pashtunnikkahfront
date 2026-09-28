import { createHmac } from "crypto";

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

/** Unguessable suffix for a realtime topic — only ever handed to callers who already passed a participant check. */
export function signTopic(raw: string) {
  return createHmac("sha256", authSecret()).update(raw).digest("hex").slice(0, 24);
}

export function threadTopic(requestId: string) {
  const raw = `thread:${requestId}`;
  return `${raw}:${signTopic(raw)}`;
}

/** Per-wali-link topic. The server only broadcasts to links that are still active, so revoking
 * a link cuts off live messages even though the old topic name is still known to that browser. */
export function waliTopic(linkId: string) {
  const raw = `wali:${linkId}`;
  return `${raw}:${signTopic(raw)}`;
}

/** S03/S04: one shared Browse topic — carries only "member X left/returned to Browse" events.
 * Handed to signed-in members by the Browse page. */
export function browseTopic() {
  const raw = "browse:all";
  return `${raw}:${signTopic(raw)}`;
}

export function userTopic(userId: string) {
  const raw = `user:${userId}`;
  return `${raw}:${signTopic(raw)}`;
}
