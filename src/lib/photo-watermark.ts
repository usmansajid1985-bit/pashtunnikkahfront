/**
 * Per-viewer watermark for the Private Photo Reveal viewer (spec §21). Unlike the anonymous blur
 * in photo-blur.ts, this must stay legible while identifying exactly who the image was shown to —
 * so a screenshot that leaks can be traced back to the recipient account it was shown to.
 *
 * `sharp` is loaded lazily for the same reason photo-blur.ts does: its native binary must only be
 * able to break this one call, not every module that imports this file.
 */
const TILE_ROTATION = -28;

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function watermarkSvg(width: number, height: number, label: string) {
  const text = escapeXml(label);
  const diag = Math.ceil(Math.sqrt(width * width + height * height));
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="260" height="140" patternTransform="rotate(${TILE_ROTATION})" patternUnits="userSpaceOnUse">
          <text x="0" y="70" font-family="Helvetica, Arial, sans-serif" font-size="17"
            fill="rgba(255,255,255,0.34)" stroke="rgba(0,0,0,0.22)" stroke-width="0.5">${text}</text>
        </pattern>
      </defs>
      <rect x="${-diag / 2}" y="${-diag / 2}" width="${diag}" height="${diag}" fill="url(#wm)" />
    </svg>
  `;
}

/** Composite a repeating, semi-transparent watermark across `buf` and re-encode as JPEG. */
export async function watermarkImageBuffer(buf: Buffer, label: string): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  // Resize first (auto-orienting from EXIF), then build the watermark against the RESIZED
  // dimensions — sizing it off the original would misalign/undercover the image we actually composite onto.
  const resized = await sharp(buf)
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const width = meta.width || 1280;
  const height = meta.height || 1280;
  const overlay = Buffer.from(watermarkSvg(width, height, label));
  return sharp(resized)
    .composite([{ input: overlay, gravity: "center" }])
    .jpeg({ quality: 82 })
    .toBuffer();
}
