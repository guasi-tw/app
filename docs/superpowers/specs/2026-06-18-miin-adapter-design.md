# miin.cc PlatformAdapter — design spec

**Date:** 2026-06-18
**Status:** approved (brainstorm) — pending implementation plan
**Slice:** "Slice 6" — second of the three MVP platform adapters (Threads shipped; IG next).
**Source of truth for read mechanics:** [`docs/platform-verification.md`](../../platform-verification.md) §3.3.

> Historical design artifact (allowed to go stale per the CLAUDE.md docs two-tier rule). Current
> decisions live in CLAUDE.md "Locked decisions" + the maintained docs once shipped.

## 1. Goal & scope

Add a `miin` `PlatformAdapter` so the MVP supports a second platform end-to-end. miin.cc is a
Taiwan client-rendered SPA whose page HTML is an empty shell, **but** it exposes a public,
unauthenticated JSON API that returns the post author + full text — the lightest read path of all
three MVP platforms (fetch + `JSON.parse`, no scraping, no browser).

**In scope:** a self-contained adapter (`lib/binding/platforms/miin.ts`) implementing the existing
`PlatformAdapter` interface, registered in the adapter map, so an **already-provisioned** user (one
who has a Threads/IG main 分身 and therefore a `slug`) can verify and bind a miin account as a
**non-main 分身** through the existing `/add` → `/add/miin` → confirm wizard.

**Out of scope (deliberate):**
- **The slug-less + miin-only entry path.** miin is `slugEligible: false` (§3), so a miin account
  cannot be a *main* 分身 and cannot mint a slug. A brand-new user whose only account is miin
  therefore cannot form a public `/gua/{slug}` page from miin alone. The existing confirm-page
  branch for slug-ineligible-without-slug already blocks this (cancel-only); we leave it as-is. Its
  redesign is the separate open "no-slug owner on `/r/{shortRef}`" item (`todo.md`).
- **The IG adapter** (its own later slice).
- **The miin bio-verification method** (the `username → userId` resolver is unresolved per
  platform-verification.md §7; the post method does not need it — the story API returns the author
  inline).
- **A headless render fallback** — documented but unbuilt; built only if miin locks down its API
  (§4 risk posture).

## 2. Architecture decision

**Approach A — self-contained `miin.ts` mirroring `threads.ts`.** No shared fetch/resolve
abstraction across adapters. Threads (crawler-UA SSR) and miin (JSON API) share almost no fetch
logic, so extracting a common scaffold now would couple two dissimilar adapters around a guessed
seam. Revisit any extraction *after* the IG adapter ships, when three concrete adapters exist to
factor (rule of three).

Adding the platform is then: **one new adapter file + one line in the registry** (+ optional icon
glyph, §6). The `/add` wizard, the post template, and the commit path are already generic over
`PlatformAdapter` and need no per-platform code.

## 3. The adapter contract

`lib/binding/platforms/miin.ts` implements `PlatformAdapter` (see
`lib/binding/platforms/types.ts`):

