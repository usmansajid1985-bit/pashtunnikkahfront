import { readFile } from "fs/promises";
import path from "path";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

function heroVersionFile() {
  return path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), "..", "uploads"), "hero", ".cache-version");
}

async function readHeroVersion() {
  try {
    return (await readFile(heroVersionFile(), "utf8")).trim() || "0";
  } catch {
    return "0";
  }
}

async function queryHeroSlides() {
  try {
    return await prisma.$queryRaw<{ image_url: string }[]>`
      SELECT image_url FROM hero_slides
      WHERE is_active = true AND slot = 'hero'
      ORDER BY sort_order ASC
    `;
  } catch {
    return [];
  }
}

async function queryCtaBackground() {
  try {
    const rows = await prisma.$queryRaw<{ image_url: string }[]>`
      SELECT image_url FROM hero_slides
      WHERE is_active = true AND slot = 'cta'
      ORDER BY id DESC
      LIMIT 1
    `;
    return rows[0]?.image_url ?? null;
  } catch {
    return null;
  }
}

/** Slide list is cached until admin bumps .cache-version on the next upload/edit. */
export async function getCachedHeroSlides() {
  const version = await readHeroVersion();
  return unstable_cache(queryHeroSlides, ["hero-slides", version], {
    revalidate: false,
  })();
}

export async function getCachedCtaBackground() {
  const version = await readHeroVersion();
  return unstable_cache(queryCtaBackground, ["cta-bg", version], {
    revalidate: false,
  })();
}
