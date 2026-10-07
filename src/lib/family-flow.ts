import { prisma } from "@/lib/prisma";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";
import { ensureMatchRequestsSchema } from "@/lib/ensure-match-requests-schema";
import { isBlockedBetween } from "@/lib/blocking";
import { broadcastChat, broadcastToWalis } from "@/lib/chat-broadcast";
import { createNotification } from "@/lib/notifications";
import { sendPushNotification } from "@/lib/push/server";

/**
 * Involve Family — ONE state machine for a match, whichever way it is started.
 *
 *   (nothing) ──request (brother)──▶ pending ──share (sister)──▶ shared ──contacted (brother)──▶ contacted
 *                                       │
 *                                       └──decline (sister)──▶ declined (cooldown, then he may ask again)
 *   (nothing) ──share (sister, unprompted)──▶ shared
 *
 * The Family icon (manual) and the automatic reminder are only two entry points to the same
 * `request` / `share` actions. Every transition is a single conditional UPDATE, so duplicate taps
 * and both members acting at the same moment can never produce two requests or two wali cards.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/* ───────────────────────────── schema ───────────────────────────── */

let ensured = false;

export async function ensureFamilySchema() {
  if (ensured) return;
  await Promise.all([ensureBrowseAndWaliSchema(), ensureMatchRequestsSchema()]);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE match_requests
        ADD COLUMN IF NOT EXISTS family_request_state VARCHAR(16),
        ADD COLUMN IF NOT EXISTS family_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_requested_via VARCHAR(8),
        ADD COLUMN IF NOT EXISTS family_declined_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_shared_via VARCHAR(8),
        ADD COLUMN IF NOT EXISTS family_contact_action_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_contact_not_yet_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS family_contact_not_yet_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_auto_eligible_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_auto_cancelled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_auto_dismiss_sender INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS family_auto_dismissed_sender_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_auto_final_sender_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_auto_dismiss_receiver INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS family_auto_dismissed_receiver_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_auto_final_receiver_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS family_force_eligible BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE profile_guardians ADD COLUMN IF NOT EXISTS relation VARCHAR(64)`
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS family_flow_settings (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureFamilySchema", err);
  }
}

/* ───────────────────────────── settings (admin-editable) ───────────────────────────── */

export type FamilySettings = {
  minDaysMatched: number;
  minTotalMessages: number;
  minMessagesEach: number;
  minActiveDaysEach: number;
  recentActivityHours: number;
  finalReminderAfterDays: number;
  requestCooldownDays: number;
  contactPromptAfterHours: number;
  contactFollowupAfterDays: number;
  /** `{code}` is replaced with the other member's profile ID. */
  pushTitle: string;
  pushBody: string;
  finalPushTitle: string;
  finalPushBody: string;
};

// Keep in sync with admin/src/app/settings/family-settings.ts (the admin editor's defaults).
export const FAMILY_DEFAULTS: FamilySettings = {
  minDaysMatched: 6,
  minTotalMessages: 55,
  minMessagesEach: 18,
  minActiveDaysEach: 3,
  recentActivityHours: 48,
  finalReminderAfterDays: 7,
  requestCooldownDays: 7,
  contactPromptAfterHours: 24,
  contactFollowupAfterDays: 3,
  pushTitle: "Ready to involve family? ❤️",
  pushBody: "You've been getting to know {code} for a while. Take the next step when you're ready.",
  finalPushTitle: "Still getting to know {code}? ❤️",
  finalPushBody: "If things are progressing, you can involve family whenever you're ready.",
};

let settingsCache: { at: number; value: FamilySettings } | null = null;

export async function getFamilySettings(): Promise<FamilySettings> {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.value;
  await ensureFamilySchema();
  const rows = await prisma
    .$queryRawUnsafe<{ data: Record<string, unknown> | null }[]>(
      `SELECT data FROM family_flow_settings WHERE id = 1`
    )
    .catch(() => []);
  const data = rows[0]?.data ?? {};
  const value = { ...FAMILY_DEFAULTS };
  for (const key of Object.keys(FAMILY_DEFAULTS) as (keyof FamilySettings)[]) {
    const raw = data[key];
    if (typeof FAMILY_DEFAULTS[key] === "number") {
      const n = Number(raw);
      if (raw != null && raw !== "" && Number.isFinite(n) && n >= 0) (value[key] as number) = n;
    } else if (typeof raw === "string" && raw.trim()) {
      (value[key] as string) = raw.trim();
    }
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

/* ───────────────────────────── row + participants ───────────────────────────── */

type Row = {
  id: bigint;
  sender_id: bigint;
  receiver_id: bigint;
  status: string;
  matched_at: Date;
  wali_details_shared_at: Date | null;
  wali_contact_attempted_at: Date | null;
  wali_contact_confirmed_at: Date | null;
  family_request_state: string | null;
  family_requested_at: Date | null;
  family_declined_at: Date | null;
  family_contact_action_at: Date | null;
  family_contact_not_yet_count: number;
  family_contact_not_yet_at: Date | null;
  family_auto_eligible_at: Date | null;
  family_auto_cancelled_at: Date | null;
  family_auto_dismiss_sender: number;
  family_auto_dismissed_sender_at: Date | null;
  family_auto_final_sender_at: Date | null;
  family_auto_dismiss_receiver: number;
  family_auto_dismissed_receiver_at: Date | null;
  family_auto_final_receiver_at: Date | null;
  family_force_eligible: boolean;
};

const ROW_SQL = `
  SELECT id, sender_id, receiver_id, status, COALESCE(accepted_at, created_at) AS matched_at,
         wali_details_shared_at, wali_contact_attempted_at, wali_contact_confirmed_at,
         family_request_state, family_requested_at, family_declined_at,
         family_contact_action_at, family_contact_not_yet_count, family_contact_not_yet_at,
         family_auto_eligible_at, family_auto_cancelled_at,
         family_auto_dismiss_sender, family_auto_dismissed_sender_at, family_auto_final_sender_at,
         family_auto_dismiss_receiver, family_auto_dismissed_receiver_at, family_auto_final_receiver_at,
         family_force_eligible
  FROM match_requests`;

async function loadRow(requestId: bigint): Promise<Row | null> {
  await ensureFamilySchema();
  const rows = await prisma.$queryRawUnsafe<Row[]>(`${ROW_SQL} WHERE id = $1 LIMIT 1`, requestId);
  return rows[0] ?? null;
}

type Pair = {
  maleId: bigint | null;
  femaleId: bigint | null;
  codes: Map<string, string>;
};

async function loadPair(row: { sender_id: bigint; receiver_id: bigint }): Promise<Pair> {
  const profiles = await prisma.profiles.findMany({
    where: { user_id: { in: [row.sender_id, row.receiver_id] } },
    select: { user_id: true, gender: true, profile_code: true },
  });
  const female = profiles.find((p) => (p.gender || "").toLowerCase().startsWith("f")) ?? null;
  const male = profiles.find((p) => p.user_id !== female?.user_id) ?? null;
  return {
    femaleId: female?.user_id ?? null,
    maleId: female && male ? male.user_id : null,
    codes: new Map(profiles.map((p) => [p.user_id.toString(), p.profile_code || "your match"])),
  };
}

export type WaliDetails = {
  name: string;
  relation: string | null;
  contact: string | null;
  email: string | null;
};

/** The sister's saved wali contact — only ever the guardian record, never her own phone. */
export async function loadWaliDetails(femaleUserId: bigint): Promise<WaliDetails | null> {
  await ensureFamilySchema();
  const rows = await prisma.$queryRawUnsafe<
    { name: string | null; relation: string | null; contact: string | null; email: string | null }[]
  >(
    `SELECT name, relation, contact, email FROM profile_guardians WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
    femaleUserId
  );
  const g = rows[0];
  if (!g) return null;
  return {
    name: g.name || "Wali",
    relation: g.relation || null,
    contact: g.contact || null,
    email: g.email || null,
  };
}

