// lib/binding/platforms/post-url-help.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { threadsAdapter } from "./threads";
import { instagramAdapter } from "./instagram";
import { miinAdapter } from "./miin";
import type { PlatformAdapter } from "./types";

const ADAPTERS: readonly PlatformAdapter[] = [threadsAdapter, instagramAdapter, miinAdapter];

// Final captions per spec §B (2026-06-18-post-url-help-design.md).
const CAPTIONS: Record<string, string[]> = {
  threads: ["按下圖示", "按下圖示", "複製完成，回到此處貼上連結"],
  instagram: ["按下圖示", "按下圖示", "複製完成，回到此處貼上連結"],
  miin: ["按下圖示", "按下圖示", "按下圖示並複製完成，回到此處貼上連結"],
};

describe("postUrlHelp — per-adapter walkthrough", () => {
  it("every registered adapter ships a non-empty postUrlHelp", () => {
    for (const a of ADAPTERS) expect(a.postUrlHelp.length).toBeGreaterThan(0);
  });

  for (const a of ADAPTERS) {
    describe(a.key, () => {
      it("has exactly the spec'd captions in order", () => {
        expect(a.postUrlHelp.map((s) => s.text)).toEqual(CAPTIONS[a.key]);
      });

      it("each step image is /help/<key>/step-N.webp in order", () => {
        a.postUrlHelp.forEach((step, i) => {
          expect(step.image).toBe(`/help/${a.key}/step-${i + 1}.webp`);
        });
      });

      it("each referenced image exists under public/", () => {
        for (const step of a.postUrlHelp) {
          const file = join(process.cwd(), "public", step.image);
          expect(existsSync(file), `missing asset: public${step.image}`).toBe(true);
        }
      });
    });
  }
});
