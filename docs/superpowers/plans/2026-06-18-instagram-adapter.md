# Instagram PlatformAdapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only `instagramAdapter` so `/add/instagram` works end-to-end, flipping Instagram from 施工中 → active as the 3rd platform.

**Architecture:** A self-contained `PlatformAdapter` in `lib/binding/platforms/instagram.ts` mirroring `threads.ts` (crawler-UA SSR fetch, no shared abstraction). Author authority = the `og:url` canonical path (spoof-proven on IG 2026-06-18); auth code = scanned from the decoded SSR body (truncation-proof); bio is unreadable so post-method only; scope limited to `/p/<shortcode>/`. Registering it in the `ADAPTERS` map is the single line that activates IG.

**Tech Stack:** TypeScript, Vitest, Next 16 App Router. Reuses `textHasCode` (`lib/binding/code.ts`) and `FB_CRAWLER_UA` (`lib/binding/constants.ts`).

**Spec:** `docs/superpowers/specs/2026-06-18-instagram-adapter-design.md`

---

### Task 1: Adapter scaffold — config, `parsePostUrl`, `profileUrl`

**Files:**
- Create: `lib/binding/platforms/instagram.ts`
- Test: `lib/binding/platforms/instagram.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/binding/platforms/instagram.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/binding/platforms/instagram.test.ts`
Expected: FAIL — `Failed to resolve import "./instagram"` (file does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/binding/platforms/instagram.ts`:

```ts
// lib/binding/platforms/instagram.ts
// Self-contained Instagram adapter (Approach A — mirrors threads.ts, no shared fetch abstraction).
// IG serves OG meta to Meta's crawler UA on POST pages (verified 2026-06-18): the author comes from
// the og:url canonical path (authoritative under any pasted handle — spoof-proven), and the auth code
// is scanned from the decoded SSR body. Bio is NOT readable tokenless (profile og:description is a
// follower-count template) → post-method only. Scope: /p/<shortcode>/ posts only (images canonicalize
// to /p/; /reel/ videos are rejected). Source of truth: docs/platform-verification.md §3.2.
import { FB_CRAWLER_UA } from "../constants";
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

const ALLOWED_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname);
}

// Canonical post path: /p/{shortcode}/ or /{handle}/p/{shortcode}/. The handle is parsed but NOT
// trusted — the author comes from og:url (platform authority). /reel/ is out of scope.
const POST_PATH = /^\/(?:[^/]+\/)?p\/([A-Za-z0-9_-]+)\/?$/;

function parsePostUrl(raw: string): ParsedPostUrl | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!isAllowedHost(u.hostname)) return null;
  const m = u.pathname.match(POST_PATH);
  if (!m) return null;
  // Keep any ?igsh=… (harmless for fetching); the stored canonical comes from og:url (query-free).
  return { postId: m[1], fetchUrl: u.toString() };
}

export const instagramAdapter: PlatformAdapter = {
  key: "instagram",
  label: "Instagram",
  // The official guasi handle on Instagram — the registered IG/Threads handle @gua.si.tw (decided
  // 2026-06-18). A growth/discoverability tag in the post template, NOT a security check.
  serviceTag: "@gua.si.tw",
  hashtag: "#guasi", // IG hashtags are pasteable/clickable (unlike Threads topics)
  slugEligible: true, // §A.4 — IG/Threads may mint a slug
  postUrlPlaceholder: "https://www.instagram.com/p/…",
  profileUrl: (handle: string) => `https://www.instagram.com/${handle}/`,
  parsePostUrl,
  resolvePost, // defined in Task 2
  // composeIntentUrl intentionally OMITTED — IG has no web compose intent (wizard guards on presence).
};
```

> NOTE: `resolvePost` is referenced here but added in Task 2. To keep Task 1 compiling on its own, add this temporary stub ABOVE the adapter object now and replace its body in Task 2:
> ```ts
> async function resolvePost(_parsed: ParsedPostUrl, _code: string): Promise<ResolvedPost> {
>   throw new Error("not implemented"); // replaced in Task 2
> }
> ```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/binding/platforms/instagram.test.ts`
Expected: PASS (the 3 describe blocks above). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/instagram.ts lib/binding/platforms/instagram.test.ts
git commit -m "feat(ig): Instagram adapter scaffold — parsePostUrl + config"
```

---

### Task 2: `resolvePost` — author authority, body code-scan, retry, fail-closed

**Files:**
- Modify: `lib/binding/platforms/instagram.ts`
- Test: `lib/binding/platforms/instagram.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/binding/platforms/instagram.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/binding/platforms/instagram.test.ts -t resolvePost`
Expected: FAIL — all throw `"not implemented"` (the Task 1 stub).

- [ ] **Step 3: Write the implementation**

In `lib/binding/platforms/instagram.ts`, add the helpers ABOVE the adapter object and REPLACE the Task 1 `resolvePost` stub with the real one:

```ts
// Minimal HTML-entity decode — IG OG/body content is entity-encoded (`&#064;`=@, hex numeric for CJK:
// the 我是分身驗證碼： label arrives as &#x6211;…&#xff1a; — a literal match never fires without this).
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

