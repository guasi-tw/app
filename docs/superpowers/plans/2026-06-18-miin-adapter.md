# miin.cc PlatformAdapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `miin` `PlatformAdapter` (+ picker filtering) so a provisioned user can verify and bind a miin.cc account as a non-main 分身 end-to-end, while slug-less onboarding users never see miin in the picker.

**Architecture:** A self-contained `lib/binding/platforms/miin.ts` mirroring `threads.ts` (Approach A — no shared fetch abstraction; rule of three deferred until IG ships). miin reads via its public `api.miin.cc` JSON API (one `fetch` + `JSON.parse`, no scraping). Activation is one line in the adapter registry. A new static platform **catalog** module carries per-platform `slugEligible` metadata (needed even for adapter-less 施工中 platforms) so the `/add` picker can hide slug-ineligible platforms during onboarding.

**Tech Stack:** TypeScript, Next.js App Router (server components + server actions), Vitest (fixture-driven, no network), native `fetch`.

---

## ⚠️ Reconciliation note (read before Task 2)

The brainstorm spec §3.2 sketches the miin JSON as **flat** (`author.username`, `title`/`content` as strings). That is a simplification. The brainstorm's own header names **`docs/platform-verification.md` §3.3 as the source of truth for read mechanics**, and §3.3 + the §8 evidence log document the **actual nested shape**:

- **Author username:** `story.data.author.data.username`
- **Code-bearing text:** concatenate the `.text` of every segment in `story.data.title[]` **and** `story.data.content[]` (both are arrays; short posts carry text in `title` with `content` empty, longer posts fill `content` — a 415-char body was returned in full, untruncated).

**This plan implements the nested shape**, confirmed against a **live capture of `api.miin.cc/web/story/v3/story?storyId=7651906`** (2026-06-18):

```json
{"story":{"storyId":7651906,"data":{
  "title":[{"type":"hashtag","text":"#Gua","data":{"query":"#Gua"}},{"type":"plain","text":": SansWA","data":{}}],
  "content":[],
  "author":{"userId":55619,"data":{"username":"gua_si_tw","nickname":"gua_si_tw","avatar":[…],"relation":"none"}}
}}}
```

- **Author display name field is `nickname`** (the only name field miin returns). miin **defaults `nickname` to the `username`** (here both are `"gua_si_tw"`), so the adapter reads `nickname` directly and treats `nickname === username` as "no distinct display name" (`null`) — mirroring Threads' bare-handle semantics. `displayName` is non-load-bearing (`accountId`/`handle` come from `username`).
- **title/content emptiness:** a valid short post has `content: []` (confirmed above). The shape guard therefore keys on the **author username** (the load-bearing field) plus the envelope; missing/empty `title`/`content` arrays are tolerated (→ `codePresent: false`), not treated as `shape_mismatch`.

---

## File Structure

| File | Responsibility |
|---|---|
| Create: `lib/binding/platforms/miin.ts` | The `miinAdapter` — `parsePostUrl` (security gate), `resolvePost` (one authoritative `api.miin.cc` fetch + classified failure logging), adapter fields. |
| Create: `lib/binding/platforms/miin.test.ts` | Fixture-driven unit tests mirroring `threads.test.ts` (parse, resolve, failure taxonomy, profileUrl, registry, deterministic accountId). |
| Modify: `lib/binding/platforms/index.ts` | Register `miin: miinAdapter` (the activation switch). |
| Create: `lib/binding/platforms/catalog.ts` | Static per-platform presentation metadata (`key`, `label`, `slugEligible`) incl. adapter-less platforms, + `pickablePlatforms(hasSlug)` pure filter. |
| Create: `lib/binding/platforms/catalog.test.ts` | Picker-filter tests + a consistency guard (catalog `slugEligible` matches each registered adapter). |
| Modify: `app/(site)/add/page.tsx` | Drive the picker off the catalog + hide slug-ineligible platforms for slug-less users. |

Files **verified-unchanged** (no edits — confirm only): `app/(site)/add/[platform]/AddAccountWizard.tsx` and `app/(site)/add/[platform]/page.tsx` already guard the compose button on `composeIntentUrl` presence; `confirm/page.tsx` already routes the in-scope (`OrdinaryConfirm`) and `?recover=` (`RecoverConfirm`) branches generically; `template.ts` is already generic. See Task 7.

