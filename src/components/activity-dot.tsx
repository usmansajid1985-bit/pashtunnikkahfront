import { isActiveNowLabel } from "@/lib/presence";

/**
 * The activity-status dot shown next to "Active now / today / this week…". A 7px bright-green dot
 * for members currently using the app ("Active now"), and a subtle 7px silver-grey dot (#CBD5E1)
 * for every other status. Used across Browse, full profiles, Requests and Chats.
 */
export function ActivityDot({ label, className = "" }: { label?: string | null; className?: string }) {
  const now = isActiveNowLabel(label);
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: 7, height: 7, backgroundColor: now ? "#22c55e" : "#CBD5E1" }}
    />
  );
}
