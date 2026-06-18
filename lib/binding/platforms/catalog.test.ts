// lib/binding/platforms/catalog.test.ts
import { describe, it, expect } from "vitest";
import { PLATFORM_CATALOG, pickablePlatforms } from "./catalog";
import { getAdapter } from "./index";

describe("pickablePlatforms", () => {
  it("a slug-less (onboarding) user sees only slug-eligible platforms; miin is hidden", () => {
    const keys = pickablePlatforms(false).map((p) => p.key);
    expect(keys).toContain("threads");
    expect(keys).toContain("instagram");
    expect(keys).not.toContain("miin"); // slug-ineligible → hidden entirely (not shown-disabled)
  });

  it("a provisioned user (has a slug) sees every platform", () => {
    const keys = pickablePlatforms(true).map((p) => p.key);
    expect(keys).toEqual(PLATFORM_CATALOG.map((p) => p.key)); // all, in catalog order
  });
});

describe("catalog/adapter consistency", () => {
  it("each catalog entry's slugEligible matches its registered adapter (when one exists)", () => {
    for (const entry of PLATFORM_CATALOG) {
      const adapter = getAdapter(entry.key);
      if (adapter) expect(entry.slugEligible).toBe(adapter.slugEligible);
    }
  });
});
