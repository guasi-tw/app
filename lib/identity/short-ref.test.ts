import { describe, it, expect } from "vitest";
import { generateShortRef, SHORT_REF_ALPHABET } from "./short-ref";

describe("generateShortRef", () => {
  it("returns a 10-char token by default", () => {
    expect(generateShortRef()).toHaveLength(10);
  });

  it("honors a custom length", () => {
    expect(generateShortRef(6)).toHaveLength(6);
  });

  it("uses only the base62 alphabet", () => {
    const ref = generateShortRef(64);
    for (const ch of ref) expect(SHORT_REF_ALPHABET).toContain(ch);
  });

  it("is overwhelmingly unique across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShortRef());
    expect(seen.size).toBe(1000);
  });
});
