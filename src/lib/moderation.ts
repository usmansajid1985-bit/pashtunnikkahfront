import { prisma } from "@/lib/prisma";
import { geminiJson } from "@/lib/gemini";
import { inspectLeak } from "@/lib/chat-safety";

export class ChatBlockedError extends Error {
  constructor(
    message = "That message wasn't sent. Sharing numbers, emails, social media, or dating-app links isn't allowed here — you can keep chatting otherwise."
  ) {
    super(message);
    this.name = "ChatBlockedError";
  }
}

const CONTACT_PATTERNS: { reason: string; re: RegExp }[] = [
  { reason: "phone", re: /(?:\+?\d[\d\s().-]{7,}\d)/ },
  { reason: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
];

export function filterMessageBody(raw: string) {
  let filtered = raw;
  const reasons: string[] = [];
  for (const { reason, re } of CONTACT_PATTERNS) {
    if (re.test(filtered)) {
      if (!reasons.includes(reason)) reasons.push(reason);
      filtered = filtered.replace(re, "[filtered]");
    }
  }
  return {
    original: raw,
    filtered,
    flagged: reasons.length > 0,
    reason: reasons.join(",") || "",
  };
}

type GeminiScreen = {
  action?: "allow" | "redact" | "block";
  categories?: string[];
  reason?: string;
};

async function loadWatch(userId: bigint, requestId: bigint) {
  const rows = await prisma.$queryRaw<
    { buffer: string; remaining: number; use_ai: boolean }[]
  >`
    SELECT buffer, remaining, use_ai FROM chat_leak_watch
    WHERE user_id = ${userId} AND request_id = ${requestId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function saveWatch(opts: {
  userId: bigint;
  requestId: bigint;
  buffer: string;
  remaining: number;
  useAi: boolean;
}) {
  await prisma.$executeRaw`
    INSERT INTO chat_leak_watch (user_id, request_id, buffer, remaining, use_ai, updated_at)
    VALUES (${opts.userId}, ${opts.requestId}, ${opts.buffer}, ${opts.remaining}, ${opts.useAi}, NOW())
    ON CONFLICT (user_id, request_id)
    DO UPDATE SET buffer = EXCLUDED.buffer, remaining = EXCLUDED.remaining, use_ai = EXCLUDED.use_ai, updated_at = NOW()
  `;
}

async function noteFilteredMessage(opts: {
  userId: bigint;
  requestId: bigint;
  words: string;
  reason: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO chat_warnings (id, user_id, request_id, words, reason, warning_number, created_at)
    SELECT COALESCE(MAX(id), 0) + 1, ${opts.userId}, ${opts.requestId}, ${opts.words.slice(0, 2000)}, ${opts.reason.slice(0, 80)}, 0, NOW()
    FROM chat_warnings
  `.catch(() => undefined);
}

export async function screenOutgoingMessage(opts: {
  senderId: bigint;
  requestId: bigint;
  body: string;
}) {
  const watch = await loadWatch(opts.senderId, opts.requestId).catch(() => null);
  const prior = (watch?.buffer || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(-7);
  const current = inspectLeak([opts.body]);
  const watching = current.suspect;
  const combined = watching && prior.length ? inspectLeak([...prior, opts.body]) : current;

  let hit = current.hit || (current.suspect && combined.hit);
  let reasons = hit ? (current.hit ? current.reasons : combined.reasons) : [];

  const allowAi = watch?.use_ai !== false && !hit && current.suspect;
  if (allowAi) {
    const ai = await geminiJson<GeminiScreen>({
      timeoutMs: 2500,
      system: `You check if these chat fragments are trying to share a phone number, email, social handle/link, dating-app profile, or abuse — including split across messages. Block Instagram, TikTok, Snapchat, Facebook, WhatsApp, Telegram, Discord, Twitter/X, YouTube, and dating apps (Tinder, Bumble, Hinge, Muzmatch/Muzz, Salams, Shaadi, Badoo, Grindr, etc.). Return JSON {"action":"allow"|"block","categories":["phone"|"email"|"social"|"dating_app"|"abuse"],"reason":"short"}.`,
      user: [...prior, opts.body].join("\n---\n").slice(0, 3000),
    });
    if (ai?.action === "block") {
      hit = true;
      reasons = [...new Set([...reasons, ...((ai.categories || []).map((c) => c.toLowerCase()))])];
    }
  }

  if (hit) {
    await noteFilteredMessage({
      userId: opts.senderId,
      requestId: opts.requestId,
      words: opts.body,
      reason: reasons.join(",") || "contact",
    });
    await saveWatch({
      userId: opts.senderId,
      requestId: opts.requestId,
      buffer: prior.join("\n").slice(-2000),
      remaining: 0,
      useAi: false,
    }).catch(() => undefined);
    throw new ChatBlockedError();
  }

  if (watching) {
    await saveWatch({
      userId: opts.senderId,
      requestId: opts.requestId,
      buffer: [...prior, opts.body].slice(-8).join("\n").slice(-2000),
      remaining: Math.max(0, (watch?.remaining ?? 6) - 1),
      useAi: false,
    }).catch(() => undefined);
  }

  return { original: opts.body, filtered: opts.body, flagged: false, reason: "" };
}

async function nextId(table: "moderation_log" | "reports" | "flagged_messages" | "admin_notes" | "announcements" | "user_events") {
  if (table === "moderation_log") {
    const max = await prisma.moderation_log.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }
  if (table === "reports") {
    const max = await prisma.reports.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }
  if (table === "flagged_messages") {
    const max = await prisma.flagged_messages.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }
  if (table === "admin_notes") {
    const max = await prisma.admin_notes.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }
  if (table === "announcements") {
    const max = await prisma.announcements.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }
  const max = await prisma.user_events.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function logModeration(opts: {
  userId?: bigint | null;
  action: string;
  note?: string | null;
}) {
  return prisma.moderation_log.create({
    data: {
      id: await nextId("moderation_log"),
      user_id: opts.userId ?? null,
      action: opts.action,
      note: opts.note ?? null,
      created_at: new Date(),
    },
  });
}

export async function createReport(opts: {
  reporterId: bigint;
  reportedId: bigint;
  reason: string;
}) {
  return prisma.reports.create({
    data: {
      id: await nextId("reports"),
      reporter_id: opts.reporterId,
      reported_id: opts.reportedId,
      reason: opts.reason.slice(0, 2000),
      status: "open",
      created_at: new Date(),
    },
  });
}

export async function recordFlaggedMessage(opts: {
  messageId: bigint;
  requestId: bigint;
  senderId: bigint;
  receiverId: bigint;
  original: string;
  filtered: string;
  reason: string;
}) {
  return prisma.flagged_messages.create({
    data: {
      id: await nextId("flagged_messages"),
      message_id: opts.messageId,
      request_id: opts.requestId,
      sender_id: opts.senderId,
      receiver_id: opts.receiverId,
      original_text: opts.original,
      filtered_text: opts.filtered,
      reason: opts.reason.slice(0, 50),
      flagged_at: new Date(),
      reviewed: false,
    },
  });
}

export async function addAdminNote(opts: {
  userId: bigint;
  adminId: bigint;
  note: string;
}) {
  return prisma.admin_notes.create({
    data: {
      id: await nextId("admin_notes"),
      user_id: opts.userId,
      admin_id: opts.adminId,
      note_text: opts.note.slice(0, 4000),
      created_at: new Date(),
    },
  });
}

export async function nextAnnouncementId() {
  return nextId("announcements");
}

export async function recordUserEvent(opts: {
  userId: bigint;
  type: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.user_events.create({
    data: {
      id: await nextId("user_events"),
      user_id: opts.userId,
      type: opts.type.slice(0, 40),
      payload: opts.payload ? (opts.payload as object) : undefined,
      created_at: new Date(),
    },
  });
}