function announce(row: { id: bigint; sender_id: bigint; receiver_id: bigint }) {
  const id = row.id.toString();
  broadcastChat(
    "family:update",
    [`thread:${id}`, `user:${row.sender_id.toString()}`, `user:${row.receiver_id.toString()}`],
    { requestId: id }
  );
}

/* ───────────────────────────── view ───────────────────────────── */

export type FamilyCard =
  | "incoming_request"
  | "auto_first"
  | "auto_final"
  | "contact_prompt"
  | "contact_followup"
  | null;

export type FamilyView = {
  role: "male" | "female";
  peerCode: string;
  shared: boolean;
  sharedAt: string | null;
  contacted: boolean;
  contactedAt: string | null;
  request: {
    state: "pending" | "declined" | null;
    requestedAt: string | null;
    declinedAt: string | null;
    /** Brother only: when he may ask again after a "Not now". Null = he can ask now. */
    canRequestAt: string | null;
  };
  /** Her own wali for the confirmation preview; his copy only once she has shared it. */
  wali: WaliDetails | null;
  card: FamilyCard;
};

function sideOf(row: Row, userId: bigint): "sender" | "receiver" {
  return row.sender_id === userId ? "sender" : "receiver";
}

function autoState(row: Row, side: "sender" | "receiver") {
  return side === "sender"
    ? {
        dismissed: row.family_auto_dismiss_sender,
        dismissedAt: row.family_auto_dismissed_sender_at,
        finalAt: row.family_auto_final_sender_at,
      }
    : {
        dismissed: row.family_auto_dismiss_receiver,
        dismissedAt: row.family_auto_dismissed_receiver_at,
        finalAt: row.family_auto_final_receiver_at,
      };
}

