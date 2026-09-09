import { prisma } from "@/lib/prisma";

/**
 * Blocking is fully mutual (PN product rule): if A blocks B, then A and B disappear from each
 * other everywhere — Browse, Smart Matches, Saved, direct profile, match requests, chat.
 * These helpers are the single source of truth for "who can't see whom".
 *
 * `blocks` rows are one-directional (blocker_id → blocked_id); mutual enforcement means every
 * read path must union BOTH directions for the current viewer.
 */

/** User ids the viewer must not see and that must not see the viewer (union of both directions). */
export async function blockedUserIds(viewerId: bigint): Promise<bigint[]> {
  const rows = await prisma.blocks
    .findMany({
      where: { OR: [{ blocker_id: viewerId }, { blocked_id: viewerId }] },
      select: { blocker_id: true, blocked_id: true },
    })
    .catch(() => [] as { blocker_id: bigint; blocked_id: bigint }[]);

  const ids = new Set<string>();
  for (const r of rows) {
    ids.add((r.blocker_id === viewerId ? r.blocked_id : r.blocker_id).toString());
  }
  return [...ids].map((s) => BigInt(s));
}

/** True when either user has blocked the other. */
export async function isBlockedBetween(a: bigint, b: bigint): Promise<boolean> {
  if (a === b) return false;
  const hit = await prisma.blocks
    .findFirst({
      where: {
        OR: [
          { blocker_id: a, blocked_id: b },
          { blocker_id: b, blocked_id: a },
        ],
      },
      select: { blocker_id: true },
    })
    .catch(() => null);
  return Boolean(hit);
}
