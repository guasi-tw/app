// lib/binding/platforms/instagram.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { instagramAdapter } from "./instagram";

afterEach(() => vi.unstubAllGlobals());

describe("instagramAdapter.parsePostUrl", () => {
  it("accepts /p/<sc>/ and /<handle>/p/<sc>/ (handle discarded), tolerates ?igsh=", () => {
    expect(instagramAdapter.parsePostUrl("https://www.instagram.com/p/DZveut0kiPi/")?.postId).toBe("DZveut0kiPi");
    expect(instagramAdapter.parsePostUrl("https://instagram.com/gua.si.dev/p/DZveut0kiPi/")?.postId).toBe("DZveut0kiPi");
    // Real shares carry ?igsh=… — the postId still parses from the path.
    expect(instagramAdapter.parsePostUrl("https://www.instagram.com/p/DZveut0kiPi/?igsh=MWF0emdubTZv")?.postId).toBe("DZveut0kiPi");
  });

  it("rejects /reel/, non-IG, non-HTTPS, look-alike host, and non-post paths", () => {
    expect(instagramAdapter.parsePostUrl("https://www.instagram.com/reel/DZveut0kiPi/")).toBeNull(); // out of scope
    expect(instagramAdapter.parsePostUrl("https://www.instagram.com/gua.si.dev/reel/DZveut0kiPi/")).toBeNull();
    expect(instagramAdapter.parsePostUrl("https://www.threads.com/@x/post/ABC123")).toBeNull();
    expect(instagramAdapter.parsePostUrl("http://www.instagram.com/p/ABC123/")).toBeNull();
    expect(instagramAdapter.parsePostUrl("https://instagram.com.evil.com/p/ABC123/")).toBeNull();
    expect(instagramAdapter.parsePostUrl("https://notinstagram.com/p/ABC123/")).toBeNull();
    expect(instagramAdapter.parsePostUrl("https://www.instagram.com/gua.si.dev/")).toBeNull(); // profile, not a post
  });
});

describe("instagramAdapter.profileUrl", () => {
  it("builds the canonical IG profile URL from a bare handle (no @, with dots)", () => {
    expect(instagramAdapter.profileUrl("gua.si.tw")).toBe("https://www.instagram.com/gua.si.tw/");
  });
});

describe("instagramAdapter static config", () => {
  it("declares the IG hashtag, slug eligibility, and no compose intent", () => {
    expect(instagramAdapter.key).toBe("instagram");
    expect(instagramAdapter.serviceTag).toBe("@gua.si.tw"); // production handle (≠ fixture author gua.si.dev)
    expect(instagramAdapter.hashtag).toBe("#guasi");
    expect(instagramAdapter.slugEligible).toBe(true);
    expect(instagramAdapter.composeIntentUrl).toBeUndefined(); // IG has no web compose intent
  });
});