function contactedAtOf(row: Row) {
  return row.wali_contact_confirmed_at ?? row.wali_contact_attempted_at;
}

function cardFor(row: Row, role: "male" | "female", side: "sender" | "receiver", s: FamilySettings): FamilyCard {
  const now = Date.now();
  const shared = Boolean(row.wali_details_shared_at);

  if (role === "female" && !shared && row.family_request_state === "pending") return "incoming_request";

  if (role === "male" && shared && !contactedAtOf(row)) {
    const sharedAt = row.wali_details_shared_at!.getTime();
    if (row.family_contact_not_yet_count === 0) {
      // 24h after sharing — or sooner once he has used WhatsApp / Email / Copy, but never
      // straight after the tap.
      let due = sharedAt + s.contactPromptAfterHours * HOUR_MS;
      if (row.family_contact_action_at) due = Math.min(due, row.family_contact_action_at.getTime() + HOUR_MS);
      if (now >= due) return "contact_prompt";
    } else if (row.family_contact_not_yet_count === 1 && row.family_contact_not_yet_at) {
      if (now >= row.family_contact_not_yet_at.getTime() + s.contactFollowupAfterDays * DAY_MS) {
        return "contact_followup";
      }
    }
    return null;
  }

  if (shared || row.family_request_state === "pending" || row.family_auto_cancelled_at) return null;
  if (!row.family_auto_eligible_at) return null;
  const auto = autoState(row, side);
  if (auto.dismissed === 0) return "auto_first";
  if (auto.dismissed === 1 && auto.finalAt) return "auto_final";
  return null;
}

/**
 * Family state from one member's point of view. Also the lazy trigger for the automatic
 * reminder, so an eligible match is picked up the moment either member opens the chat.
 */
export async function getFamilyView(requestId: bigint, viewerId: bigint): Promise<FamilyView | null> {
  let row = await loadRow(requestId);
  if (!row || row.status !== "accepted") return null;
  if (row.sender_id !== viewerId && row.receiver_id !== viewerId) return null;

  const pair = await loadPair(row);
  if (!pair.femaleId || !pair.maleId) return null;
  const role = pair.femaleId === viewerId ? "female" : "male";
  const settings = await getFamilySettings();

  if (await evaluateAutoReminders(row, pair, settings).catch(() => false)) {
    row = (await loadRow(requestId)) ?? row;
  }

  const shared = Boolean(row.wali_details_shared_at);
  const contactedAt = contactedAtOf(row);
  const state =
    !shared && (row.family_request_state === "pending" || row.family_request_state === "declined")
      ? row.family_request_state
      : null;
  const cooldownEnds =
    state === "declined" && row.family_declined_at
      ? row.family_declined_at.getTime() + settings.requestCooldownDays * DAY_MS
      : 0;
  const peerId = role === "female" ? pair.maleId : pair.femaleId;

  return {
    role,
    peerCode: pair.codes.get(peerId.toString()) || "your match",
    shared,
    sharedAt: row.wali_details_shared_at?.toISOString() ?? null,
    contacted: shared && Boolean(contactedAt),
    contactedAt: shared ? (contactedAt?.toISOString() ?? null) : null,
    request: {
      state,
      requestedAt: state ? (row.family_requested_at?.toISOString() ?? null) : null,
      declinedAt: state === "declined" ? (row.family_declined_at?.toISOString() ?? null) : null,
      canRequestAt:
        role === "male" && cooldownEnds > Date.now() ? new Date(cooldownEnds).toISOString() : null,
    },
    wali: role === "female" || shared ? await loadWaliDetails(pair.femaleId) : null,
    card: cardFor(row, role, sideOf(row, viewerId), settings),
  };
}

