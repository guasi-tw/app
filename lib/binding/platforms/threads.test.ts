// lib/binding/platforms/threads.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { threadsAdapter } from "./threads";

afterEach(() => vi.unstubAllGlobals());

// The fetch mock returns a Response-shaped object: real fetch follows redirects and exposes
// the FINAL `url` + `text()`; we mock both so the §6.3 final-host guard is exercised.
function mockFetch(html: string, url = "https://www.threads.com/@live.defrag/post/X") {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => html });
}

// A realistic page: og:title only (no og:description — Threads omits it when the post has a link),
// with the entity-encoded caption embedded in the BODY. `&#064;`=@, `&#xff1a;`=：(full-width colon).
const page = (title: string, bodyCaption: string) =>
  `<html><head><meta property="og:title" content="${title}"></head><body>${bodyCaption}</body></html>`;

describe("threadsAdapter.parsePostUrl", () => {
  it("accepts canonical threads.net + threads.com post URLs (and tolerates query params)", () => {
    expect(threadsAdapter.parsePostUrl("https://www.threads.net/@live.defrag/post/DZmmGyIGe3g")?.postId).toBe("DZmmGyIGe3g");
    expect(threadsAdapter.parsePostUrl("https://threads.com/@x/post/ABC123")?.postId).toBe("ABC123");
    // Real shares carry ?xmt=…&slof=1 — the postId still parses from the path.
    expect(threadsAdapter.parsePostUrl("https://www.threads.com/@gua.si.tw/post/DZqu0RjGmZr?xmt=AQG0&slof=1")?.postId).toBe("DZqu0RjGmZr");
  });

  it("rejects non-Threads, non-HTTPS, look-alike host, and non-post paths", () => {
    expect(threadsAdapter.parsePostUrl("https://instagram.com/p/DZmqdCog-Vm/")).toBeNull();
    expect(threadsAdapter.parsePostUrl("http://www.threads.net/@x/post/ABC123")).toBeNull();
    expect(threadsAdapter.parsePostUrl("https://threads.net.evil.com/@x/post/ABC123")).toBeNull();
    expect(threadsAdapter.parsePostUrl("https://www.threads.net/@x")).toBeNull();
  });
});

describe("threadsAdapter.resolvePost", () => {
  it("parses the PARENS og:title form (name + handle) and finds the code in the body", async () => {
    vi.stubGlobal("fetch", mockFetch(page("Defrag (&#064;live.defrag) on Threads", "hi &#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;012345")));
    const res = await threadsAdapter.resolvePost({ postId: "DZmmGyIGe3g", fetchUrl: "https://www.threads.com/@x/post/DZmmGyIGe3g" }, "012345");
    expect(res.handle).toBe("live.defrag");
    expect(res.accountId).toBe("live.defrag"); // lowercased authoritative id
    expect(res.displayName).toBe("Defrag");
    expect(res.codePresent).toBe(true);
    // Canonical URL reconstructed from authoritative handle + postId — query-free, no tracking token.
    expect(res.canonicalUrl).toBe("https://www.threads.com/@live.defrag/post/DZmmGyIGe3g");
  });

  it("parses the real @gua.si.tw/DZqwB3Imnp2 response: author @gua.si.tw + code ABCDEF", async () => {
    const realHtml = page(
      "&#064;gua.si.tw on Threads",
      "&#x6211;&#x662f;&#x5206;&#x8eab;&#x8a8d;&#x8b49;&#x8cbc;&#x6587;\n&#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;ABCDEF",
    );
    vi.stubGlobal("fetch", mockFetch(realHtml));
    const res = await threadsAdapter.resolvePost(
      { postId: "DZqwB3Imnp2", fetchUrl: "https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2" },
      "ABCDEF",
    );
    expect(res.handle).toBe("gua.si.tw");
    expect(res.accountId).toBe("gua.si.tw");
    expect(res.displayName).toBeNull(); // bare og:title → no display name
    expect(res.codePresent).toBe(true); // code scanned from the decoded body, not og:description
    expect(res.canonicalUrl).toBe("https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2"); // query-free
  });

  it("reports codePresent=false when the code is absent or wrong", async () => {
    vi.stubGlobal("fetch", mockFetch(page("&#064;gua.si.tw on Threads", "&#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;000000")));
    const res = await threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "999999");
    expect(res.codePresent).toBe(false); // author still resolved; only the code didn't match
    expect(res.handle).toBe("gua.si.tw");
  });

  it("reads the TRUE author regardless of the pasted path handle (spoof defense, §6.3)", async () => {
    vi.stubGlobal("fetch", mockFetch(page("&#064;live.defrag on Threads", "x")));
    const res = await threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@zuck/post/X" }, "012345");
    expect(res.handle).toBe("live.defrag");
  });

  it("retries once when og:title is missing on the first fetch", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, url: "https://www.threads.com/@x/post/X", text: async () => "<html></html>" })
      .mockResolvedValueOnce({ ok: true, status: 200, url: "https://www.threads.com/@x/post/X", text: async () => page("&#064;h on Threads", "t") });
    vi.stubGlobal("fetch", f);
    const res = await threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "012345");
    expect(f).toHaveBeenCalledTimes(2);
    expect(res.handle).toBe("h");
  });

  it("throws when the author cannot be resolved after retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, url: "https://www.threads.com/@x/post/X", text: async () => "<html></html>" }));
    await expect(
      threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "012345"),
    ).rejects.toThrow();
  });

  it("throws when a redirect lands off-platform (§6.3 final-host guard)", async () => {
    vi.stubGlobal("fetch", mockFetch(page("&#064;h on Threads", "t"), "https://evil.com/fake"));
    await expect(
      threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "012345"),
    ).rejects.toThrow(/off-platform/);
  });
});

describe("threadsAdapter.profileUrl", () => {
  it("builds the canonical threads.com profile URL from a bare handle", () => {
    expect(threadsAdapter.profileUrl("alice")).toBe(
      "https://www.threads.com/@alice",
    );
  });

  it("does not double-prefix when the stored handle has no @", () => {
    expect(threadsAdapter.profileUrl("bob.dev")).toBe(
      "https://www.threads.com/@bob.dev",
    );
  });
});

describe("threadsAdapter.composeIntentUrl + hashtag", () => {
  it("builds a prefilled threads.com compose intent", () => {
    const url = threadsAdapter.composeIntentUrl!("hello world");
    expect(url.startsWith("https://www.threads.com/intent/post?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("hello world");
  });

  it("declares no hashtag (Threads uses topics, not pasteable #tags)", () => {
    expect(threadsAdapter.hashtag).toBeNull();
  });
});
