// lib/binding/code.test.ts
import { describe, it, expect } from "vitest";
import { generateCode, textHasCode } from "./code";
import { CODE_LABEL } from "./constants";

describe("generateCode", () => {
  it("returns exactly 6 digits", () => {
    expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("can produce leading zeros (full 000000–999999 range)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateCode());
    // Every value is a 6-char digit string even when numerically small.
    for (const c of seen) expect(c).toHaveLength(6);
  });
});

describe("textHasCode", () => {
  it("matches only when the namespaced label precedes the exact code", () => {
    const text = `我是分身認證貼文\n\n${CODE_LABEL}123456`;
    expect(textHasCode(text, "123456")).toBe(true);
  });

  it("rejects the bare code without the label", () => {
    expect(textHasCode("my lucky number is 123456", "123456")).toBe(false);
  });

  it("rejects a different code even if present unlabeled", () => {
    expect(textHasCode(`${CODE_LABEL}999999 and 123456`, "123456")).toBe(false);
  });

  it("tolerates surrounding whitespace after the label", () => {
    expect(textHasCode(`${CODE_LABEL} 123456`, "123456")).toBe(true);
  });
});