/* ───────────────────────────── actions ───────────────────────────── */

export class FamilyFlowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Via = "manual" | "auto";

async function context(requestId: bigint, userId: bigint) {
  const row = await loadRow(requestId);
  if (!row || row.status !== "accepted") throw new FamilyFlowError("Chat not found", 404);
  const pair = await loadPair(row);
  if (!pair.femaleId || !pair.maleId) {
    throw new FamilyFlowError("Family involvement isn't available for this match.");
  }
  const role: "male" | "female" = pair.femaleId === userId ? "female" : "male";
  return { row, pair, role, maleId: pair.maleId, femaleId: pair.femaleId };
}

/** Brother asks whether she is comfortable sharing her wali's contact details. */
export async function requestFamilyInvolvement(requestId: bigint, userId: bigint, via: Via) {
  const { row, pair, role, femaleId } = await context(requestId, userId);
  if (role !== "male") throw new FamilyFlowError("You can share your wali's details directly.");
  const settings = await getFamilySettings();

  const updated = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
    `UPDATE match_requests
        SET family_request_state = 'pending',
            family_requested_at = NOW(),
            family_requested_via = $2,
            family_declined_at = NULL,
            wali_details_requested_at = NOW(),
            family_auto_cancelled_at = COALESCE(family_auto_cancelled_at, NOW())
      WHERE id = $1
        AND status = 'accepted'
        AND wali_details_shared_at IS NULL
        AND (family_request_state IS NULL
             OR (family_request_state = 'declined'
                 AND (family_declined_at IS NULL
                      OR family_declined_at <= NOW() - ($3::int * INTERVAL '1 day'))))
      RETURNING id`,
    requestId,
    via,
    Math.round(settings.requestCooldownDays)
  );

  if (updated.length === 0) {
    const now = await loadRow(requestId);
    if (now?.wali_details_shared_at) throw new FamilyFlowError("Wali details have already been shared.", 409);
    // A second tap, or a second tab: the request is already out — nothing more to do.
    if (now?.family_request_state === "pending") return;
    throw new FamilyFlowError(
      `${pair.codes.get(femaleId.toString())} isn't ready to involve family yet. You can ask again later.`,
      429
    );
  }

  const maleCode = pair.codes.get(userId.toString()) || "Your match";
  announce(row);
  // Lock-screen wording stays discreet; the bell row and the chat carry the real context.
  void sendPushNotification(femaleId, {
    title: "Pashtun Nikah",
    body: `${maleCode} wants to take the next step ❤️`,
    url: `/chats/${requestId}`,
    tag: `family-${requestId}`,
    type: "wali",
    actorUserId: userId,
    relatedRequestId: requestId,
    inApp: {
      title: `${maleCode} wants to involve family`,
      body: "He's asked if you're comfortable sharing your wali's contact details.",
    },
  }).catch((err) => console.error("[family] request push failed", err));
}

/** Sister answers "Not now" to his actual request: it closes, and he gets a cooldown. */
export async function declineFamilyRequest(requestId: bigint, userId: bigint) {
  const { row, pair, role, maleId } = await context(requestId, userId);
  if (role !== "female") throw new FamilyFlowError("Only she can answer this request.");

  const updated = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
    `UPDATE match_requests
        SET family_request_state = 'declined', family_declined_at = NOW()
      WHERE id = $1 AND status = 'accepted' AND family_request_state = 'pending'
        AND wali_details_shared_at IS NULL
      RETURNING id`,
    requestId
  );
  if (updated.length === 0) return;

  announce(row);
  // Discreet: a bell row only, no push.
  await createNotification({
    recipientUserId: maleId,
    type: "wali",
    title: `${pair.codes.get(userId.toString())} isn't ready to involve family yet.`,
    body: "You can keep getting to know each other.",
    url: `/chats/${requestId}`,
    tag: `family-${requestId}`,
    actorUserId: userId,
    relatedRequestId: requestId,
  }).catch(() => undefined);
}

