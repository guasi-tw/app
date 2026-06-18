// lib/binding/platforms/miin.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { miinAdapter } from "./miin";
import { getAdapter, listSlugEligible } from "./index";

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

// A nested miin story API response (the REAL shape, captured 2026-06-18 from
// api.miin.cc/web/story/v3/story?storyId=7651906): author at story.data.author.data.username,
// display name at .nickname; text = concat of .text across title[]+content[] segments.
function storyJson(opts: {
  username: string;
  nickname?: string;
  title?: string[]; // each becomes a { text } segment
  content?: string[];
}) {
  const seg = (t: string) => ({ text: t });
  const authorData: Record<string, unknown> = { username: opts.username };
  if (opts.nickname !== undefined) authorData.nickname = opts.nickname;
  return {
    story: {
      data: {
        author: { data: authorData },
        title: (opts.title ?? []).map(seg),
        content: (opts.content ?? []).map(seg),
      },
    },
  };
}

function mockJson(body: unknown, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({ ok, status, json: async () => body });
}

const PARSED = { postId: "12345", fetchUrl: "https://api.miin.cc/web/story/v3/story?storyId=12345" };

describe("miinAdapter.resolvePost (happy path)", () => {
  it("resolves the authoritative author, distinct display name, and query-free canonical URL", async () => {
    vi.stubGlobal("fetch", mockJson(storyJson({
      username: "gua_si_tw",
      nickname: "我是正身", // distinct from username → surfaced as displayName
      title: ["#Gua: SansWA"],
      content: ["我是分身驗證碼：012345"],
    })));
    const res = await miinAdapter.resolvePost(PARSED, "012345");
    expect(res.handle).toBe("gua_si_tw");
    expect(res.accountId).toBe("gua_si_tw"); // handle.trim().toLowerCase()
    expect(res.displayName).toBe("我是正身");
    expect(res.codePresent).toBe(true);
    expect(res.canonicalUrl).toBe("https://miin.cc/story/12345"); // clean, query-free
  });

  it("parses the REAL captured story 7651906 response (nickname == username → displayName null)", async () => {
    // Verbatim shape from api.miin.cc/web/story/v3/story?storyId=7651906 (2026-06-18). This real
    // post carries no verification code, so codePresent is false.
    const real = {
      story: {
        storyId: 7651906,
        state: "normal",
        data: {
          title: [
            { state: "normal", type: "hashtag", text: "#Gua", data: { query: "#Gua" } },
            { state: "normal", type: "plain", text: ": SansWA", data: {} },
          ],
          content: [],
          author: {
            userId: 55619,
            state: "normal",
            data: { username: "gua_si_tw", nickname: "gua_si_tw", relation: "none" },
          },
        },
      },
    };
    vi.stubGlobal("fetch", mockJson(real));
    const res = await miinAdapter.resolvePost(
      { postId: "7651906", fetchUrl: "https://api.miin.cc/web/story/v3/story?storyId=7651906" },
      "012345",
    );
    expect(res.handle).toBe("gua_si_tw");
    expect(res.accountId).toBe("gua_si_tw");
    expect(res.displayName).toBeNull(); // nickname === username → no distinct display name
    expect(res.codePresent).toBe(false);
    expect(res.canonicalUrl).toBe("https://miin.cc/story/7651906");
  });

  it("finds the code when it lives in the title (short post, content empty)", async () => {
    vi.stubGlobal("fetch", mockJson(storyJson({
      username: "gua_si_tw",
      title: ["我是分身驗證碼：424242"],
      content: [],
    })));
    const res = await miinAdapter.resolvePost(PARSED, "424242");
    expect(res.codePresent).toBe(true);
  });

  it("reports codePresent=false when the code is absent or wrong, author still resolved", async () => {
    vi.stubGlobal("fetch", mockJson(storyJson({
      username: "gua_si_tw",
      content: ["我是分身驗證碼：000000"],
    })));
    const res = await miinAdapter.resolvePost(PARSED, "999999");
    expect(res.codePresent).toBe(false);
    expect(res.handle).toBe("gua_si_tw");
  });

  it("returns displayName=null when nickname is absent or equals the username", async () => {
    vi.stubGlobal("fetch", mockJson(storyJson({ username: "gua_si_tw", title: ["hi"] })));
    expect((await miinAdapter.resolvePost(PARSED, "012345")).displayName).toBeNull();

    vi.stubGlobal("fetch", mockJson(storyJson({ username: "gua_si_tw", nickname: "gua_si_tw", title: ["hi"] })));
    expect((await miinAdapter.resolvePost(PARSED, "012345")).displayName).toBeNull();
  });
});

