/** Help & Support topics and limits — safe to import from client components (no prisma). */

export const SUPPORT_TOPICS = {
  account: {
    label: "Account & Profile",
    hint: "Sign-in, verification, photos and approval",
    reasons: ["Sign-in issue", "Profile approval", "Photo upload problem", "Verification issue", "Other account issue"],
  },
  matches: {
    label: "Matching & Chats",
    hint: "Requests, messages, matches and photos",
    reasons: ["Match request issue", "Chat or messaging issue", "Photo sharing issue", "Match Insights problem", "Other matching issue"],
  },
  billing: {
    label: "Membership & Billing",
    hint: "Gold, Match Tokens, renewals and refunds",
    reasons: ["Refund request", "Unexpected payment", "Match Tokens issue", "Gold benefits not working", "Other billing question"],
  },
  privacy: {
    label: "Privacy & Safety",
    hint: "Wali access, blocking and reports",
    reasons: ["Wali access issue", "Report a member", "Block or safety concern", "Privacy or data request", "Other safety question"],
  },
} as const;

export type SupportTopic = keyof typeof SUPPORT_TOPICS;
export const SUPPORT_CHANNELS = ["whatsapp", "email"] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];
export const SUPPORT_DETAILS_MAX = 1500;