/** Sister shares her wali's details — answering his request, or entirely on her own. */
export async function shareWaliDetails(requestId: bigint, userId: bigint, via: Via) {
  const { row, pair, role, maleId } = await context(requestId, userId);
  if (role !== "female") throw new FamilyFlowError("Only she can share her wali's details.");

  const wali = await loadWaliDetails(userId);
  if (!wali?.contact) {
    throw new FamilyFlowError("Add your wali's name and phone number to your profile first.");
  }

  const updated = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
    `UPDATE match_requests
        SET wali_details_shared_at = NOW(),
            wali_handover_status = 'involving',
            family_shared_via = $2,
            family_request_state = NULL,
            family_auto_cancelled_at = COALESCE(family_auto_cancelled_at, NOW()),
            updated_at = NOW()
      WHERE id = $1 AND status = 'accepted' AND wali_details_shared_at IS NULL
      RETURNING id`,
    requestId,
    via
  );
  // Already shared (double tap / second device): the card is in the chat, nothing to add.
  if (updated.length === 0) return;

  let message;
  try {
    const { createContactCardMessage } = await import("@/lib/chat");
    message = await createContactCardMessage({ requestId, senderId: userId, receiverId: maleId, wali });
  } catch (err) {
    await prisma.$executeRawUnsafe(
      `UPDATE match_requests SET wali_details_shared_at = NULL, wali_handover_status = NULL WHERE id = $1`,
      requestId
    );
    throw new FamilyFlowError(err instanceof Error ? err.message : "Could not share wali details.");
  }

  const raw = requestId.toString();
  const femaleCode = pair.codes.get(userId.toString()) || "Your match";
  broadcastChat("message:new", [`thread:${raw}`], message);
  void broadcastToWalis("message:new", requestId, message).catch(() => {});
  broadcastChat("inbox:update", [`user:${maleId.toString()}`], {
    requestId: raw,
    lastMessage: message.body,
    lastAt: message.createdAt,
    fromUserId: userId.toString(),
    fromCode: femaleCode,
  });
  announce(row);
  void sendPushNotification(maleId, {
    title: "Pashtun Nikah",
    body: `${femaleCode} has involved her wali ❤️`,
    url: `/chats/${requestId}`,
    tag: `family-${requestId}`,
    type: "wali",
    actorUserId: userId,
    relatedRequestId: requestId,
    inApp: {
      title: `${femaleCode} has involved her wali ❤️`,
      body: "Her wali's contact details are now in your chat.",
    },
  }).catch((err) => console.error("[family] share push failed", err));
}

/** Brother pressed WhatsApp / Email / Copy on the wali card — lets the contact prompt come sooner. */
export async function noteWaliContactAction(requestId: bigint, userId: bigint) {
  const { role } = await context(requestId, userId);
  if (role !== "male") return;
  await prisma.$executeRawUnsafe(
    `UPDATE match_requests SET family_contact_action_at = COALESCE(family_contact_action_at, NOW())
      WHERE id = $1 AND wali_details_shared_at IS NOT NULL`,
    requestId
  );
}

/** Brother answers "Have you contacted her wali?". */
export async function answerWaliContacted(requestId: bigint, userId: bigint, contacted: boolean) {
  const { row, role } = await context(requestId, userId);
  if (role !== "male") throw new FamilyFlowError("Only he can confirm contacting the wali.");

  if (contacted) {
    await prisma.$executeRawUnsafe(
      `UPDATE match_requests
          SET wali_contact_confirmed_at = NOW(), wali_handover_status = 'established'
        WHERE id = $1 AND status = 'accepted' AND wali_details_shared_at IS NOT NULL
          AND wali_contact_confirmed_at IS NULL`,
      requestId
    );
  } else {
    // Two "Not yet" answers at most — after the second we stop asking.
    await prisma.$executeRawUnsafe(
      `UPDATE match_requests
          SET family_contact_not_yet_count = LEAST(family_contact_not_yet_count + 1, 2),
              family_contact_not_yet_at = NOW()
        WHERE id = $1 AND status = 'accepted' AND wali_details_shared_at IS NOT NULL
          AND wali_contact_confirmed_at IS NULL
          AND (family_contact_not_yet_at IS NULL OR family_contact_not_yet_at < NOW() - INTERVAL '1 minute')`,
      requestId
    );
  }
  announce(row);
}