---

## Task 1: miin adapter — `parsePostUrl` security gate + adapter skeleton

**Files:**
- Create: `lib/binding/platforms/miin.ts`
- Test: `lib/binding/platforms/miin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/binding/platforms/miin.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/binding/platforms/miin.test.ts`
Expected: FAIL — `Cannot find module './miin'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `lib/binding/platforms/miin.ts` (full adapter; `resolvePost` is a throwing stub fleshed out in Tasks 2–3):

```ts
// lib/binding/platforms/miin.ts
// Self-contained miin.cc adapter (Approach A — mirrors threads.ts, no shared fetch abstraction).
// miin is a client-rendered SPA whose page HTML is author-less, but it exposes a public,
// unauthenticated JSON API (api.miin.cc) that returns the post author + full text inline — the
// lightest read path of the three MVP platforms (one fetch + JSON.parse, no scraping).
// Source of truth for read mechanics: docs/platform-verification.md §3.3.
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

// Canonical story path: /story/<numeric id>. The id is the trailing number of miin.cc/story/<id>.
const STORY_PATH = /^\/story\/(\d+)\/?$/;

function parsePostUrl(raw: string): ParsedPostUrl | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  // Host must EQUAL miin.cc exactly — rejects look-alikes (miin.cc.evil.com, notmiin.cc),
  // subdomains (www.miin.cc), and every non-miin.cc host.
  if (u.hostname !== "miin.cc") return null;
  const m = u.pathname.match(STORY_PATH);
  if (!m) return null;
  const storyId = m[1];
  // fetchUrl is CONSTRUCTED from the validated numeric id — never a user-supplied host (§3.1).
  return { postId: storyId, fetchUrl: `https://api.miin.cc/web/story/v3/story?storyId=${storyId}` };
}

async function resolvePost(_parsed: ParsedPostUrl, _code: string): Promise<ResolvedPost> {
  throw new Error("miin.resolvePost not implemented");
}

