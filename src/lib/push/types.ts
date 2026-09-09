export type PushNotificationType =
  | "message"
  | "match"
  | "request_accepted"
  | "wali"
  | "photo"
  | "profile_view"
  | "profile_status"
  | "membership"
  | "referral"
  | "profile_activity"
  | "system";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type: PushNotificationType;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  relatedRequestId?: bigint | null;
  /** The member whose action produced this (for the thumbnail). */
  actorUserId?: bigint | null;
  /** Collapse repeat activity from the same source into one bell row (spec §7/§18). */
  groupKey?: string | null;
  groupedTitle?: (count: number) => string;
  groupedBody?: (count: number) => string;
};