/** "Not now" on the automatic reminder: first time waits for one final reminder, second stops it. */
export async function dismissAutoReminder(requestId: bigint, userId: bigint) {
  const { row } = await context(requestId, userId);
  const side = sideOf(row, userId);
  await prisma.$executeRawUnsafe(
    `UPDATE match_requests
        SET family_auto_dismiss_${side} = family_auto_dismiss_${side} + 1,
            family_auto_dismissed_${side}_at = NOW()
      WHERE id = $1
        AND family_auto_eligible_at IS NOT NULL
        AND (family_auto_dismiss_${side} = 0
             OR (family_auto_dismiss_${side} = 1 AND family_auto_final_${side}_at IS NOT NULL))`,
    requestId
  );
}

/**
 * Match ended or a member blocked the other: close any open request and stop every reminder.
 * Contact prompts and reminders are also gated on `status = 'accepted'` and the block check, so
 * this is belt and braces rather than the only guard.
 */
export async function cancelFamilyFlow(requestId: bigint) {
  await ensureFamilySchema();
  await prisma
    .$executeRawUnsafe(
      `UPDATE match_requests
          SET family_request_state = CASE WHEN family_request_state = 'pending' THEN NULL ELSE family_request_state END,
              family_auto_cancelled_at = COALESCE(family_auto_cancelled_at, NOW()),
              family_contact_not_yet_count = 2
        WHERE id = $1`,
      requestId
    )
    .catch((err) => console.error("[family] cancel failed", err));
}

/* ───────────────────────────── automatic reminder ───────────────────────────── */

type Activity = { count: number; days: number; last: Date | null };

/** Member-to-member text messages only — no wali cards, reactions or system events. */
async function loadActivity(row: { id: bigint; sender_id: bigint; receiver_id: bigint }) {
  const rows = await prisma.$queryRawUnsafe<
    { sender_id: bigint; n: number; days: number; last: Date | null }[]
  >(
    `SELECT sender_id, COUNT(*)::int AS n,
            COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date)::int AS days,
            MAX(created_at) AS last
       FROM messages
      WHERE request_id = $1 AND COALESCE(message_type, 'text') = 'text'
        AND sender_id IN ($2, $3)
      GROUP BY sender_id`,
    row.id,
    row.sender_id,
    row.receiver_id
  );
  const of = (id: bigint): Activity => {
    const r = rows.find((x) => x.sender_id === id);
    return { count: r?.n ?? 0, days: r?.days ?? 0, last: r?.last ?? null };
  };
  return { sender: of(row.sender_id), receiver: of(row.receiver_id) };
}

function bothRecentlyActive(a: { sender: Activity; receiver: Activity }, s: FamilySettings) {
  const cutoff = Date.now() - s.recentActivityHours * HOUR_MS;
  return Boolean(
    a.sender.last && a.receiver.last && a.sender.last.getTime() >= cutoff && a.receiver.last.getTime() >= cutoff
  );
}

function meetsThresholds(row: Row, a: { sender: Activity; receiver: Activity }, s: FamilySettings) {
  return (
    Date.now() - row.matched_at.getTime() >= s.minDaysMatched * DAY_MS &&
    a.sender.count + a.receiver.count >= s.minTotalMessages &&
    Math.min(a.sender.count, a.receiver.count) >= s.minMessagesEach &&
    Math.min(a.sender.days, a.receiver.days) >= s.minActiveDaysEach &&
    bothRecentlyActive(a, s)
  );
}

function fill(template: string, code: string) {
  return template.replaceAll("{code}", code);
}

function reminderPush(
  to: bigint,
  from: bigint,
  pair: Pair,
  requestId: bigint,
  title: string,
  body: string
) {
  const code = pair.codes.get(from.toString()) || "your match";
  return sendPushNotification(to, {
    title: fill(title, code),
    body: fill(body, code),
    url: `/chats/${requestId}`,
    tag: `family-reminder-${requestId}`,
    type: "wali",
    actorUserId: from,
    relatedRequestId: requestId,
  }).catch((err) => console.error("[family] reminder push failed", err));
}

