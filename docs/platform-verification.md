# Platform Verification Capability Matrix — Threads · Instagram · miin.cc

**Status:** empirical reference, verified **2026-06-15**. Source of truth for *how guasi reads a public proof to confirm account ownership*. Complements (and supersedes the platform mechanics in) [`superpowers/specs/2026-06-15-routing-and-identity-design.md`](superpowers/specs/2026-06-15-routing-and-identity-design.md) §5.

This doc answers one question per platform: **can we read the two things a verification needs — the post/profile's _author_ and its _code-bearing text_ — and how heavy is it on Vercel?**

---

## 1. The model

**Two verification methods:**
- **Post method (primary).** User publishes a public post containing a scoped auth code; we read the post's **author** + **text**. Doubles as the growth engine (public, links back). The proof is a **link to that live public post** (no snapshot/archive — see product-decisions.md "Trust & proof model").
- **Bio method (fallback).** User puts the code in their **profile bio**; we read the profile **owner** + **bio text**. Transient (no durable proof, no marketing) — use only where the post method can't be read.

**Two things every method must read:**
1. **Author** — the account that owns the post/profile. Must equal the 分身 being bound.
2. **Code-bearing text** — the post caption / bio, scanned for the scoped auth code.

**The security invariant (non-negotiable, §6.3):** the **author is resolved from platform authority** (the platform's own SSR/API/canonical URL), **never** from the user-supplied URL or page content. See §4 for the spoof proof.

> Security = author-match + code scope/expiry/single-use. Code **entropy is irrelevant** and code **visibility is harmless** (a leaked code is useless in any other binding session).

---

## 2. Capability matrix

Legend: ✅ readable tokenless · ⚠️ tokenless but flaky (retry) · 🔴 needs token/headless · 🟢 structured JSON

| Platform | Post · author | Post · code-text | Bio · author | Bio · code-text | Read mechanism | Vercel weight |
|---|---|---|---|---|---|---|
| **Threads** | ✅ `og:title` | ✅ `og:description` | ✅ profile URL | ✅ `og:description` (bio present) | crawler-UA fetch of canonical URL → parse OG meta | **Light** (fetch + regex) |
| **Instagram** | ✅ `og:url` canonical | ⚠️ `og:description` (retry) | ✅ profile URL | 🔴 **not in OG** → token/headless | crawler-UA fetch → parse OG meta | **Light** (post); bio not tokenless |
| **miin.cc** | 🟢 API `author.username` | 🟢 API `title`/`content` | 🟢 API `username` | 🟢 API `intro` | plain `fetch()` of public JSON API | **Lightest** (fetch + JSON.parse) |

**Headline results:**
- **Threads** — both methods fully readable, tokenless. The most complete.
- **Instagram** — **post** method fully readable tokenless (retry-on-miss); **bio** method is *not* readable tokenless (the IG profile `og:description` is a fixed follower-count template, not the bio) → bio on IG needs a Meta token or headless. So **use the post method on IG.**
- **miin.cc** — the page HTML is an empty SPA shell (crawler SSR yields a generic, author-less card), **but** miin exposes a **public, unauthenticated JSON API** that returns structured data for both methods. This is the **lightest** path of all three — no scraping, no browser.

---

## 3. Per-platform detail

### 3.1 Threads
- **Read mechanism:** `fetch(canonicalUrl, { headers: { 'User-Agent': FB_CRAWLER_UA } })`. A normal browser UA returns a JS app-shell (`<title>Threads</title>`); the crawler UA (`facebookexternalhit/1.1`) triggers Meta's SSR of full OG meta.
- **Post author:** `og:title` = `"<name> (@<handle>) on Threads"` → parse `@<handle>`. Cross-check against `og:url` path.
- **Post text:** `og:description` = the full post text (carries the auth code).
- **Bio:** the profile's `og:description` includes the bio when present (e.g. `@zuck` → "…Mostly superintelligence and MMA takes").
- `[gotcha]` Threads migrated to **`threads.com`** — `og:url` returns `threads.com`, not `threads.net`. The canonical-host allowlist must accept **both**.
- `[gotcha]` `og:description` **truncates** long text → place the auth code **early** in the template.
- `[gotcha]` **(re-verified 2026-06-16) OG content is HTML-entity-encoded** — `og:title`/`og:description`/`og:url` return `&#064;` for `@` and hex numeric entities for CJK (e.g. `&#x807d;`). You **must HTML-decode** before parsing the handle out of `og:title` *and* before scanning `og:description` for the code label (the Chinese `我是分身驗證碼：` arrives encoded, so a literal-string match never fires).
- `[gotcha]` **(re-verified 2026-06-16) Wrong/old paths 301-redirect, they don't serve 200.** A `threads.net` URL 301s to `threads.com`, and a **spoofed path handle** (`@zuck`, `@notreal999`, even `@i`) 301s to the **canonical true-author URL** and then serves the real author in `og:title`. So fetch with **`redirect: "follow"`** (not `"error"`), then **re-validate the FINAL `response.url` host** is on the allowlist — that preserves the §4 author-authority guarantee while handling the legitimate redirects. (The §4 table's "HTTP 200 under any path" is now a 301→canonical→200; the *author authority* conclusion is unchanged and stronger.)
- `[note]` **(verified 2026-06-16) Compose intent** = `https://www.threads.com/intent/post?text=<encoded>` → 200; logged-out users are sent to `/login?next=…` with the `text` preserved, so a logged-in poster lands on a prefilled composer. (`threads.net` works too but adds a redirect hop.)
- `[gotcha]` **(verified 2026-06-16) `og:title` has TWO shapes.** With a display name: `"<name> (@<handle>) on Threads"`. **Without one (e.g. `@gua.si.tw`): the bare `"@<handle> on Threads"`** — no parens, no name. Parse both forms; treat the display name as optional/null.
- `[gotcha]` **(verified 2026-06-16) `og:description` is ABSENT when the post contains a link.** Our verification posts always embed the profile URL, so Threads renders a summary card (`twitter:card=summary`) and emits **no `og:description`** — the §3.1 "post text = og:description" only holds for link-free posts. **The caption is still in the SSR'd HTML body** (entity-encoded), so read the **auth code from the decoded body**, not `og:description`. Author still comes from `og:title` (authority). Bonus: the body is **untruncated**, so the "place the code early" gotcha no longer applies to Threads.
- `[note]` **(verified 2026-06-16) Query params are safe to strip.** Share URLs carry a per-share `?xmt=…&slof=1` tracking token; fetching with or without it returns 200, and `og:url` is the clean canonical (`https://www.threads.com/@<handle>/post/<id>`). **Store the reconstructed canonical (handle from authority + post id) as the proof URL** — query-free, no tracking token.
- `[note]` **(verified 2026-06-16) Threads has no hashtags — it uses "topics."** A pasted `#tag` in copy-paste template text does **not** become a clickable topic (topics are added via the composer UI, one per post). So the Threads verification-post template **omits the hashtag** and relies on the `@gua.si.tw` service tag + the profile link for discovery. (IG hashtags do work — keep `#guasi` there when IG ships.)
- **Evidence post (2026-06-16):** `https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2` — real test post, confirmed **live end-to-end**; `og:title`=`&#064;gua.si.tw on Threads` (bare), **no `og:description`**, code label present in body as `&#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;…`.
- `[gotcha]` **(2026-06-16) Editing a post CHANGES its URL — the old shortcode dies.** Threads mints a **new shortcode** on edit; the previous URL then **302-redirects to `https://www.threads.com/?error=invalid_post`** (a login/home page, `og:title="Threads • Log in"`). An earlier capture (`DZqu0RjGmZr`) failed for exactly this reason after the post was edited, while an un-edited post (`@live.defrag`) returned 200 throughout — so this is **post-URL mutation, NOT throttling/eventual-consistency** (an earlier note here speculated rate-limiting; that was wrong). **Implications:** (1) the reader must **fail closed** when `og:title` is the login page (don't bind) — the bare/named author regexes already do; (2) the user must paste the **current** URL (re-copy after any edit); (3) the stored proof URL can later go stale if the post is edited/deleted — accepted MVP trade-off (dead proof link OK, no snapshots); (4) **don't depend on a live post in automated tests — mock a saved response**; keep live fetches to a human-run smoke.

### 3.2 Instagram
**Status: SHIPPED (v0.18.0, post method) — re-verified 2026-06-18.** `instagramAdapter` reads via crawler-UA SSR; scope `/p/<shortcode>/` only (`/reel/` rejected).
- **Read mechanism:** same crawler-UA fetch (post method, **alive** re-verified 2026-06-18).
- **Post author = authority:** `og:url` canonicalizes to `instagram.com/<author>/p/<shortcode>/` → the author comes from the **`og:url` canonical path**, now **spoof-proven on IG** (was Threads-only): a spoofed `/<other-handle>/p/<sc>/` still yields the **true** author in `og:url`. The adapter's `OG_URL_HANDLE` regex also pins the host, so an off-platform `og:url` fails closed.
- **Post text:** the full caption (carrying the code) is **SSR'd into the body untruncated** → scan the **decoded body** (mirrors Threads), not the truncatable `og:description`.
- `[gotcha]` **Body/OG is hex-entity-encoded** incl. the CJK code label — `我是分身驗證碼：` arrives as `&#x6211;…&#xff1a;`, so `decodeEntities` must run **before** `textHasCode` (a literal match never fires otherwise).
- `[note]` **`og:title` has the bare `@handle` form** (no display name) for accounts without one — like Threads; `"<Name> on Instagram: …"` when a display name exists. Only `displayName` parses from it; the author is from `og:url`.
- `[note]` **`?igsh=…` is a share token** — kept for the fetch, but the stored canonical is the clean query-free `og:url`.
- `[gotcha]` **Flaky/throttled:** an isolated fetch can return *without* OG tags (observed once). **Retry once** on missing `og:url` (measured 12/12 after retry).
- `[gotcha]` **Deleted posts mislook like "IG changed."** A deleted post returns the app-shell + a consent/login wall (no author OG) — a year-old test post will fail this way; **verify against a live post**, fail closed otherwise.
- `[gotcha]` **Bio is NOT readable tokenless** — the IG profile `og:description` is a fixed template (`"N Followers, M Following, K Posts - See Instagram photos…"`), verified on a populated account (`@sanswordtw`, 1.6k posts). Bio-verification on IG would need the IG Graph API (token) or headless. **Don't use bio on IG → post method only.**
- `[note]` IG captions are **not clickable** (plain text) — keep the linked-back URL short/typeable.

### 3.3 miin.cc
- **Read mechanism:** miin is a **client-rendered Next.js SPA** — crawler SSR and raw HTML expose only a generic, author-less card (`og:description = "迷音 Miin — Let me in!"`, `og:image` = logo). **But** the SPA calls a **public JSON API** (`api.miin.cc`) with **no auth token**, callable directly:
  - **Post (story):** `GET https://api.miin.cc/web/story/v3/story?storyId=<id>`
    - author → `story.data.author.data.username`
    - text → concat `.text` of `story.data.title[]` + `story.data.content[]` — **scan both**: short posts carry their text in `title` (`content` empty); longer posts fill `content` (verified: a 415-char body returned in full).
    - `[advantage]` the API returns the **full text untruncated** — so the Threads/IG "place code early to survive OG truncation" gotcha **does not apply to miin**.
    - (`storyId` = the trailing number of `miin.cc/story/<id>`)
  - **Profile (bio):** `GET https://api.miin.cc/web/v2/user/page?userId=<id>`
    - author → `user.data.username`; bio → `user.data.intro`; also `user.data.isPrivate`
- **Why it's the lightest:** structured JSON, typed fields — no OG-tag regex, no DOM parsing, no browser. A single `fetch()` from a Vercel function.
- `[caveat]` **Unofficial API.** `api.miin.cc/web/...` is miin's internal web API — public and unauthenticated *today*, versioned (`v2`/`v3`), but could add auth/rate-limits or change shape without notice. **Pursue an official blessing** (a partnership ask) to de-risk; keep **headless render as the proven fallback** (§5).
- `[open]` **username → userId** resolution for the **bio** method is unresolved (`user/page` requires an integer `userId`; a `username` param is rejected, and obvious lookup endpoints 404). The **post** method doesn't need it (the story API returns the author inline). Find miin's username→userId resolver before relying on bio-on-miin.

---

## 4. Author authority — never trust the URL handle **[proven]**

The author **must** come from the platform's authoritative response, **never** from the handle in the user-pasted URL. Proven on Threads — same real post (`shortcode DZmmGyIGe3g`, true author `@live.defrag`), different path handles:

| Pasted URL path | HTTP | Meta `og:title` / `og:url` reported |
|---|---|---|
| `@live.defrag` (correct) | 200 | `@live.defrag` |
| `@zuck` (spoofed) | **200** | **`@live.defrag`** |
| `@notreal999` (garbage) | **200** | **`@live.defrag`** |

Meta serves the post under *any* path handle but canonicalizes `og:title`/`og:url` to the **true author** from the shortcode. **Attack if you trusted the path:** attacker (binding `@victim`) posts the code from their own `@attacker`, pastes a URL rewritten to `…/@victim/post/XYZ` → you'd bind `@victim` to the attacker (**identity takeover**). Reading the author from the authoritative response (true author `@attacker`) defeats it via author-mismatch.

- **Threads/IG:** author = `og:title` / `og:url` canonical (Meta's SSR), after validating the host is `threads.net`/`threads.com`/`instagram.com`.
- **miin:** author = the API `author.username` field, after validating the host is `api.miin.cc` and the `storyId` came from a validated `miin.cc/story/<id>` URL.

---

## 5. Vercel render strategy (the "how heavy" axis)

| Tier | Platforms | Tech | Cost |
|---|---|---|---|
| **Plain fetch** | Threads, IG (post), miin (API) | native `fetch()` + regex/`JSON.parse`; no deps | ~hundreds of ms, synchronous |
| **Token API** (optional) | IG bio; IG post at scale (avoid throttling) | Meta Graph `instagram_oembed` (`oembed_read`) | adds a Meta-app dependency; **not needed for MVP** |
| **Headless** (last resort) | miin, *only if* its public API is locked down | `puppeteer-core` + `@sparticuz/chromium`; ≥1024 MB function, raised/background timeout | slow (tens of s), async UX, fragile DOM parsing |

**Headless is proven to work on miin** (extracts author, post text, and bio from the rendered DOM), but the **public JSON API makes it unnecessary** unless miin removes it. Order of preference for miin: **API → official partnership → headless.**

---

## 6. Unified verification algorithm

1. User pastes the post/profile URL. **Validate the canonical host** (`threads.net`/`threads.com`/`instagram.com`/`miin.cc`); extract the **shortcode / storyId**. **Discard any handle in the path.**
2. Fetch from platform authority:
   - Threads/IG → crawler-UA fetch of the canonical URL (retry once if OG tags missing).
   - miin → `fetch()` the JSON API (`web/story/v3/story` for post; `web/v2/user/page` for bio).
3. **Author** ← authoritative field (Threads `og:title`; IG `og:url`; miin `author.username`). Must equal the 分身 being bound.
4. **Auth code** ← code-bearing text (Threads/IG `og:description`; miin `title`+`content` or `intro`). Place the code **early** for Threads/IG (OG truncation); **no truncation on miin** (full text via API).
5. Bind **iff** author matches **and** text contains the valid scoped / single-use / unexpired code.

---

## 7. Open items

- [ ] miin **username → userId** resolver (needed only for bio-on-miin) — endpoint not yet identified.
- [ ] miin API is **unofficial** — secure an official endpoint/blessing via the partnership ask; keep headless as fallback.
- [ ] IG **post** throttling at scale — if retry-on-miss is insufficient, adopt token `instagram_oembed`.
- [ ] Confirm crawler-UA SSR behavior is stable across regions / Meta changes (re-test periodically).
- [ ] Decide whether to offer bio-verification at all given it has no durable-proof / growth value (post method preferred everywhere it works).

---

## 8. Evidence log (verified 2026-06-15)

| Test | URL / endpoint | Result |
|---|---|---|
| Threads post, crawler UA | `threads.com/@live.defrag/post/DZmmGyIGe3g` | `og:title`=author, `og:description`=full text ✅ |
| Threads URL-handle spoof | same shortcode w/ `@zuck`, `@notreal999` | always true author `@live.defrag` ✅ |
| Threads bio in OG | `threads.com/@zuck` | bio present in `og:description` ✅ |
| IG post, crawler UA | `instagram.com/p/DZmqdCog-Vm/` | author `@gua.si.tw` + full caption in `og:description` ✅ (12/12 retries) |
| IG bio NOT in OG | `instagram.com/sanswordtw/` (1.6k posts) | `og:description` = follower template, no bio 🔴 |
| **IG full parse (live)** (2026-06-18) | `instagram.com/p/DZveut0kiPi/` | end-to-end resolvePost → author `gua.si.dev` from `og:url`, code `634057` found in decoded body, clean canonical ✅ |
| **IG spoof→true author** (2026-06-18) | spoofed `/<other>/p/<sc>/` path | `og:url` still yields the **true** author (spoof-proven on IG, was Threads-only) ✅ |
| **IG hex-entity body** (2026-06-18) | same post body | code label `我是分身驗證碼：` arrives as `&#x6211;…&#xff1a;` → must `decodeEntities` before scan ✅ |
| miin SSR (no author) | `miin.cc/story/7649215` (crawler UA) | generic author-less OG card 🔴 |
| miin headless render | `miin.cc/story/7649215`, `user/gua_si_tw` | author, post text, and bio all extracted ✅ |
| **miin public API — story** | `api.miin.cc/web/story/v3/story?storyId=7651906` | no auth → `author.username="gua_si_tw"`, title `"#Gua: SansWA"` (short post, `content` empty) ✅ |
| **miin public API — long post** | `api.miin.cc/web/story/v3/story?storyId=7599695` | `content` = 13 segments / 415 chars, **full body untruncated** ✅ |
| **miin public API — user** | `api.miin.cc/web/v2/user/page?userId=55619` | no auth → `username`, `intro="guasi.tw\n\n#gua: SansGu"`, `isPrivate` ✅ |
| miin username→userId | `…/user/page?username=…` & guesses | rejected / 404 — resolver TBD ⚠️ |
| **Threads OG entity-encoding** (2026-06-16) | `threads.com/@live.defrag/post/DZmmGyIGe3g` | `og:title`=`&#x807d;&#x807d; (&#064;live.defrag) on Threads` — must HTML-decode ✅ |
| **Threads spoof→canonical 301** (2026-06-16) | same post id under `@zuck`/`@notreal999`/`@i` (curl `-L`) | each 301→`@live.defrag` canonical, true author in `og:title` ✅ |
| **Threads .net→.com 301** (2026-06-16) | `www.threads.net/@live.defrag/post/…` | 301 → `www.threads.com/…` (follow + revalidate host) ✅ |
| **Threads compose intent** (2026-06-16) | `www.threads.com/intent/post?text=hello%20%23guasi` | 200; logged-out → `/login?next=…intent/post?text=…` (text preserved) ✅ |
| **Threads bare og:title** (2026-06-16) | `threads.com/@gua.si.tw/post/DZqwB3Imnp2` | `og:title`=`&#064;gua.si.tw on Threads` — no display-name parens; parse the bare form ✅ |
| **Threads og:description absent w/ link** (2026-06-16) | same post (contains a link) | **no `og:description`** meta; `twitter:card=summary`; caption in SSR body only → scan body for code ✅ |
| **Threads query-param strip** (2026-06-16) | same post with `?xmt=…&slof=1` vs stripped | both 200, identical OG; `og:url` = clean canonical → store query-free ✅ |
| **Threads edit changes URL** (2026-06-16) | edited post → old `…/post/DZqu0RjGmZr` | old shortcode **302 → `/?error=invalid_post`** (login page); re-posted `…/post/DZqwB3Imnp2` = 200 ✅ |
| **Threads full parse (live)** (2026-06-16) | `threads.com/@gua.si.tw/post/DZqwB3Imnp2` | end-to-end resolvePost → author `@gua.si.tw`, code `ABCDEF` found in body, canonical query-free ✅ |

> `FB_CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"`
