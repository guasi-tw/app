# Instagram PlatformAdapter — design spec (2026-06-18)

**Status:** design, approved-pending-review. Historical artifact (allowed to stale once shipped); the
source of truth afterward is the code + `docs/platform-verification.md` + the devlog entry.

## Context

Instagram is the **3rd active platform** after Threads (Slice 2) and miin.cc (#28). It already
exists as a 施工中 tile in `PLATFORM_CATALOG` (`slugEligible: true`) and the `/add` wizard already
pre-wires an IG branch (`igNote`), but there is **no adapter**, so `getAdapter("instagram")` returns
`undefined` → the `/add/instagram` route 404s. This slice ships the read adapter, flipping IG from
施工中 → active without touching the rest of the system (the `PlatformAdapter` seam, §D.2).

The 2026-06-15 capability matrix said IG's post-method `og:description` read worked but was a
year-old snapshot, and the §4 author-authority spoof proof had **only ever been run on Threads**.
Before designing, the read path was **re-verified live against IG on 2026-06-18** (evidence below) —
the design is built on confirmed mechanics, not the stale snapshot.

## Live re-verification (2026-06-18)

Crawler UA = `facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`.

| Check | Result |
|---|---|
| Post page OG (live `/p/`) | ✅ `og:url`, `og:title`, `og:description` all SSR'd to the crawler UA |
| **Author authority** — `og:url` canonical | ✅ always the **true author**, regardless of pasted path (spoof table below) |
| Code-bearing text | ✅ caption is SSR'd into the page **body untruncated** (appears 3×) *and* in `og:description`; scan the **decoded body** (truncation-proof, mirrors Threads — our code sits last in the template, so a long user caption could push it past `og:description`'s truncation) |
| **CJK entity-encoding** | ✅ `我是分身驗證碼：` arrives as hex numeric entities (`&#x6211;&#x662f;…&#xff1a;`); literal string appears **0×** in raw HTML → **decode is mandatory** before `textHasCode` |
| `og:title` shape | two forms: `"<Name> on Instagram: …"` **and** bare `"@<handle> on Instagram: …"` (no display name) — entity-encoded (`&#064;`) |
| `?igsh=…` share token | stripped to clean canonical (`og:url` is query-free) |
| Bio / profile method | ❌ profile `og:description` = follower-count template (`"104M Followers… (@nasa)"`), **not** the bio → bio stays unreadable tokenless. **Post-method only.** |

**Author-authority spoof test** (true author `nasa`, shortcode `CqnzfuxpAKL`):

| Pasted path | `og:url` reports |
|---|---|
| `/p/<sc>/` | `instagram.com/nasa/...` |
| `/zuck/p/<sc>/` (spoof) | `instagram.com/nasa/...` |
| `/victim999/reel/<sc>/` (spoof) | `instagram.com/nasa/...` |

IG canonicalizes `og:url` to the true author under **any** path handle → the §4 guarantee holds on
IG. Read the author from `og:url` (after host-validation), never from the pasted path.

**Worked example / primary fixture:** `https://www.instagram.com/p/DZveut0kiPi/?igsh=…` →
`og:url` = `instagram.com/gua.si.dev/p/DZveut0kiPi/` (author `gua.si.dev`), bare `og:title`
`@gua.si.dev on Instagram:`, caption begins `#guasi` and carries the entity-encoded code label.

## Scope (this slice)