/**
 * Moves one match along the automatic-reminder track. Returns true when the row changed.
 * Idempotent: each step is claimed with a conditional UPDATE, so the cron run and a member
 * opening the chat at the same moment send one push, not two.
 */
async function evaluateAutoReminders(row: Row, pair: Pair, s: FamilySettings): Promise<boolean> {
  if (row.status !== "accepted" || row.wali_details_shared_at || row.family_auto_cancelled_at) return false;
  if (row.family_request_state === "pending" || !pair.maleId || !pair.femaleId) return false;

  if (!row.family_auto_eligible_at) {
    const tooNew = Date.now() - row.matched_at.getTime() < s.minDaysMatched * DAY_MS;
    if (!row.family_force_eligible && tooNew) return false;
    if (!row.family_force_eligible && !meetsThresholds(row, await loadActivity(row), s)) return false;
    if (await isBlockedBetween(row.sender_id, row.receiver_id)) return false;

    const claimed = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `UPDATE match_requests SET family_auto_eligible_at = NOW()
        WHERE id = $1 AND status = 'accepted' AND family_auto_eligible_at IS NULL
          AND family_auto_cancelled_at IS NULL AND wali_details_shared_at IS NULL
        RETURNING id`,
      row.id
    );
    if (claimed.length === 0) return false;
    announce(row);
    await Promise.all([
      reminderPush(row.sender_id, row.receiver_id, pair, row.id, s.pushTitle, s.pushBody),
      reminderPush(row.receiver_id, row.sender_id, pair, row.id, s.pushTitle, s.pushBody),
    ]);
    return true;
  }

  // One final reminder, a week after "Not now", and only if they are still really talking.
  let changed = false;
  for (const side of ["sender", "receiver"] as const) {
    const auto = autoState(row, side);
    if (auto.dismissed !== 1 || auto.finalAt || !auto.dismissedAt) continue;
    if (Date.now() - auto.dismissedAt.getTime() < s.finalReminderAfterDays * DAY_MS) continue;
    if (!bothRecentlyActive(await loadActivity(row), s)) continue;
    if (await isBlockedBetween(row.sender_id, row.receiver_id)) continue;

    const claimed = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `UPDATE match_requests SET family_auto_final_${side}_at = NOW()
        WHERE id = $1 AND status = 'accepted' AND family_auto_final_${side}_at IS NULL
          AND family_auto_dismiss_${side} = 1 AND family_auto_cancelled_at IS NULL
          AND wali_details_shared_at IS NULL
        RETURNING id`,
      row.id
    );
    if (claimed.length === 0) continue;
    changed = true;
    const to = side === "sender" ? row.sender_id : row.receiver_id;
    const from = side === "sender" ? row.receiver_id : row.sender_id;
    await reminderPush(to, from, pair, row.id, s.finalPushTitle, s.finalPushBody);
  }
  if (changed) announce(row);
  return changed;
}

/** Cron: pick up every match that has become eligible or is due its final reminder. */
export async function processFamilyReminders(limit = 200) {
  await ensureFamilySchema();
  const s = await getFamilySettings();
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `${ROW_SQL}
      WHERE status = 'accepted'
        AND wali_details_shared_at IS NULL
        AND family_auto_cancelled_at IS NULL
        AND COALESCE(family_request_state, '') <> 'pending'
        AND (
          (family_auto_eligible_at IS NULL
            AND (family_force_eligible
                 OR COALESCE(accepted_at, created_at) <= NOW() - ($1::int * INTERVAL '1 day')))
          OR (family_auto_eligible_at IS NOT NULL AND (
                (family_auto_dismiss_sender = 1 AND family_auto_final_sender_at IS NULL)
             OR (family_auto_dismiss_receiver = 1 AND family_auto_final_receiver_at IS NULL)))
        )
      ORDER BY updated_at DESC
      LIMIT $2`,
    Math.floor(s.minDaysMatched),
    limit
  );

  let advanced = 0;
  for (const row of rows) {
    const pair = await loadPair(row);
    if (await evaluateAutoReminders(row, pair, s).catch(() => false)) advanced++;
  }
  return { checked: rows.length, advanced };
}