function metaContent(html: string, property: string): string | null {
  // Tolerate attribute order: property before OR after content. Decode entities on the way out.
  // LIMITATION (matches threads.ts): the `[^"']*` content group stops at the first literal quote OR
  // apostrophe, so an apostrophe inside og:title truncates the captured value. Bounded impact — only
  // displayName parses from og:title; the author comes from og:url (a pure URL) and the code from the
  // decoded body, so a truncated og:title can never cause a wrong bind, only a clipped display name.
  const a = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  );
  if (a) return decodeEntities(a[1]);
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  );
  return b ? decodeEntities(b[1]) : null;
}

async function fetchHtml(fetchUrl: string): Promise<string> {
  const resp = await fetch(fetchUrl, {
    headers: { "User-Agent": FB_CRAWLER_UA },
    redirect: "follow", // a spoofed-handle path redirects toward the canonical author URL
  });
  if (!resp.ok) throw new Error(`Instagram fetch failed: ${resp.status}`);
  // Re-validate the FINAL host after following redirects — author must come from a platform domain
  // (§6.3). Fail CLOSED: a missing/unparseable final URL is treated as off-platform, never trusted.
  let finalHost = "";
  try {
    finalHost = new URL(resp.url).hostname;
  } catch {
    /* unparseable/empty resp.url → finalHost stays "" → fails the allowlist below */
  }
  if (!isAllowedHost(finalHost)) {
    throw new Error(`Instagram fetch redirected off-platform: ${resp.url}`);
  }
  return resp.text();
}

// og:url canonicalizes to instagram.com/{handle}/p/{shortcode}/ — the AUTHORITATIVE author, regardless
// of the pasted path handle (spoof-proven 2026-06-18). The regex pins the host, so a spoofed og:url
// host (evil.com/…, instagram.com.evil.com/…) fails to match → null → resolvePost throws (fail closed).
const OG_URL_HANDLE = /^https?:\/\/(?:www\.)?instagram\.com\/([^/]+)\/p\/[A-Za-z0-9_-]+\/?$/i;

/** Parse the authoritative author handle from og:url (host pinned by the regex). */
function parseAuthorHandle(ogUrl: string): string | null {
  const m = ogUrl.match(OG_URL_HANDLE);
  return m ? m[1].trim().toLowerCase() : null;
}

// og:title has TWO shapes (after entity-decode), verified 2026-06-18:
//   "<Name> on Instagram: …"   — when the account has a display name
//   "@<handle> on Instagram: …" — bare form when it doesn't (e.g. @gua.si.dev)
/** Display name from og:title, or null for the bare @handle form. */
function parseDisplayName(title: string | null): string | null {
  if (!title) return null;
  const prefix = title.split(" on Instagram:")[0]?.trim() ?? "";
  if (!prefix || prefix.startsWith("@")) return null;
  return prefix;
}

