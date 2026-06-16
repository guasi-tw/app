import { put } from "@vercel/blob";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // ~2 MB (§D.1)
const AVATAR_DIM = 512;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]); // sharp's detected format

/** User-facing, safe-to-display avatar validation failure (繁中 message). */
export class AvatarError extends Error {}

/**
 * Validate + re-encode an uploaded avatar (§D.1). Declared MIME is a first gate,
 * but the real defense is sharp re-decoding the bytes: a spoofed content-type
 * (e.g. an SVG renamed .png) is caught by the format check. Re-encoding to WebP
 * strips EXIF/any embedded payload and normalizes dimensions. SVG/GIF are rejected.
 */
export async function processAvatar(
  buffer: Buffer,
  declaredMime: string,
): Promise<{ data: Buffer; contentType: string }> {
  if (!ALLOWED_MIME.has(declaredMime)) {
    throw new AvatarError("不支援的圖片格式，請使用 JPEG / PNG / WebP");
  }
  if (buffer.byteLength > AVATAR_MAX_BYTES) {
    throw new AvatarError("圖片太大，請小於 2MB");
  }

  // Lazy-load sharp: it's a heavy native (libvips) module. A top-level import
  // would load it on every server action that touches this file — e.g. a
  // bio-only profile save where no avatar is processed — and crash if the
  // native binary is unavailable in the runtime.
  const sharp = (await import("sharp")).default;

  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    throw new AvatarError("圖片無法處理");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new AvatarError("圖片格式無法辨識");
  }

  const data = await sharp(buffer)
    .rotate() // honor EXIF orientation before it is stripped
    .resize(AVATAR_DIM, AVATAR_DIM, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  return { data, contentType: "image/webp" };
}

/**
 * Store a processed avatar in Vercel Blob at a stable per-user path so a
 * re-upload overwrites the old one. Returns the public URL for `User.avatarUrl`.
 *
 * - `access: "public"` — avatars render on the public 驗明正身 page; a private
 *   blob would need per-view signed URLs for content that's meant to be seen.
 * - `addRandomSuffix: false` + `allowOverwrite: true` — stable key, no orphaned
 *   objects on re-upload. The URL is therefore predictable, which is fine for a
 *   non-sensitive avatar keyed by an opaque cuid.
 * - `VERCEL_ENV` key-prefix — Production + Preview share one store, and Neon
 *   preview branches clone prod user ids; the prefix stops a Preview upload from
 *   overwriting a prod avatar at the same key. (Development uses a separate store.)
 *
 * Requires BLOB_READ_WRITE_TOKEN (auto-injected per env on Vercel; `vercel env
 * pull` locally → the dev store's token).
 */
export async function storeAvatar(
  userId: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const env = process.env.VERCEL_ENV ?? "development"; // production | preview | development
  const { url } = await put(`${env}/avatars/${userId}.webp`, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}
