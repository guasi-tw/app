// lib/binding/platforms/index.test.ts
import { describe, it, expect } from "vitest";
import { getAdapter, listSlugEligible } from "./index";

describe("platform registry (Threads + miin + Instagram shipped)", () => {
  it("returns the Threads adapter", () => {
    expect(getAdapter("threads")?.key).toBe("threads");
  });

  it("returns the miin adapter", () => {
    expect(getAdapter("miin")?.key).toBe("miin");
  });

  it("returns the Instagram adapter", () => {
    expect(getAdapter("instagram")?.key).toBe("instagram");
  });

  it("returns undefined for an unknown platform string", () => {
    expect(getAdapter("myspace")).toBeUndefined();
  });

  it("lists Threads + Instagram as slug-eligible but not miin", () => {
    const keys = listSlugEligible().map((a) => a.key);
    expect(keys).toContain("threads");
    expect(keys).toContain("instagram");
    expect(keys).not.toContain("miin");
  });
});