**In:**
- New self-contained adapter `lib/binding/platforms/instagram.ts` (Approach A — mirrors
  `threads.ts`/`miin.ts`, no shared fetch abstraction; the team's deliberate convention).
- Register it in `lib/binding/platforms/index.ts` `ADAPTERS` (the one line that flips IG live).
- Refine the existing `igNote` copy in `AddAccountWizard.tsx` to name the caption field.
- Unit tests `lib/binding/platforms/instagram.test.ts` off saved fixtures.

**Out (deliberately limited):**
- **Only `/p/<shortcode>/` posts.** `/reel/` is **rejected** in `parsePostUrl`. guasi verification
  posts are images with a caption, and image posts canonicalize to `/p/` (only videos go `/reel/`),
  so this covers the real flow. Dropping `/reel/` also drops its fixture.
- Bio method (unreadable). Token/oEmbed fallback (not needed; tokenless works). Proof snapshot
  (Phase-2 deferral, unchanged). No schema/catalog/`template.ts` change.

## The adapter (`instagram.ts`)

Implements `PlatformAdapter` (`lib/binding/platforms/types.ts`). Static config:

| Member | Value |
|---|---|
| `key` | `"instagram"` |
| `label` | `"Instagram"` |
| `serviceTag` | `"@gua.si.tw"` (the registered IG/Threads handle — growth tag, not a security check). **Intentionally ≠ the fixture author `gua.si.dev`**, which is just the test-post account; the serviceTag is the production brand handle (decided 2026-06-18). |
| `hashtag` | `"#guasi"` (IG hashtags are pasteable, unlike Threads topics) |
| `slugEligible` | `true` (§A.4) — must match `PLATFORM_CATALOG` (guarded by `catalog.test.ts`) |
| `postUrlPlaceholder` | `"https://www.instagram.com/p/…"` |
| `profileUrl(h)` | `https://www.instagram.com/<h>/` |
| `composeIntentUrl` | **omitted** — IG has no web compose intent (wizard already guards on its presence) |

**`parsePostUrl(raw)`** — returns `{ postId, fetchUrl }` or `null`:
- Reject non-`https:`.
- Host must be `instagram.com` or `www.instagram.com` (exact; rejects look-alikes/subdomains).
- Path must match **`/p/<shortcode>/`** or **`/<handle>/p/<shortcode>/`** (handle parsed but
  **discarded** — not trusted). Shortcode charset `[A-Za-z0-9_-]+`. **`/reel/` does not match → null.**
- `postId` = shortcode; `fetchUrl` = `u.toString()` (keep `?igsh=…`; harmless for fetching — the
  stored canonical is taken from `og:url`, query-free).

**`resolvePost(parsed, code)`** — one authoritative fetch (mirrors `threads.ts`):
1. Crawler-UA `fetch(fetchUrl, { headers: { "User-Agent": FB_CRAWLER_UA }, redirect: "follow" })`.
   `FB_CRAWLER_UA` already exists in `lib/binding/constants.ts`.
2. Non-`ok` → throw. Re-validate the **final** host (`new URL(resp.url).hostname` on the allowlist) —
   **fail closed** (unparseable → off-platform), same as `threads.ts:fetchHtml`.
3. Read `og:url`; if missing, **retry once** (IG SSR is flaky per §3.2). Parse the author handle from
   the `og:url` **path** `instagram.com/<handle>/p/<shortcode>/` — after confirming the og:url host is
   on the allowlist (§4 authority). No author → throw.
4. `displayName` ← `og:title`: parse the leading text before `" on Instagram:"`; the **bare**
   `"@<handle> on Instagram: …"` form → `null` (matches Threads' bare-handle semantics).
5. `codePresent` ← `textHasCode(decodeEntities(html), code)` — scan the **decoded full body** (the
   caption is SSR'd there untruncated, 3×), **decode first** (CJK label is entity-encoded). Mirrors
   `threads.ts` exactly; truncation-proof (our code sits last in the template, and `og:description`
   truncates for long captions). Author is pinned by `og:url` authority, so body-scanning the scoped
   code is safe (§3.1 reasoning).
6. `accountId` = `handle` = lowercased og:url handle; `canonicalUrl` = the **og:url value itself**
   (already canonical, host-validated, query-free) — *not* reconstructed, so it survives any future
   `/p`↔`/reel` nuance and matches IG's own canonical.

**Reused helpers** — `textHasCode` (`lib/binding/code.ts`), `FB_CRAWLER_UA` (`constants.ts`).
`decodeEntities` + `metaContent` are duplicated from `threads.ts` per the self-contained-adapter
convention (miin.ts does the same; a shared extraction is out of scope for this slice).

## Wizard / template

No template change — `buildVerificationPost` is already per-platform via `hashtag`/`serviceTag`, and
`page.tsx` already passes `igNote={platform === "instagram"}`. The only UI change is **replacing the
`igNote` copy** in `AddAccountWizard.tsx` (kept deliberately simple — name the caption field, nothing
more):

> Instagram 需先附上一張圖片（任何圖片皆可），再把貼文內容貼到「新增說明文字……」欄位。

## Tests (`instagram.test.ts`, mirrors `threads.test.ts`)

Mock `fetch` with saved fixtures — **no live calls** (live IG is a human-run smoke; posts can be
deleted, per the Threads lesson). Fixtures derived from the 2026-06-18 captures:

- **`parsePostUrl`**: accept `/p/<sc>/` and `/<handle>/p/<sc>/`; **reject** `/reel/<sc>/`, non-https,
  look-alike hosts (`instagram.com.evil.com`, `notinstagram.com`), subdomains, non-post paths.
- **`resolvePost` happy path** (gua.si.dev fixture): author `gua.si.dev` from `og:url`, `displayName`
  null (bare og:title), `codePresent` true after entity-decode, `canonicalUrl` = clean og:url.
- **Author authority**: spoofed-path fixture (`og:url` true author ≠ pasted handle) → resolves the
  **true** author.
- **Entity-decode**: a fixture whose code label is hex-encoded → `codePresent` true (guards the
  must-decode invariant).
- **Code absent** → `codePresent` false.
- **Retry-on-missing-og** → first response without OG, second with → resolves.
- **Fail-closed**: non-ok status throws; final host off-allowlist throws.

## Verification (end-to-end)

1. `npx tsc --noEmit` clean.
2. `npx vitest run lib/binding/platforms/` green (new IG tests + unchanged Threads/miin + `catalog`/
   `index` registry tests now seeing IG live).
3. Manual smoke on a Vercel preview: `/add/instagram` renders (no longer 404), template copies, the
   IG note names the caption field, paste `https://www.instagram.com/p/DZveut0kiPi/` → resolves author
   `gua.si.dev`. (Live fetch is environment-dependent; the laptop probe hit a consent wall on a
   *deleted* post, so confirm from the deploy, not local.)

## Docs to update on ship

- `docs/platform-verification.md` §3.2 + evidence log — fold in the 2026-06-18 re-verification (post
  path alive, og:url authority proven on IG, CJK entity-encoding, `/p/`-only scope).
- `docs/routes.md` — `/add/instagram` now resolves (was 404).
- `docs/devlog.md` + `todo.md` per the ship flow.