describe("miinAdapter.resolvePost (failure taxonomy + logging)", () => {
  function expectLogged(spy: ReturnType<typeof vi.spyOn>, kind: string, status: number | null) {
    expect(spy).toHaveBeenCalledWith(
      "[miin.resolvePost] fetch failed",
      expect.objectContaining({ kind, storyId: "12345", status }),
    );
  }

  it("classifies a network/fetch rejection as `network` (status null) and throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(miinAdapter.resolvePost(PARSED, "012345")).rejects.toThrow(/network/);
    expectLogged(spy, "network", null);
    spy.mockRestore();
  });

  it("classifies 401/403 as `auth_required` (the headline lockdown risk) and throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockJson({}, { ok: false, status: 403 }));
    await expect(miinAdapter.resolvePost(PARSED, "012345")).rejects.toThrow(/auth_required/);
    expectLogged(spy, "auth_required", 403);
    spy.mockRestore();
  });

  it("classifies 429 as `rate_limited` and throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockJson({}, { ok: false, status: 429 }));
    await expect(miinAdapter.resolvePost(PARSED, "012345")).rejects.toThrow(/rate_limited/);
    expectLogged(spy, "rate_limited", 429);
    spy.mockRestore();
  });

  it("classifies other non-2xx as `http_error` and throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockJson({}, { ok: false, status: 500 }));
    await expect(miinAdapter.resolvePost(PARSED, "012345")).rejects.toThrow(/http_error/);
    expectLogged(spy, "http_error", 500);
    spy.mockRestore();
  });

  it("classifies a 2xx with missing author as `shape_mismatch` and throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockJson({ story: { data: { title: [], content: [] } } }));
    await expect(miinAdapter.resolvePost(PARSED, "012345")).rejects.toThrow(/shape_mismatch/);
    expectLogged(spy, "shape_mismatch", 200);
    spy.mockRestore();
  });

  it("NEVER logs the auth code in the structured payload", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", mockJson({}, { ok: false, status: 403 }));
    await expect(miinAdapter.resolvePost(PARSED, "424242")).rejects.toThrow();
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("424242");
    spy.mockRestore();
  });
});

describe("registry wiring", () => {
  it("getAdapter('miin') returns the miin adapter", () => {
    expect(getAdapter("miin")).toBe(miinAdapter);
  });

  it("listSlugEligible() excludes miin (it cannot mint a slug) but includes threads", () => {
    const keys = listSlugEligible().map((a) => a.key);
    expect(keys).toContain("threads");
    expect(keys).not.toContain("miin");
  });
});

describe("deterministic accountId (recovery guard, §3.4)", () => {
  it("resolves the same accountId across calls and normalizes casing/whitespace", async () => {
    vi.stubGlobal("fetch", mockJson(storyJson({ username: "Gua_Si_Tw", title: ["hi"] })));
    const a = await miinAdapter.resolvePost(PARSED, "012345");
    const b = await miinAdapter.resolvePost(PARSED, "012345");
    expect(a.accountId).toBe("gua_si_tw");
    expect(b.accountId).toBe(a.accountId);

    vi.stubGlobal("fetch", mockJson(storyJson({ username: "  GUA_SI_TW  ", title: ["hi"] })));
    const c = await miinAdapter.resolvePost(PARSED, "012345");
    expect(c.accountId).toBe("gua_si_tw"); // same identity → same accountId → clears the same-account guard
  });
});
