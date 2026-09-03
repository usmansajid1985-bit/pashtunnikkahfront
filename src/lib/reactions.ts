/**
 * Single source of truth for chat message reactions — safe to import from both
 * client components and server code (no server-only dependencies here).
 *
 * The reaction picker (message-action-menu.tsx) and the server-side validation
 * in chat.ts (toggleReaction) MUST agree, or a user can pick an emoji the API
 * then rejects — the sender sees an optimistic reaction that never persists and
 * never reaches the other participant.
 */
export const QUICK_REACTIONS = ["❤️", "😂", "😊", "😮", "😍", "👍", "😁", "🙏"] as const;

export const MORE_REACTIONS = [
  "😢", "😡", "🥰", "😘", "🤔", "😴", "😳", "🥳", "🔥", "👏", "🙌", "🎉",
  "💯", "✨", "🌹", "😇", "🤗", "😭", "🤣", "😅", "🙃", "😎", "👌", "✌️",
  "🤞", "💪", "🕌", "📿",
] as const;

/** Every emoji a member can actually attach as a reaction. */
export const ALL_REACTIONS: readonly string[] = [
  ...new Set<string>([...QUICK_REACTIONS, ...MORE_REACTIONS]),
];

export function isAllowedReaction(emoji: string): boolean {
  return ALL_REACTIONS.includes(emoji);
}
