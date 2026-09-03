/**
 * Presence / Online / Last Seen helpers for Browse.
 * Online = last_seen_at within ONLINE_IDLE_MINUTES (default 5).
 */
export const ONLINE_IDLE_MINUTES = Math.max(
  1,
  Number(process.env.ONLINE_IDLE_MINUTES) || 5
);

export const NEW_MEMBER_BOOST_DAYS = 4;
/** Soften repeat tops: impressions older than this no longer count as "recently seen". */
export const FAIR_EXPOSURE_WINDOW_DAYS = 3;

export function onlineSince(now = new Date()) {
  return new Date(now.getTime() - ONLINE_IDLE_MINUTES * 60_000);
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
  return now.getTime() - t.getTime() <= NEW_MEMBER_BOOST_DAYS * 24 * 60 * 60_000;
}

/** Coarse activity bucket — lower is better (Online = 0). */
export function activityBucket(lastSeenAt: Date | string | null | undefined, now = new Date()): number {
  if (!lastSeenAt) return 90;
  const t = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(t.getTime())) return 90;
  const mins = (now.getTime() - t.getTime()) / 60_000;
  if (mins <= ONLINE_IDLE_MINUTES) return 0; // online
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

export function formatLastSeen(lastSeenAt: Date | string | null | undefined, now = new Date()): string {
  if (isOnline(lastSeenAt, now)) return "Online";
  if (!lastSeenAt) return "Not recently active";
  const t = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(t.getTime())) return "Not recently active";
  const mins = Math.max(0, Math.floor((now.getTime() - t.getTime()) / 60_000));
  if (mins < 60) return `Active ${mins || 1} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days} days ago`;
  if (days < 30) return "Active this month";
  return "Not recently active";
}
