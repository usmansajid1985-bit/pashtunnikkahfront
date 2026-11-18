/**
 * Presence / Online / Last Seen helpers.
 * Online ("Active now") = last_seen_at within ONLINE_WINDOW_SECONDS. The client heartbeats every
 * ~20s while the app is genuinely in use, so a member who closes the app, loses signal or whose phone
 * dies without sending the "away" beacon drops out of Active now within ~45s (not minutes).
 */
export const ONLINE_WINDOW_SECONDS = Math.max(20, Number(process.env.ONLINE_WINDOW_SECONDS) || 45);
/** Kept for older callers; fractional minutes. */
export const ONLINE_IDLE_MINUTES = ONLINE_WINDOW_SECONDS / 60;
/** How often the foreground client heartbeats (must stay well under the online window). */
export const HEARTBEAT_INTERVAL_MS = 20_000;
/** Foreground but untouched for this long = no longer "Active now". */
export const FOREGROUND_IDLE_MS = 5 * 60_000;

/** Extra rank nudge for brand-new members — kept short so it doesn't distort activity order. */
export const NEW_MEMBER_BOOST_DAYS = 4;
/**
 * "Just Joined" = the member's first 7 days after joining/approval (PN product rule).
 * Drives the card badge and the "New members" filter — both use this one window.
 */
export const JUST_JOINED_DAYS = 7;
/** Soften repeat tops: impressions older than this no longer count as "recently seen". */
export const FAIR_EXPOSURE_WINDOW_DAYS = 3;

export function onlineSince(now = new Date()) {
  return new Date(now.getTime() - ONLINE_WINDOW_SECONDS * 1000);
}

export function isOnline(lastSeenAt: Date | string | null | undefined, now = new Date()) {
  if (!lastSeenAt) return false;
  const t = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() >= onlineSince(now).getTime();
}

export function isJustJoined(approvedOrCreated: Date | string | null | undefined, now = new Date()) {
  if (!approvedOrCreated) return false;
  const t = approvedOrCreated instanceof Date ? approvedOrCreated : new Date(approvedOrCreated);
  if (Number.isNaN(t.getTime())) return false;
  return now.getTime() - t.getTime() <= JUST_JOINED_DAYS * 24 * 60 * 60_000;
}

/** Days since joining/approval, or null when unknown — lets ranking keep a shorter boost window. */
export function daysSinceJoined(
  approvedOrCreated: Date | string | null | undefined,
  now = new Date()
): number | null {
  if (!approvedOrCreated) return null;
  const t = approvedOrCreated instanceof Date ? approvedOrCreated : new Date(approvedOrCreated);
  if (Number.isNaN(t.getTime())) return null;
  return (now.getTime() - t.getTime()) / (24 * 60 * 60_000);
}

/** Coarse activity bucket — lower is better (Online = 0). */
export function activityBucket(lastSeenAt: Date | string | null | undefined, now = new Date()): number {
  if (!lastSeenAt) return 90;
  const t = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(t.getTime())) return 90;
  if (isOnline(t, now)) return 0; // online — same test as the "Active now" dot
  const mins = (now.getTime() - t.getTime()) / 60_000;
  if (mins <= 15) return 1;
  if (mins <= 60) return 2;
  if (mins <= 6 * 60) return 3;
  if (mins <= 24 * 60) return 4; // today
  if (mins <= 2 * 24 * 60) return 5;
  if (mins <= 3 * 24 * 60) return 6;
  if (mins <= 7 * 24 * 60) return 7;
  if (mins <= 14 * 24 * 60) return 8;
  if (mins <= 30 * 24 * 60) return 9;
  return 10;
}

/** Calendar day key in the community's main timezone, so "today"/"yesterday" match what members expect. */
function dayKey(d: Date) {
  return d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
}

/** True when the member was genuinely active earlier today (drives the green "Active today" style). */
export function isActiveToday(lastSeenAt: Date | string | null | undefined, now = new Date()) {
  if (!lastSeenAt) return false;
  const t = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(t.getTime())) return false;
  return now.getTime() - t.getTime() < 24 * 60 * 60_000 && dayKey(t) === dayKey(now);
}

/** The one label that gets the bright-green "currently using the app" dot; everything else is grey. */
export const ACTIVE_NOW_LABEL = "Active now";

/** True when an activity label should show the bright-green dot (vs the grey one). */
export function isActiveNowLabel(label: string | null | undefined) {
  return label === ACTIVE_NOW_LABEL;
}

/**
 * Activity wording (members see a coarse bucket, never minutes/hours). "Active now" is reinstated for
 * members currently using the app (within ONLINE_IDLE_MINUTES of their last heartbeat); every other
 * bucket stays coarse. The exact timestamp is still used internally for ranking.
 */
export function formatLastSeen(lastSeenAt: Date | string | null | undefined, now = new Date()): string {
  if (!lastSeenAt) return "Active over a month ago";
  const t = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(t.getTime())) return "Active over a month ago";
  if (isOnline(t, now)) return ACTIVE_NOW_LABEL;
  if (isActiveToday(t, now)) return "Active today";
  const days = (now.getTime() - t.getTime()) / (24 * 60 * 60_000);
  if (days < 2 && dayKey(t) === dayKey(new Date(now.getTime() - 24 * 60 * 60_000))) return "Active yesterday";
  if (days < 7) return "Active this week";
  if (days < 31) return "Active this month";
  return "Active over a month ago";
}
