import { prisma } from "@/lib/prisma";
import { saveDataUrlPhoto } from "@/lib/photos";
import { ensurePhotosSchema } from "@/lib/ensure-photos-schema";

export const MAX_PROFILE_PHOTOS = 3;

export type ProfilePhoto = {
  id: string;
  url: string;
  isMain: boolean;
  status: "pending" | "approved" | "rejected";
  sortOrder: number;
};

type Row = {
  id: bigint;
  url: string;
  is_main: boolean;
  status: string;
  sort_order: number;
};

async function rows(userId: bigint): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT id, url, is_main, status, sort_order
    FROM profile_photos WHERE user_id = ${userId}
    ORDER BY sort_order ASC, id ASC
  `.catch(() => [] as Row[]);
}

function toPhoto(r: Row): ProfilePhoto {
  return {
    id: r.id.toString(),
    url: r.url,
    isMain: r.is_main,
    status: (r.status as ProfilePhoto["status"]) ?? "pending",
    sortOrder: r.sort_order,
  };
}

function pickMain(list: Row[]): Row | null {
  return list.find((r) => r.is_main) ?? list[0] ?? null;
}

/**
 * Keep `profiles.photo_url` / `photo_status` pointed at the current main photo so every
 * existing display path (browse, profile, chat, photo-access) keeps working unchanged.
 */
async function syncMainPhoto(userId: bigint): Promise<void> {
  const list = await rows(userId);
  const main = pickMain(list);
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: { photo_url: true, photo_status: true, photo_version: true, status: true },
  });
  if (!profile) return;

  if (!main) {
    await prisma.profiles.update({
      where: { user_id: userId },
      data: { photo_url: null, photo_status: null, updated_at: new Date() },
    });
    return;
  }

  const urlChanged = profile.photo_url !== main.url;
  // On a new main photo, reset moderation. If the URL is unchanged, keep whatever admin decided
  // and mirror it back onto the photo row.
  if (urlChanged) {
    await prisma.$transaction([
      prisma.profiles.update({
        where: { user_id: userId },
        data: {
          photo_url: main.url,
          photo_verification_url: main.url,
          photo_status: "pending",
          photo_version: (profile.photo_version ?? 0) + 1,
          status: profile.status === "approved" ? "pending" : profile.status,
          updated_at: new Date(),
        },
      }),
      prisma.$executeRaw`
        UPDATE profile_photos SET status = 'pending', updated_at = NOW()
        WHERE user_id = ${userId} AND id = ${main.id} AND status <> 'pending'
      `,
    ]);
  } else if (profile.photo_status && profile.photo_status !== main.status) {
    await prisma.$executeRaw`
      UPDATE profile_photos SET status = ${profile.photo_status}, updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${main.id}
    `;
  }
}

/** Existing members have a single `profiles.photo_url` and no gallery rows — seed one. */
async function backfillFromLegacy(userId: bigint): Promise<void> {
  const list = await rows(userId);
  if (list.length > 0) return;
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: { photo_url: true, photo_status: true },
  });
  if (!profile?.photo_url) return;
  await prisma.$executeRaw`
    INSERT INTO profile_photos (user_id, url, is_main, status, sort_order, created_at, updated_at)
    VALUES (${userId}, ${profile.photo_url}, TRUE, ${profile.photo_status ?? "pending"}, 0, NOW(), NOW())
  `;
}

export async function listProfilePhotos(userId: bigint): Promise<ProfilePhoto[]> {
  await ensurePhotosSchema();
  await backfillFromLegacy(userId);
  await syncMainPhoto(userId);
  return (await rows(userId)).map(toPhoto);
}

/** Save a data-URL image as a new profile photo. Returns the created photo (or an error). */
export async function addProfilePhoto(
  userId: bigint,
  dataUrl: string
): Promise<{ ok: true; photo: ProfilePhoto } | { ok: false; error: string }> {
  await ensurePhotosSchema();
  const existing = await rows(userId);
  if (existing.length >= MAX_PROFILE_PHOTOS) {
    return { ok: false, error: `You can upload up to ${MAX_PROFILE_PHOTOS} photos.` };
  }
  if (!dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "A valid image is required." };
  }

  let saved;
  try {
    saved = await saveDataUrlPhoto(userId, dataUrl, "public");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }

  const isFirst = existing.length === 0;
  const nextOrder = existing.length;
  const created = await prisma.$queryRaw<Row[]>`
    INSERT INTO profile_photos (user_id, url, is_main, status, sort_order, created_at, updated_at)
    VALUES (${userId}, ${saved.url}, ${isFirst}, 'pending', ${nextOrder}, NOW(), NOW())
    RETURNING id, url, is_main, status, sort_order
  `;
  await syncMainPhoto(userId);
  return { ok: true, photo: toPhoto(created[0]) };
}

export async function deleteProfilePhoto(userId: bigint, photoId: bigint): Promise<void> {
  await ensurePhotosSchema();
  const list = await rows(userId);
  const target = list.find((r) => r.id === photoId);
  if (!target) return;

  await prisma.$executeRaw`DELETE FROM profile_photos WHERE user_id = ${userId} AND id = ${photoId}`;

  // If we removed the main photo, promote the next one.
  if (target.is_main) {
    const remaining = list.filter((r) => r.id !== photoId);
    const promote = remaining[0];
    if (promote) {
      await prisma.$executeRaw`
        UPDATE profile_photos SET is_main = (id = ${promote.id}), updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    }
  }
  await syncMainPhoto(userId);
}

export async function setMainProfilePhoto(userId: bigint, photoId: bigint): Promise<void> {
  await ensurePhotosSchema();
  await prisma.$executeRaw`
    UPDATE profile_photos SET is_main = (id = ${photoId}), updated_at = NOW()
    WHERE user_id = ${userId}
  `;
  await syncMainPhoto(userId);
}

/**
 * One-shot import for the signup flow: persist an ordered list of data-URLs, mark `mainIndex`
 * as the main photo. Returns the main photo's stored URL for `profiles.photo_url`.
 */
export async function importSignupPhotos(
  userId: bigint,
  dataUrls: string[],
  mainIndex = 0
): Promise<{ mainUrl: string | null; count: number }> {
  await ensurePhotosSchema();
  const clean = dataUrls.filter((d) => typeof d === "string" && d.startsWith("data:image/")).slice(0, MAX_PROFILE_PHOTOS);
  if (clean.length === 0) return { mainUrl: null, count: 0 };

  let mainUrl: string | null = null;
  for (let i = 0; i < clean.length; i++) {
    const saved = await saveDataUrlPhoto(userId, clean[i], "public").catch(() => null);
    if (!saved) continue;
    const isMain = i === Math.min(Math.max(mainIndex, 0), clean.length - 1);
    if (isMain) mainUrl = saved.url;
    await prisma.$executeRaw`
      INSERT INTO profile_photos (user_id, url, is_main, status, sort_order, created_at, updated_at)
      VALUES (${userId}, ${saved.url}, ${isMain}, 'pending', ${i}, NOW(), NOW())
    `;
  }
  return { mainUrl, count: clean.length };
}
