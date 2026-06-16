import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processAvatar, AvatarError, AVATAR_MAX_BYTES } from "./avatar";

async function makePng(size = 40): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();
}

describe("processAvatar", () => {
  it("re-encodes a valid PNG to a <=512px WebP", async () => {
    const out = await processAvatar(await makePng(800), "image/png");
    expect(out.contentType).toBe("image/webp");
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
  });

  it("rejects an SVG by declared MIME (SVG can carry scripts)", async () => {
    await expect(
      processAvatar(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml"),
    ).rejects.toBeInstanceOf(AvatarError);
  });

  it("rejects an oversized payload before decoding", async () => {
    const big = Buffer.alloc(AVATAR_MAX_BYTES + 1);
    await expect(processAvatar(big, "image/png")).rejects.toBeInstanceOf(AvatarError);
  });

  it("rejects bytes that are not a real image even if MIME claims PNG", async () => {
    await expect(
      processAvatar(Buffer.from("definitely not an image"), "image/png"),
    ).rejects.toBeInstanceOf(AvatarError);
  });
});