export const miinAdapter: PlatformAdapter = {
  key: "miin",
  label: "miin.cc",
  // guasi's miin handle — growth/discoverability decoration in the post template, NOT a security check.
  serviceTag: "@gua_si_tw",
  hashtag: "#guasi", // miin supports pasteable hashtags
  slugEligible: false, // a miin handle may not mint a slug (§1 out-of-scope rationale)
  profileUrl: (handle: string) => `https://miin.cc/user/${handle}`,
  parsePostUrl,
  resolvePost,
  // composeIntentUrl intentionally OMITTED — miin has no prefilled compose intent (wizard shows
  // copy-paste only). The optional member stays undefined; the wizard already guards on its presence.
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/binding/platforms/miin.test.ts`
Expected: PASS (the `parsePostUrl`, `profileUrl`, and fields suites; `resolvePost` is not yet exercised).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/miin.ts lib/binding/platforms/miin.test.ts
git commit -m "feat(miin): parsePostUrl security gate + adapter skeleton"
```

---

## Task 2: miin adapter — `resolvePost` author + code + canonical URL (happy path)

**Files:**
- Modify: `lib/binding/platforms/miin.ts`
- Test: `lib/binding/platforms/miin.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/binding/platforms/miin.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/binding/platforms/miin.test.ts -t "happy path"`
Expected: FAIL — `resolvePost` throws `"miin.resolvePost not implemented"`.

- [ ] **Step 3: Write minimal implementation**

In `lib/binding/platforms/miin.ts`, add the helpers above the adapter object and replace the `resolvePost` stub. (Failure classification/logging is added in Task 3 — here `resolvePost` only needs the success path plus a plain throw on a bad shape so the happy-path tests pass.)

Add this helper just below `STORY_PATH`:

```ts
// Concatenate the `.text` of every title + content segment. Both are arrays (§3.3): short posts
// carry text in `title` with `content` empty; longer posts fill `content`. The API returns the
// FULL untruncated text, so the Threads/IG "place the code early" truncation gotcha does NOT apply.
function segmentsText(segs: unknown): string {
  if (!Array.isArray(segs)) return "";
  return segs
    .map((s) => (s && typeof (s as { text?: unknown }).text === "string" ? (s as { text: string }).text : ""))
    .join("\n");
}
```

Replace the `resolvePost` stub with:

```ts
async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  const storyId = parsed.postId;
  const resp = await fetch(parsed.fetchUrl, { headers: { Accept: "application/json" } });
  const body: unknown = await resp.json();

  // Authoritative author — miin's own data keyed by the storyId we validated (§6.3), never parsed
  // from user page content. Nested shape per platform-verification §3.3.
  const data = (body as { story?: { data?: Record<string, unknown> } })?.story?.data;
  const authorData = (data?.author as { data?: Record<string, unknown> } | undefined)?.data;
  const username = authorData?.username;
  if (!data || typeof username !== "string" || !username.trim()) {
    throw new Error("miin.resolvePost failed: shape_mismatch");
  }

  const handle = username; // as returned (§3.2)
  const accountId = handle.trim().toLowerCase(); // deterministic per-owner key (§3.4 recovery guard)
  // Display name = the author's `nickname` (the only name field miin returns). miin defaults
  // nickname to the username, so treat nickname == username as "no distinct display name" (null) —
  // matching Threads' bare-handle semantics.
  const nickname = typeof authorData!.nickname === "string" ? authorData!.nickname.trim() : "";
  const displayName = nickname && nickname.toLowerCase() !== accountId ? nickname : null;
  const text = `${segmentsText(data.title)}\n${segmentsText(data.content)}`;
  const codePresent = textHasCode(text, code);
  const canonicalUrl = `https://miin.cc/story/${storyId}`; // clean, query-free (stored as proof_post_url)

  return { accountId, handle, displayName, codePresent, canonicalUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/binding/platforms/miin.test.ts`
Expected: PASS (all suites so far).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/miin.ts lib/binding/platforms/miin.test.ts
git commit -m "feat(miin): resolvePost — authoritative author, code scan, canonical URL"
```

---

## Task 3: miin adapter — failure taxonomy + structured logging

**Files:**
- Modify: `lib/binding/platforms/miin.ts`
- Test: `lib/binding/platforms/miin.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/binding/platforms/miin.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/binding/platforms/miin.test.ts -t "failure taxonomy"`
Expected: FAIL — the current `resolvePost` doesn't classify HTTP/network errors or emit the structured `console.error` line.

- [ ] **Step 3: Write minimal implementation**

In `lib/binding/platforms/miin.ts`, add the failure helper below the imports (above `STORY_PATH`):

```ts
// miin's API is UNOFFICIAL (public + unauthenticated today, versioned v2/v3, could add auth /
// rate-limits / change shape without notice). Every failure logs ONE structured, greppable line
// (Vercel runtime logs — no log-aggregation service yet) then throws, so an operator can tell WHY
// it broke. `kind` makes a lockdown (auth_required / rate_limited) visually distinct from a
// transient blip (network) or a silent contract break (shape_mismatch) at a glance.
type FailureKind = "network" | "auth_required" | "rate_limited" | "http_error" | "shape_mismatch";

function failResolve(kind: FailureKind, storyId: string, status: number | null, message: string): never {
  // NO PII, and NEVER the auth code — storyId is a public id; `message` is a fetch/HTTP detail only.
  console.error("[miin.resolvePost] fetch failed", { kind, storyId, status, message });
  throw new Error(`miin.resolvePost failed: ${kind}`);
}
```

Replace the body of `resolvePost` (keep the helpers from Task 2) with the classified version:

```ts
async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  const storyId = parsed.postId;

  let resp: Response;
  try {
    resp = await fetch(parsed.fetchUrl, { headers: { Accept: "application/json" } });
  } catch (e) {
    failResolve("network", storyId, null, e instanceof Error ? e.message : String(e));
  }

  if (!resp.ok) {
    const kind: FailureKind =
      resp.status === 401 || resp.status === 403 ? "auth_required"
      : resp.status === 429 ? "rate_limited"
      : "http_error";
    failResolve(kind, storyId, resp.status, `HTTP ${resp.status}`);
  }

  let body: unknown;
  try {
    body = await resp.json();
  } catch (e) {
    failResolve("shape_mismatch", storyId, resp.status, e instanceof Error ? e.message : String(e));
  }

  // Authoritative author — nested shape per platform-verification §3.3.
  const data = (body as { story?: { data?: Record<string, unknown> } })?.story?.data;
  const authorData = (data?.author as { data?: Record<string, unknown> } | undefined)?.data;
  const username = authorData?.username;
  if (!data || typeof username !== "string" || !username.trim()) {
    failResolve("shape_mismatch", storyId, resp.status, "missing story.data.author.data.username");
  }

  const handle = username; // as returned (§3.2)
  const accountId = handle.trim().toLowerCase(); // deterministic per-owner key (§3.4 recovery guard)
  // Display name = the author's `nickname` (the only name field miin returns). miin defaults
  // nickname to the username, so treat nickname == username as "no distinct display name" (null) —
  // matching Threads' bare-handle semantics.
  const nickname = typeof authorData!.nickname === "string" ? authorData!.nickname.trim() : "";
  const displayName = nickname && nickname.toLowerCase() !== accountId ? nickname : null;
  const text = `${segmentsText(data.title)}\n${segmentsText(data.content)}`;
  const codePresent = textHasCode(text, code);
  const canonicalUrl = `https://miin.cc/story/${storyId}`;

  return { accountId, handle, displayName, codePresent, canonicalUrl };
}
```

> Note: `failResolve` returns `never`, so TypeScript treats `resp`, `body`, and `username` as definitely-assigned/narrowed after each guard — no extra casts needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/binding/platforms/miin.test.ts`
Expected: PASS (parse + happy path + full failure taxonomy + code-never-logged).

Then typecheck the adapter:

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/miin.ts lib/binding/platforms/miin.test.ts
git commit -m "feat(miin): classified failure taxonomy + structured, code-free logging"
```

---

## Task 4: Register the adapter + registry & recovery-guard tests

**Files:**
- Modify: `lib/binding/platforms/index.ts:9-11`
- Test: `lib/binding/platforms/miin.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/binding/platforms/miin.test.ts`:

```ts
import { getAdapter, listSlugEligible } from "./index";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/binding/platforms/miin.test.ts -t "registry wiring"`
Expected: FAIL — `getAdapter("miin")` returns `undefined` (not yet registered).

- [ ] **Step 3: Write minimal implementation**

Edit `lib/binding/platforms/index.ts` — import the adapter and add it to the map:

```ts
// lib/binding/platforms/index.ts
import type { PlatformAdapter } from "./types";
import { threadsAdapter } from "./threads";
import { miinAdapter } from "./miin";

// Adding a platform = add its adapter to this map. (Presentation is separate: also register the
// platform's glyph + brand color in PlatformIcon — see docs/product-decisions.md "Platform icon
// brand identity". Icons are intentionally NOT gated on an adapter so 施工中 tiles can still show
// their brand mark. miin's glyph is a deferred follow-up — see the spec §6.)
const ADAPTERS: Partial<Record<string, PlatformAdapter>> = {
  threads: threadsAdapter,
  miin: miinAdapter,
};
```

(Leave `getAdapter` and `listSlugEligible` unchanged below.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/binding/platforms/miin.test.ts`
Expected: PASS (registry + deterministic accountId suites included).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/index.ts lib/binding/platforms/miin.test.ts
git commit -m "feat(miin): register adapter in the registry (activation switch)"
```

---

## Task 5: Platform catalog + picker filter (pure module)

**Files:**
- Create: `lib/binding/platforms/catalog.ts`
- Test: `lib/binding/platforms/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/binding/platforms/catalog.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/binding/platforms/catalog.test.ts`
Expected: FAIL — `Cannot find module './catalog'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/binding/platforms/catalog.ts`:

```ts
// lib/binding/platforms/catalog.ts
// Static, presentation-level list of every MVP platform shown in the /add picker — INCLUDING
// 施工中 platforms that have no adapter yet (e.g. Instagram). `slugEligible` must be known even
// without an adapter so the picker can hide slug-ineligible platforms during onboarding: a
// slug-less user's first bind becomes their main 分身, which must mint a slug. Keep each entry's
// `slugEligible` in sync with the matching adapter's — guarded by catalog.test.ts.
import type { PlatformKey } from "./types";

export type PlatformCatalogEntry = {
  key: PlatformKey;
  label: string;
  slugEligible: boolean;
};

export const PLATFORM_CATALOG: readonly PlatformCatalogEntry[] = [
  { key: "threads", label: "Threads", slugEligible: true },
  { key: "instagram", label: "Instagram", slugEligible: true },
  { key: "miin", label: "miin.cc", slugEligible: false },
] as const;

/**
 * Platforms to show in the /add picker. A slug-less (onboarding) user sees ONLY slug-eligible
 * platforms — their first bind becomes the main 分身 and must mint a slug, so slug-ineligible
 * platforms (miin) are hidden entirely rather than shown-disabled. A provisioned user (hasSlug)
 * sees all platforms. The recover flow bypasses the picker, so it's unaffected.
 */
export function pickablePlatforms(hasSlug: boolean): PlatformCatalogEntry[] {
  return PLATFORM_CATALOG.filter((p) => hasSlug || p.slugEligible);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/binding/platforms/catalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/catalog.ts lib/binding/platforms/catalog.test.ts
git commit -m "feat(platforms): catalog metadata + pickablePlatforms onboarding filter"
```

---

## Task 6: Wire the catalog into the `/add` picker (hide slug-ineligible during onboarding)

**Files:**
- Modify: `app/(site)/add/page.tsx`

> No unit test: this is a server component and the repo has no React-render test setup. The pure filter (`pickablePlatforms`) is covered in Task 5; correctness here is verified by `tsc` + the Task 7 done-criteria walkthrough.

- [ ] **Step 1: Replace the inline `PLATFORMS` const with the catalog + filter by slug**

Edit `app/(site)/add/page.tsx`. Replace the imports + inline `PLATFORMS` const + render to drive off the catalog. The full file becomes:

```tsx
// app/add/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { pickablePlatforms } from "@/lib/binding/platforms/catalog";
import { PlatformIcon } from "@/app/(site)/gua/[slug]/PlatformIcon";

// The picker lists the MVP platforms from the shared catalog. A platform is "active" iff the
// registry has an adapter (the rest render disabled with a 施工中 badge). Slug-INELIGIBLE platforms
// (miin) are HIDDEN ENTIRELY for a slug-less user — their first bind would become the main 分身,
// which must mint a slug. A provisioned user (has a slug) sees all platforms. Recover bypasses this
// page, so it's unaffected.
export default async function PlatformPickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const platforms = pickablePlatforms(!!user.slug);

  return (
    <main className="wrap">
      <h1 className="wordmark sm">選擇平台</h1>
      <p className="lede">選擇要驗證綁定的平台。</p>
      <div className="platform-list">
        {platforms.map((p) => {
          const active = !!getAdapter(p.key);
          return active ? (
            <a key={p.key} className="platform-tile" href={`/add/${p.key}`}>
              <span className="platform-name">
                <PlatformIcon platform={p.key} size={20} />
                {p.label}
              </span>
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <div key={p.key} className="platform-tile disabled" aria-disabled="true">
              <span className="platform-name">
                <PlatformIcon platform={p.key} size={20} />
                {p.label}
              </span>
              <span className="tag-wip">施工中</span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(site)/add/page.tsx"
git commit -m "feat(add): drive picker off catalog, hide slug-ineligible during onboarding"
```

---

## Task 7: Verify generic wiring (no edits) + full suite + done-criteria

**Files (read-only confirmation — do NOT edit unless a guard is actually missing):**
- `app/(site)/add/[platform]/page.tsx`
- `app/(site)/add/[platform]/AddAccountWizard.tsx`
- `app/(site)/add/[platform]/confirm/page.tsx`

- [ ] **Step 1: Confirm the compose-button guard exists (no compose intent for miin)**

`app/(site)/add/[platform]/page.tsx` already passes `composeIntentUrl={adapter.composeIntentUrl ? adapter.composeIntentUrl(template) : null}`, and `AddAccountWizard.tsx` already renders the compose link only when `composeIntentUrl` is truthy (`{composeIntentUrl ? (<a …>) : null}`). Since `miinAdapter` omits `composeIntentUrl`, the wizard renders cleanly **without** a compose button (copy-paste only). **No edit needed** — confirm both guards are present.

> Known cosmetic gap (out of scope per spec §5 — do NOT fix here): the wizard's paste-input `placeholder` is hardcoded to a Threads URL (`https://www.threads.net/@你的帳號/post/…`). It will show on the miin page too. The spec scopes the wizard change to the compose-button guard only; flag this for a future polish task rather than expanding scope.

- [ ] **Step 2: Confirm the confirm-page branches are generic**

`confirm/page.tsx` already: routes `?recover=` to the same-account guard → `RecoverConfirm` → `recoverAction` (§3.4); routes the in-scope provisioned user (`user.slug` set) to `OrdinaryConfirm` → `confirmOrdinaryAction`; and leaves the slug-ineligible-without-slug dead branch (cancel-only) as the backstop for a slug-less user who reaches `/add/miin/confirm` by typing the URL. **No edit needed** — confirm these branches cover miin with zero miin-specific code.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all green (existing suites + new `miin.test.ts` + `catalog.test.ts`).

- [ ] **Step 4: Run the typechecker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Walk the done-criteria (spec §8) — manual confirmation**

Confirm against the running app or by reasoning through the code paths:
- Provisioned user: `/add` shows the miin tile as **active** → `/add/miin` → copy template → (post on miin) → paste `https://miin.cc/story/<id>` → resolve → `OrdinaryConfirm` → miin appears as a verified non-main 分身.
- **Slug-less user: `/add` does NOT list miin at all** (only Threads + Instagram).
- Wrong-host / spoofed / malformed paste URLs are rejected by `parsePostUrl` before any fetch.
- A flagged miin 分身 recovers via `/add/miin?recover=<accountId>` → same-account guard clears (deterministic `accountId`) → `reverifyBinding`.
- A miin API failure logs a classified, code-free line and surfaces the retryable wizard error — no partial commit.
- Icon deferred (§6) — non-blocking.

- [ ] **Step 6: Commit (if any confirmation revealed a needed guard fix; otherwise skip)**

```bash
git add -A
git commit -m "chore(miin): verify generic wizard/confirm wiring covers miin"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- §3 adapter contract (fields, `parsePostUrl`, `resolvePost`) → Tasks 1–3. ✅
- §3.1 host-exact + https + numeric-storyId gate, constructed `api.miin.cc` fetchUrl → Task 1. ✅
- §3.2 authoritative author, code scan over title+content, query-free canonical, `accountId = handle.trim().toLowerCase()` → Task 2 (nested shape per source-of-truth — see Reconciliation note). ✅
- §3.4 deterministic `accountId` recovery guard → Task 4 test; recovery flow itself is generic (Task 7 confirm). ✅
- §4 failure taxonomy (`network`/`auth_required`/`rate_limited`/`http_error`/`shape_mismatch`) + structured code-free log + no adapter retry → Task 3. ✅
- §5 registry activation → Task 4; picker hides slug-ineligible during onboarding → Tasks 5–6; compose-guard + confirm branches generic → Task 7. ✅
- §7 testing (parse, resolve, failure taxonomy with code-never-logged, profileUrl, registry, picker filtering, deterministic accountId) → Tasks 1–5. ✅
- §1 out-of-scope (slug-less miin-only entry, IG adapter, bio method, headless fallback) → not implemented, by design. ✅
- §6 icon → explicitly deferred (Task 7 done-criteria notes it non-blocking). ✅

**Placeholder scan:** none — every code/test step has complete content; failure messages and fixtures are concrete.

**Type consistency:** `FailureKind`, `failResolve`, `pickDisplayName`, `segmentsText`, `PlatformCatalogEntry`, `pickablePlatforms`, `PLATFORM_CATALOG`, and the `ResolvedPost` field names (`accountId`/`handle`/`displayName`/`codePresent`/`canonicalUrl`) are used identically across tasks and match `types.ts`.

**Deviations from the brainstorm (intentional, with rationale):**
1. **Nested JSON shape** (`story.data.author.data.username`; `title`/`content` as `{text}` segment arrays) instead of the brainstorm §3.2 flat sketch — **confirmed against a live `api.miin.cc` capture of story 7651906** (2026-06-18); follows the brainstorm's named source of truth, `platform-verification.md` §3.3.
2. **`accountId = handle.trim().toLowerCase()`** (spec §3.2 says `.toLowerCase()`) — the extra `.trim()` is required by the §7 "casing/whitespace variant normalizes" recovery-guard test.
3. **`displayName`** read from the confirmed `nickname` field, nulled when it equals the username (miin defaults nickname to username); **shape guard keyed on author username** (tolerating empty `title`/`content` so valid short posts aren't rejected) — see the Reconciliation note.
