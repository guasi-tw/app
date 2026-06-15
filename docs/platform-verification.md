# Platform Verification Capability Matrix — Threads · Instagram · miin.cc

**Status:** empirical reference, verified **2026-06-15**. Source of truth for *how guasi reads a public proof to confirm account ownership*. Complements (and supersedes the platform mechanics in) [`superpowers/specs/2026-06-15-routing-and-identity-design.md`](superpowers/specs/2026-06-15-routing-and-identity-design.md) §5.

This doc answers one question per platform: **can we read the two things a verification needs — the post/profile's _author_ and its _code-bearing text_ — and how heavy is it on Vercel?**

---

## 1. The model

**Two verification methods:**
- **Post method (primary).** User publishes a public post containing a scoped auth code; we read the post's **author** + **text**. Doubles as the growth engine (public, links back). Produces an archivable proof artifact (§6.4).
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

### 3.2 Instagram
- **Read mechanism:** same crawler-UA fetch.
- **Post author:** `og:url` canonicalizes to `instagram.com/<author>/p/<shortcode>/` → author from the path (derived from the shortcode, authoritative).
- **Post text:** `og:description` = `"<likes> likes, <comments> comments - <author> on <date>: \"<caption>\"."` → the quoted caption carries the code.
- `[gotcha]` **Flaky/throttled:** an isolated fetch can return *without* OG tags (observed once). **Retry once** on missing `og:description` (measured 12/12 after retry).
- `[gotcha]` **Bio is NOT readable tokenless** — the IG profile `og:description` is a fixed template (`"N Followers, M Following, K Posts - See Instagram photos…"`), verified on a populated account (`@sanswordtw`, 1.6k posts). Bio-verification on IG would need the IG Graph API (token) or headless. **Don't use bio on IG.**
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
- [ ] **miin proof snapshot (§6.4):** reading the auth code is API-only (light), but the *visual* proof snapshot of a miin post still needs **headless rendering** (or reconstruction from API data) — the API returns data, not a rendered image. So miin avoids the browser for *verification* but may still need it for *evidence capture*.
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
| miin SSR (no author) | `miin.cc/story/7649215` (crawler UA) | generic author-less OG card 🔴 |
| miin headless render | `miin.cc/story/7649215`, `user/gua_si_tw` | author, post text, and bio all extracted ✅ |
| **miin public API — story** | `api.miin.cc/web/story/v3/story?storyId=7651906` | no auth → `author.username="gua_si_tw"`, title `"#Gua: SansWA"` (short post, `content` empty) ✅ |
| **miin public API — long post** | `api.miin.cc/web/story/v3/story?storyId=7599695` | `content` = 13 segments / 415 chars, **full body untruncated** ✅ |
| **miin public API — user** | `api.miin.cc/web/v2/user/page?userId=55619` | no auth → `username`, `intro="guasi.tw\n\n#gua: SansGu"`, `isPrivate` ✅ |
| miin username→userId | `…/user/page?username=…` & guesses | rejected / 404 — resolver TBD ⚠️ |

> `FB_CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"`
