// lib/binding/slug.test.ts
import { describe, it, expect } from "vitest";
import { deriveSlug } from "./slug";

describe("deriveSlug", () => {
  it("returns the proven handle verbatim — never a synthesized variant (§D.4/§3)", () => {
    expect(deriveSlug("alice")).toBe("alice");
  });

  it("trims surrounding whitespace", () => {
    expect(deriveSlug("  alice  ")).toBe("alice");
  });
});