| Member | Value / behavior |
|---|---|
| `key` | `"miin"` |
| `label` | `"miin.cc"` |
| `serviceTag` | `"@gua_si_tw"` (guasi's miin handle — growth decoration, **not** a security check) |
| `hashtag` | `"#guasi"` (miin supports hashtags) |
| `slugEligible` | `false` (a miin handle may not mint a slug — §1 out-of-scope rationale) |
| `profileUrl(handle)` | `` `https://miin.cc/user/${handle}` `` |
| `composeIntentUrl` | **omitted** — miin has no prefilled compose intent (wizard shows copy-paste only, §5) |
| `parsePostUrl(url)` | Security gate + parse (below) |
| `resolvePost(parsed, code)` | One authoritative fetch (below) |

### 3.1 `parsePostUrl(url): ParsedPostUrl | null`

Accept **only** a canonical miin story URL; reject everything else (returns `null`):

- Host **must equal** `miin.cc` exactly — reject look-alikes (`miin.cc.evil.com`, `notmiin.cc`),
  subdomains, and non-`miin.cc` hosts.
- Scheme **must** be `https`.
- Path **must** match `^/story/(\d+)/?$` — extract the numeric `storyId` (the trailing number of
  `miin.cc/story/<id>`). Reject profile paths and any non-canonical shape.

On success returns:
- `postId` = the `storyId` string.
- `fetchUrl` = `` `https://api.miin.cc/web/story/v3/story?storyId=${storyId}` `` — a URL **we
  construct** from the validated numeric id, never a user-supplied host.

### 3.2 `resolvePost(parsed, code): Promise<ResolvedPost>`

One `fetch` of `parsed.fetchUrl` (the `api.miin.cc` JSON endpoint). From the JSON response:

- **Author (authoritative):** `author.username` — miin's own data keyed by the storyId we
  validated, never parsed from user page content (§6.3 of the verification model). `displayName` ←
  the author object's display-name field (nullable).
- **Code presence:** scan **`title` + `content`** (concatenated) for this binding request's
  namespaced `code` → `codePresent`. miin returns the **full untruncated text**, so the Threads/IG
  "place the code early to survive OG truncation" gotcha does **not** apply — code placement in the
  template is unconstrained.
- **Canonical URL:** `` `https://miin.cc/story/${parsed.postId}` `` — clean, query-free (stored as
  `proof_records.proof_post_url`).

Returns `{ accountId, handle, displayName, codePresent, canonicalUrl }` where:
- `handle` = the resolved `author.username` (as returned).
- `accountId` = `handle.toLowerCase()` (mirrors Threads; the `(userId, platform, accountId)`
  per-owner uniqueness key).

Throws on any failure — see §4. (Implementation note: send a plain `fetch`; add a normal
`User-Agent`/`Accept: application/json` header only if miin's API requires it — to verify during
implementation.)

### 3.3 Author-match (unchanged, for context)

The bound 分身 is the post's resolved author. For a non-main bind there is no separate identity to
match beyond the optional pre-declared handle (a confirmation aid only) — the authoritative
`author.username` *is* the 分身 being bound and is what gets recorded. Security = author-from-authority
+ scoped/single-use/expiring code + per-owner uniqueness, exactly as Threads.

## 4. Error handling & logging

miin's API is **unofficial** (public + unauthenticated today, versioned `v2`/`v3`, could add auth,
rate-limits, or change shape without notice). Failures must be **diagnosable from the logs** so an
operator can tell *why* it broke — not just surfaced as a generic retry.

`resolvePost` throws on every failure, and **logs one structured line first**, classified by `kind`:

| Case | Detection | `kind` |
|---|---|---|
| Network / `fetch` rejected | `fetch` throws | `network` |
| **Auth added** (headline risk) | HTTP `401` / `403` | `auth_required` |
| Rate-limited | HTTP `429` | `rate_limited` |
| Other non-2xx | any other non-OK status | `http_error` |
| **Shape changed** | 2xx but expected fields (`author.username`, `title`/`content`) missing | `shape_mismatch` |

**Log call:**
```
console.error("[miin.resolvePost] fetch failed", { kind, storyId, status, message })
```
- Greppable in **Vercel runtime logs** (no log-aggregation service yet per `docs/services.md`).
- **No PII and never the auth code** in the payload (storyId is a public id).
- The `kind` makes a lockdown (`auth_required` / `rate_limited`) visually distinct from a transient
  blip (`network`) or a silent contract break (`shape_mismatch`) at a glance.

**User-facing:** all cases collapse to the wizard's existing retryable error — the resolve step
shows **「讀取失敗，請重試」** (matching the Threads copy); the binding request stays **pending** so
the user can paste again. No partial commit.

**Retry:** **none** in the adapter (miin's JSON API is documented as reliable, unlike IG's flaky
OG). The user-driven 「重試」 is the recovery path. If logs later show transient `network`/`5xx`
noise, a single retry is a one-line follow-up.

## 5. Registry & wizard wiring

- **Registry (the activation switch):** add `miin: miinAdapter` to the `ADAPTERS` map in
  `lib/binding/platforms/index.ts`. This single line flips everything registry-driven: `/add/miin`
  stops 404-ing and the `/add` picker tile flips **施工中 → active**.
