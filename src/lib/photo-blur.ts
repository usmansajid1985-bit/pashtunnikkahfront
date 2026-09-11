import sharp from "sharp";

/**
 * Server-side blur for photos shown to a viewer who isn't authorised to see the original yet
 * (Browse cards, Smart Matches, chat before a photo is shared). CSS blur on the real image is
 * not enough — the original bytes would still be in the network response / DOM. Downscaling
 * first destroys recoverable detail before the blur is even applied, so the output can't be
 * sharpened back into something identifying.
 */
const BLUR_SIZE = 96;
const BLUR_SIGMA = 14;

export async function blurImageBuffer(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize(BLUR_SIZE, BLUR_SIZE, { fit: "cover" })
    .blur(BLUR_SIGMA)
    .jpeg({ quality: 55 })
    .toBuffer();
}
