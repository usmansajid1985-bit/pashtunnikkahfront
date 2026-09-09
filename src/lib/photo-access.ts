import { findRelation, relationStatus } from "@/lib/matches";
import { peerPhotoVisible } from "@/lib/communication";

/**
 * Server-side photo visibility (PN privacy rule, confirmed in the Browse QA report):
 *
 *   - Browse card:                photo ALWAYS blurred.
 *   - Full profile, no match yet: photo NOT shown at all — the client is never sent a URL.
 *   - After an accepted match:     photo may be shown, subject to the per-match photo-share
 *                                  rules (`peerPhotoVisible`).
 *
 * The moderation flag `photo_status === "approved"` only means the image passed review — it is
 * NOT a relationship check and must never on its own unblur a photo for an unmatched viewer.
 */
export type PhotoVisibility = "hidden" | "blurred" | "visible";

/** Browse / Smart Matches cards. */
export function browsePhotoVisibility(): PhotoVisibility {
  return "blurred";
}

/**
 * Full profile (`/p/[code]`) and chat profile panel. Returns "hidden" until the viewer and the
 * target have an accepted match with photo sharing enabled.
 */
export async function fullProfilePhotoVisibility(
  viewerId: bigint,
  targetUserId: bigint
): Promise<PhotoVisibility> {
  if (viewerId === targetUserId) return "visible";

  const relation = await findRelation(viewerId, targetUserId);
  const status = relationStatus(relation, viewerId);
  const matched = status.state === "accepted";
  if (!matched) return "hidden";

  const shared = peerPhotoVisible({
    matched: true,
    photoShared: Boolean(relation?.photo_shared),
    mode: relation?.communication_mode ?? null,
  });
  return shared ? "visible" : "hidden";
}

/**
 * Apply a visibility decision to a photo URL: `hidden` drops it entirely so it never reaches
 * the browser; `blurred` / `visible` keep it (the client applies the blur for `blurred`).
 */
export function applyPhotoVisibility(
  url: string | null | undefined,
  visibility: PhotoVisibility
): { photoUrl: string | null; photoVisible: boolean } {
  if (visibility === "hidden") return { photoUrl: null, photoVisible: false };
  return { photoUrl: url ?? null, photoVisible: visibility === "visible" };
}

/** Convenience for pages that already loaded the target user id. */
export async function resolveProfilePhoto(
  viewerId: bigint,
  targetUserId: bigint,
  url: string | null | undefined
) {
  const visibility = await fullProfilePhotoVisibility(viewerId, targetUserId);
  return applyPhotoVisibility(url, visibility);
}
