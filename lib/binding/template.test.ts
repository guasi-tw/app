// lib/binding/template.test.ts
import { describe, it, expect } from "vitest";
import { buildVerificationPost, profileUrlFor } from "./template";
import { SITE_ORIGIN, CODE_LABEL } from "./constants";

describe("profileUrlFor", () => {
  it("uses the /r/{shortRef} short link when no slug is minted yet (§D.2.1)", () => {
    expect(profileUrlFor({ slug: null, shortRef: "Ab12Cd34Ef" })).toBe(
      `${SITE_ORIGIN}/r/Ab12Cd34Ef`,
    );
  });

  it("uses the clean /gua/{slug} URL once provisioned", () => {
    expect(profileUrlFor({ slug: "alice", shortRef: "Ab12Cd34Ef" })).toBe(
      `${SITE_ORIGIN}/gua/alice`,
    );
  });
});

describe("buildVerificationPost", () => {
  // Threads: no hashtag (topics aren't created by a pasted #tag) — lead with the service tag.
  const threadsPost = buildVerificationPost({
    hashtag: null,
    serviceTag: "@gua.si.tw",
    profileUrl: `${SITE_ORIGIN}/r/Ab12Cd34Ef`,
    code: "012345",
  });

  it("omits the hashtag when null and leads with the service tag (Threads)", () => {
    expect(threadsPost.startsWith("@gua.si.tw")).toBe(true);
    expect(threadsPost).not.toContain("#");
  });

  it("includes the service tag, profile URL, and namespaced code", () => {
    expect(threadsPost).toContain("@gua.si.tw");
    expect(threadsPost).toContain(`${SITE_ORIGIN}/r/Ab12Cd34Ef`);
    expect(threadsPost).toContain(`${CODE_LABEL}012345`);
  });

  it("leads with the hashtag when one is supplied (e.g. IG in a later slice)", () => {
    const igStyle = buildVerificationPost({
      hashtag: "#guasi",
      serviceTag: "@gua.si",
      profileUrl: `${SITE_ORIGIN}/gua/alice`,
      code: "012345",
    });
    expect(igStyle.startsWith("#guasi")).toBe(true);
  });
});
