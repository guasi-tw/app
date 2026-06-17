import { describe, it, expect } from "vitest";
import { aboutContent } from "./content";

const blob = JSON.stringify(aboutContent);

describe("aboutContent — accuracy constraints", () => {
  it("CTA points to the login route", () => {
    expect(aboutContent.cta.href).toBe("/login");
  });

  it("CTA names Google as the login method", () => {
    expect(aboutContent.cta.buttonLabel).toContain("Google");
  });

  it("lists exactly the three MVP platforms plus a 'more' chip", () => {
    expect(aboutContent.platforms.items).toEqual([
      "Threads",
      "Instagram",
      "miin.cc",
    ]);
    expect(aboutContent.platforms.more).toContain("更多");
  });

  it("makes no Email / magic-link login claim (Google-only today)", () => {
    expect(blob).not.toMatch(/email/i);
    expect(blob).not.toContain("magic");
  });

  it("makes no snapshot / screenshot durability claim (link-only today)", () => {
    expect(blob).not.toContain("截圖");
    expect(blob).not.toContain("快照");
    expect(blob).not.toMatch(/snapshot/i);
  });

  it("has three how-it-works steps in order", () => {
    expect(aboutContent.how.steps.map((s) => s.title)).toEqual([
      "建立正身",
      "註冊分身",
      "驗明正身",
    ]);
  });

  it("numbers the steps 1, 2, 3 in order", () => {
    expect(aboutContent.how.steps.map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("has three trust points", () => {
    expect(aboutContent.trust.items).toHaveLength(3);
  });
});

describe("aboutContent — key anchor copy", () => {
  it("keeps the universal hook line", () => {
    expect(aboutContent.hook.title).toContain("這真的是我");
  });

  it("leads the brand as guasi", () => {
    expect(aboutContent.brand.wordmark).toBe("guasi");
  });

  it("introduces 正身 with its romanization only (no 本尊 gloss)", () => {
    expect(blob).toContain("(tsiànn-sin)");
    // Only the 正身 gloss must avoid 本尊. The hook body intentionally quotes a
    // scammer's voice (「本尊回來了」) — that use is narrative, not definitional.
    expect(aboutContent.how.gloss).not.toContain("本尊");
  });
});
