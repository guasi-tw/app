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

// A Response-shaped mock: real fetch follows redirects and exposes the FINAL `url` + `text()`.
function mockFetch(html: string, url = "https://www.instagram.com/gua.si.dev/p/DZveut0kiPi/") {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => html });
}

// og:url = author authority; og:title = display name (bare "@handle" form → null); the entity-encoded
// caption (incl. the code) lives in the BODY. `&#064;`=@, `&#xff1a;`=：, `&quot;`=".
const CODE_LABEL_ENC = "&#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;"; // 我是分身驗證碼：
const page = (ogUrl: string, ogTitle: string, body: string) =>
  `<html><head><meta property="og:url" content="${ogUrl}">` +
  `<meta property="og:title" content="${ogTitle}"></head><body>${body}</body></html>`;

describe("instagramAdapter.resolvePost", () => {
  it("resolves the real gua.si.dev/DZveut0kiPi response: author gua.si.dev + code 634057", async () => {
    const html = page(
      "https://www.instagram.com/gua.si.dev/p/DZveut0kiPi/",
      "&#064;gua.si.dev on Instagram: &quot;#guasi",
      `#guasi ${CODE_LABEL_ENC}634057`,
    );
    vi.stubGlobal("fetch", mockFetch(html));
    const res = await instagramAdapter.resolvePost(
      { postId: "DZveut0kiPi", fetchUrl: "https://www.instagram.com/p/DZveut0kiPi/?igsh=x" },
      "634057",
    );
    expect(res.handle).toBe("gua.si.dev");
    expect(res.accountId).toBe("gua.si.dev"); // lowercased authoritative id
    expect(res.displayName).toBeNull(); // bare og:title → no display name
    expect(res.codePresent).toBe(true); // code scanned from the decoded body (entity-decoded)
    expect(res.canonicalUrl).toBe("https://www.instagram.com/gua.si.dev/p/DZveut0kiPi/"); // clean og:url
    // Negative control — decode is LOAD-BEARING: the literal CJK label never appears raw in the
    // fixture, so a true match could only have come from decodeEntities running first.
    expect(html.includes("我是分身驗證碼：")).toBe(false);
  });

  it("parses the NAMED og:title form (display name present)", async () => {
    const html = page(
      "https://www.instagram.com/nasa/p/ABC123/",
      "NASA on Instagram: &quot;hello",
      `hi ${CODE_LABEL_ENC}012345`,
    );
    vi.stubGlobal("fetch", mockFetch(html, "https://www.instagram.com/nasa/p/ABC123/"));
    const res = await instagramAdapter.resolvePost({ postId: "ABC123", fetchUrl: "https://www.instagram.com/p/ABC123/" }, "012345");
    expect(res.handle).toBe("nasa");
    expect(res.displayName).toBe("NASA");
    expect(res.codePresent).toBe(true);
  });

  it("reads the TRUE author from og:url regardless of the pasted path handle (spoof defense, §6.3)", async () => {
    const html = page("https://www.instagram.com/nasa/p/ABC123/", "NASA on Instagram: &quot;x", "x");
    vi.stubGlobal("fetch", mockFetch(html, "https://www.instagram.com/nasa/p/ABC123/"));
    // Pasted path says @zuck; authority (og:url) says nasa → bind nasa.
    const res = await instagramAdapter.resolvePost({ postId: "ABC123", fetchUrl: "https://www.instagram.com/zuck/p/ABC123/" }, "000000");
    expect(res.handle).toBe("nasa");
  });

  it("reports codePresent=false when the requested code is absent", async () => {
    const html = page("https://www.instagram.com/gua.si.dev/p/X/", "&#064;gua.si.dev on Instagram: &quot;x", `${CODE_LABEL_ENC}000000`);
    vi.stubGlobal("fetch", mockFetch(html, "https://www.instagram.com/gua.si.dev/p/X/"));
    const res = await instagramAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.instagram.com/p/X/" }, "999999");
    expect(res.codePresent).toBe(false); // author still resolved; only the code didn't match
    expect(res.handle).toBe("gua.si.dev");
  });

  it("retries once when og:url is missing on the first fetch", async () => {
    const ok = page("https://www.instagram.com/h/p/X/", "&#064;h on Instagram: &quot;x", `${CODE_LABEL_ENC}012345`);
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, url: "https://www.instagram.com/p/X/", text: async () => "<html></html>" })
      .mockResolvedValueOnce({ ok: true, status: 200, url: "https://www.instagram.com/h/p/X/", text: async () => ok });
    vi.stubGlobal("fetch", f);
    const res = await instagramAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.instagram.com/p/X/" }, "012345");
    expect(f).toHaveBeenCalledTimes(2);
    expect(res.handle).toBe("h");
  });

  it("throws when the author cannot be resolved after retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, url: "https://www.instagram.com/p/X/", text: async () => "<html></html>" }));
    await expect(
      instagramAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.instagram.com/p/X/" }, "012345"),
    ).rejects.toThrow();
  });

  it("throws when og:url points off-platform (author authority host guard, §4)", async () => {
    const html = page("https://evil.com/nasa/p/X/", "NASA on Instagram: &quot;x", "x");
    vi.stubGlobal("fetch", mockFetch(html, "https://www.instagram.com/p/X/"));
    await expect(
      instagramAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.instagram.com/p/X/" }, "012345"),
    ).rejects.toThrow();
  });

  it("throws when a redirect lands off-platform (§6.3 final-host guard)", async () => {
    const html = page("https://www.instagram.com/h/p/X/", "&#064;h on Instagram: &quot;x", "x");
    vi.stubGlobal("fetch", mockFetch(html, "https://evil.com/fake"));
    await expect(
      instagramAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.instagram.com/p/X/" }, "012345"),
    ).rejects.toThrow(/off-platform/);
  });
});
