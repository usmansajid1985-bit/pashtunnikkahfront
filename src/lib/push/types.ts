export type PushNotificationType =
  | "message"
  | "match"
  | "wali"
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
};