async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  let html = await fetchHtml(parsed.fetchUrl);
  let ogUrl = metaContent(html, "og:url");
  if (!ogUrl) {
    // IG SSR is occasionally flaky — retry once (platform-verification §3.2).
    html = await fetchHtml(parsed.fetchUrl);
    ogUrl = metaContent(html, "og:url");
  }
  // Author = og:url canonical (authority). The regex also pins the host, so an off-platform og:url
  // yields null → throw. Never derive the author from the user-supplied path. The combined guard
  // narrows ogUrl to a non-null string for canonicalUrl below.
  const handle = ogUrl ? parseAuthorHandle(ogUrl) : null;
  if (!ogUrl || !handle) throw new Error("Instagram: could not resolve author from og:url");

  const displayName = parseDisplayName(metaContent(html, "og:title"));

  // The caption (carrying the code) is SSR'd into the body untruncated. Decode the whole body and scan
  // for the namespaced code — og:description truncates and our code sits last in the template. The
  // author is pinned by og:url (authority), so scanning the body for the scoped code is safe (§3.1).
  const body = decodeEntities(html);
  const codePresent = textHasCode(body, code);

  // The clean, query-free canonical (built by IG from the true author) — stored as proof_post_url.
  const canonicalUrl = ogUrl; // narrowed to string by the guard above

  return { accountId: handle, handle, displayName, codePresent, canonicalUrl };
}
```

Then delete the temporary `resolvePost` stub from Task 1 (the real one above replaces it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/binding/platforms/instagram.test.ts`
Expected: PASS (all parse/config/resolvePost blocks). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/instagram.ts lib/binding/platforms/instagram.test.ts
git commit -m "feat(ig): Instagram resolvePost — og:url authority + body code-scan"
```

---

### Task 3: Register the adapter (flip IG live) + update registry test

**Files:**
- Modify: `lib/binding/platforms/index.ts`
- Test: `lib/binding/platforms/index.test.ts:14-26`

- [ ] **Step 1: Update the failing registry test**

In `lib/binding/platforms/index.test.ts`, the current test asserts IG is NOT registered — invert it. Replace the `describe` block header and the IG case:

Change the describe title:
```ts
describe("platform registry (Threads + miin + Instagram shipped)", () => {
```

Replace this case (lines ~14-16):
```ts
  it("returns undefined for not-yet-built platforms (IG lands later)", () => {
    expect(getAdapter("instagram")).toBeUndefined();
  });
```
with:
```ts
  it("returns the Instagram adapter", () => {
    expect(getAdapter("instagram")?.key).toBe("instagram");
  });
```

And extend the slug-eligible assertion (lines ~22-26) to include IG:
```ts
  it("lists Threads + Instagram as slug-eligible but not miin", () => {
    const keys = listSlugEligible().map((a) => a.key);
    expect(keys).toContain("threads");
    expect(keys).toContain("instagram");
    expect(keys).not.toContain("miin");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/binding/platforms/index.test.ts`
Expected: FAIL — `getAdapter("instagram")` is still `undefined` (adapter not registered yet).

- [ ] **Step 3: Register the adapter**

In `lib/binding/platforms/index.ts`, import and add IG to the `ADAPTERS` map:

```ts
import type { PlatformAdapter } from "./types";
import { threadsAdapter } from "./threads";
import { miinAdapter } from "./miin";
import { instagramAdapter } from "./instagram";

const ADAPTERS: Partial<Record<string, PlatformAdapter>> = {
  threads: threadsAdapter,
  miin: miinAdapter,
  instagram: instagramAdapter,
};
```

(Update the leading comment's "Only Threads ships…/miin's glyph" note only if it still says IG is unbuilt; the IG glyph already exists in `PlatformIcon`, so no icon work is needed.)

- [ ] **Step 4: Run the full platforms suite to verify it passes**

Run: `npx vitest run lib/binding/platforms/`
Expected: PASS — `index.test.ts` (IG now returned + slug-eligible) AND `catalog.test.ts` (the consistency test now sees IG's adapter `slugEligible: true` matching the catalog). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/platforms/index.ts lib/binding/platforms/index.test.ts
git commit -m "feat(ig): register Instagram adapter — flips IG live in /add"
```

---

### Task 4: Refine the wizard IG note copy

**Files:**
- Modify: `app/(site)/add/[platform]/AddAccountWizard.tsx:67-69`

- [ ] **Step 1: Replace the igNote copy**

The wizard already renders `igNote={platform === "instagram"}` (set in `page.tsx:119`). Replace the existing hint paragraph (kept simple — name the caption field, nothing more):

Find:
```tsx
      {igNote ? (
        <p className="hint">Instagram 需附上一張圖片，且貼文內的連結不可點擊 —— 建議也把網址放到個人簡介。</p>
      ) : null}
```
Replace with:
```tsx
      {igNote ? (
        <p className="hint">Instagram 需先附上一張圖片（任何圖片皆可），再把貼文內容貼到「新增說明文字……」欄位。</p>
      ) : null}
```

- [ ] **Step 2: Verify the build typechecks**

Run: `npx tsc --noEmit`
Expected: clean (copy-only change, no type impact).

- [ ] **Step 3: Commit**

```bash
git add "app/(site)/add/[platform]/AddAccountWizard.tsx"
git commit -m "feat(ig): wizard note points at the 新增說明文字 caption field"
```

---

### Task 5: Update docs (part of the ship flow)

**Files:**
- Modify: `docs/platform-verification.md` (§3.2 + evidence log)
- Modify: `docs/routes.md` (`/add/instagram` now resolves)
- Modify: `docs/devlog.md` (new entry + TL;DR row)
- Modify: `todo.md` (cross off IG adapter)

- [ ] **Step 1: Update `docs/platform-verification.md`**

In §3.2 (Instagram), fold in the 2026-06-18 re-verification:
- Post-method `og:description`/body read is **alive** (re-verified 2026-06-18); author authority = `og:url` canonical path, now **spoof-proven on IG** (was Threads-only) — a spoofed `/handle/p/<sc>/` still yields the true author in `og:url`.
- Body carries the full caption untruncated → scan the **decoded body** (mirrors Threads), not the truncatable `og:description`.
- CJK code label is **hex-entity-encoded** (`&#x6211;…&#xff1a;`) → must `decodeEntities` first.
- `og:title` has the **bare `@handle` form** (no display name), like Threads.
- `?igsh=…` is a share token, stripped to the clean `og:url` canonical.
- **Scope shipped: `/p/<shortcode>/` only** (`/reel/` rejected).
- Add evidence-log rows for the 2026-06-18 captures (gua.si.dev `/p/DZveut0kiPi/`; NASA spoofed-path → true author `nasa`).

- [ ] **Step 2: Update `docs/routes.md`**

Change the `/add/instagram` row: it now resolves to the wizard (was 404 — no adapter). Keep the auth/chrome columns consistent with `/add/threads` and `/add/miin`.

- [ ] **Step 3: Update `docs/devlog.md`**

Add the newest-first entry + TL;DR row (per CLAUDE.md Devlog format). Use the next version (e.g. `v0.18.0` — confirm against the current top TL;DR row). Shape:

```markdown
## v0.18.0 — Instagram adapter (3rd active platform) (2026-06-18)
**Review:** not yet
**Design docs:**
- Instagram adapter: [Spec](superpowers/specs/2026-06-18-instagram-adapter-design.md) [Plan](superpowers/plans/2026-06-18-instagram-adapter.md)
**What was built:**
- `instagramAdapter` (`lib/binding/platforms/instagram.ts`) — crawler-UA SSR read, `/p/<sc>/` only; registered → IG live in `/add`.
- Wizard IG note now names the 「新增說明文字……」 caption field.
**Key technical learnings:**
- `[insight]` IG author authority = `og:url` canonical path; spoof-proven on IG 2026-06-18 (a spoofed path handle still yields the true author) — closes the §4 gap that was Threads-only.
- `[gotcha]` IG post pages return an app-shell + consent/login wall for DELETED posts; a year-old test post mislooks like "IG changed." Verify against a live post.
- `[gotcha]` IG body/OG is hex-entity-encoded incl. the CJK code label (`我是分身驗證碼：` → `&#x6211;…&#xff1a;`) — must decode before `textHasCode`; scan the untruncated body, not `og:description`.
- `[note]` IG bio stays unreadable tokenless (profile `og:description` = follower-count template) → post-method only.
```

Also add the matching TL;DR row at the top of the table, linking to the section anchor (GitHub auto-anchor for the heading above: `#v0180--instagram-adapter-3rd-active-platform-2026-06-18`).

- [ ] **Step 4: Cross off the IG item in `todo.md`**

Mark the IG adapter task done.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean, all tests green.

```bash
git add docs/platform-verification.md docs/routes.md docs/devlog.md todo.md docs/superpowers/specs/2026-06-18-instagram-adapter-design.md docs/superpowers/plans/2026-06-18-instagram-adapter.md
git commit -m "docs(ig): platform-verification §3.2 re-verify, routes, devlog v0.18.0"
```

---

## Final verification (before opening the PR)

1. `npx tsc --noEmit` — clean.
2. `npx vitest run` — all green (new IG tests + unchanged Threads/miin + registry/catalog now seeing IG live).
3. Manual smoke on a Vercel preview (live IG fetch is environment-dependent — confirm on the deploy, not local): `/add/instagram` renders (no 404), template copies with `#guasi` + `@gua.si.tw`, the IG note names the 「新增說明文字……」 field, and pasting `https://www.instagram.com/p/DZveut0kiPi/` resolves author `gua.si.dev` with the code present.
4. Open the PR with `gh pr create --base main`. **Do not merge** (user reviews the preview + squash-merges).
