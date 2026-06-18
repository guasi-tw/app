// lib/binding/platforms/miin.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { miinAdapter } from "./miin";

afterEach(() => vi.unstubAllGlobals());

describe("miinAdapter.parsePostUrl", () => {
  it("accepts a canonical https miin.cc story URL and builds the api.miin.cc fetch URL", () => {
    const p = miinAdapter.parsePostUrl("https://miin.cc/story/12345");
    expect(p?.postId).toBe("12345");
    expect(p?.fetchUrl).toBe("https://api.miin.cc/web/story/v3/story?storyId=12345");
  });

  it("tolerates a trailing slash", () => {
    expect(miinAdapter.parsePostUrl("https://miin.cc/story/12345/")?.postId).toBe("12345");
  });

  it("rejects non-HTTPS, wrong host, look-alike hosts, subdomains, and non-story paths", () => {
    expect(miinAdapter.parsePostUrl("http://miin.cc/story/12345")).toBeNull();          // not https
    expect(miinAdapter.parsePostUrl("https://miin.cc.evil.com/story/12345")).toBeNull(); // look-alike
    expect(miinAdapter.parsePostUrl("https://notmiin.cc/story/12345")).toBeNull();       // look-alike
    expect(miinAdapter.parsePostUrl("https://www.miin.cc/story/12345")).toBeNull();      // subdomain
    expect(miinAdapter.parsePostUrl("https://threads.com/@x/post/ABC")).toBeNull();      // other platform
    expect(miinAdapter.parsePostUrl("https://miin.cc/user/gua_si_tw")).toBeNull();       // profile path
    expect(miinAdapter.parsePostUrl("https://miin.cc/story/abc")).toBeNull();            // non-numeric id
    expect(miinAdapter.parsePostUrl("https://miin.cc/story/")).toBeNull();               // missing id
    expect(miinAdapter.parsePostUrl("not a url")).toBeNull();                            // unparseable
  });
});

describe("miinAdapter.profileUrl + fields", () => {
  it("builds the canonical user profile URL from a bare handle", () => {
    expect(miinAdapter.profileUrl("gua_si_tw")).toBe("https://miin.cc/user/gua_si_tw");
  });

  it("declares its identity fields", () => {
    expect(miinAdapter.key).toBe("miin");
    expect(miinAdapter.label).toBe("miin.cc");
    expect(miinAdapter.serviceTag).toBe("@gua_si_tw");
    expect(miinAdapter.hashtag).toBe("#guasi");
    expect(miinAdapter.slugEligible).toBe(false);
    expect(miinAdapter.composeIntentUrl).toBeUndefined(); // miin has no prefilled compose intent
  });
});