- **Confirm path — no new UI.** For the in-scope user (provisioned, `user.slug` set),
  `app/(site)/add/[platform]/confirm/page.tsx` already routes to the **`OrdinaryConfirm`** branch
  (non-primary 分身 bind) — identical to adding a second Threads account. The slug-ineligible
  dead branch is only reached by slug-less users, who stay blocked (§1).
- **Wizard affordance — verify one guard.** Threads renders a compose button from
  `composeIntentUrl`; miin omits it. The `/add/miin` wizard must render cleanly **without** a
  compose button (copy-paste the template only). `composeIntentUrl` is optional in the interface;
  confirm the wizard guards on its presence and add the guard if missing.
- **Template:** `lib/binding/template.ts` is generic and composes miin's post from the adapter
  fields — the auth code + `@gua_si_tw` + `#guasi` + the clickable `guasi.tw/r/<shortRef>` linkback
  (miin supports clickable links).

## 6. Icon / glyph (presentation — non-blocking, deferred)

**Deferred to a separate follow-up; does not gate the adapter.** Today miin has no glyph
registered (`PlatformIcon.tsx` renders nothing for it), and the adapter ships fine that way (status
quo).

Notes for whoever picks it up:
- **miin's brand is colorful** — a rainbow gradient wordmark ("Miin", with the double-i as signal
  bars) on a dark navy rounded square (per the iOS app icon). It is **not** a `currentColor`
  monochrome glyph like Threads.
- The provided assets are a **wordmark**, unsuitable for the square 13px slots (account row,
  timeline dot) where it would be illegible and inconsistent with the letter-free Threads/IG marks.
- `PlatformIcon` currently renders a **single `<path>`** (one color or one linear gradient) in a
  fixed `viewBox="0 0 24 24"`. Giving miin a proper mark needs **either** (a) a clean **square
  monogram vector**, **or** (b) a small `PlatformIcon` **image-mode** enhancement (render a PNG for
  brands whose logo isn't a single path). Pick when the asset/decision is ready.

## 7. Testing

Mirror `lib/binding/platforms/threads.test.ts` — fixture-driven, no network:

- **`parsePostUrl` (pure):** accepts `https://miin.cc/story/12345` → `postId "12345"` +
  `fetchUrl …storyId=12345`; **rejects** (`null`) non-HTTPS, wrong host (`threads.com/...`),
  look-alike hosts (`miin.cc.evil.com`, `notmiin.cc`), non-numeric/missing storyId, profile/other
  paths.
- **`resolvePost` (mocked `fetch`):** a captured miin story JSON fixture → asserts authoritative
  `accountId`/`handle`/`displayName`, `canonicalUrl = https://miin.cc/story/12345` (query-free), and
  `codePresent` true when the code is in `title`+`content`, false otherwise.
- **Failure taxonomy:** one test per `kind` (`network`, `auth_required`, `rate_limited`,
  `http_error`, `shape_mismatch`) → each **throws** and emits the structured `console.error`
  (asserted via a spy); assert the **auth code never appears** in the logged payload.
- **`profileUrl`:** `"gua_si_tw"` → `https://miin.cc/user/gua_si_tw`.
- **Registry:** `getAdapter("miin")` returns the adapter; `listSlugEligible()` **excludes** miin.

No DB tests — the binding/commit path is already covered by the Threads suite and is
platform-agnostic (miin reuses the same `OrdinaryConfirm` commit).

## 8. Done criteria

- A provisioned user can go `/add` → miin tile (active) → `/add/miin` → copy template → post on
  miin → paste the story URL → resolve → confirm → the miin account appears as a verified non-main
  分身 on their `/gua/{slug}` (Accounts + Timeline).
- Wrong-host / spoofed / malformed paste URLs are rejected before any fetch.
- A miin API failure logs a classified, code-free line to Vercel logs and shows the retryable
  wizard error — no partial commit.
- Adapter fully unit-tested in isolation; `npx tsc --noEmit` and `npx vitest run` green.
- (Non-blocking) icon deferred per §6.
