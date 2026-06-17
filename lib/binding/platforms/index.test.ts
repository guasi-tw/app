// lib/binding/platforms/index.test.ts
import { describe, it, expect } from "vitest";
import { getAdapter, listSlugEligible } from "./index";

describe("platform registry (Slice 2 — Threads only)", () => {
  it("returns the Threads adapter", () => {
    expect(getAdapter("threads")?.key).toBe("threads");
  });

  it("returns undefined for not-yet-built platforms (IG/miin land later)", () => {
    expect(getAdapter("instagram")).toBeUndefined();
    expect(getAdapter("miin")).toBeUndefined();
  });

  it("returns undefined for an unknown platform string", () => {
    expect(getAdapter("myspace")).toBeUndefined();
  });

  it("lists Threads as slug-eligible", () => {
    expect(listSlugEligible().map((a) => a.key)).toContain("threads");
  });
});
