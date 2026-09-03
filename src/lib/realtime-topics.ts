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

export function userTopic(userId: string) {
  const raw = `user:${userId}`;
  return `${raw}:${signTopic(raw)}`;
}
