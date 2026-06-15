# Identity Backup / Alter-Account Verification — Design Spec

**Date:** 2026-06-14 (rev. append-only ledger, unbinding, verification timeline, naming/domain finalized, account status management, verification-post flow & growth loop, 正身 profile; **2026-06-15** verification security model: bound-account = post author resolved from platform authority, scoped single-use code per binding request, manual paste-back as the primary path — more responsive than the mention webhook)
**Status:** Draft (product + architecture)
**Source:** [`docs/first_thought.md`](../../first_thought.md)
**Name:** 正身 (tsiànn-sin) — product concept term · brand & domain 我是 / `guasi` (`guasi.tw`) · tagline 我是正身. See [§10 Naming](#10-naming)

---

## 1. Problem

On 2026-06-14 Meta mass-banned a large number of accounts, causing many KOLs to lose
control of the primary accounts through which they interact with their audience. To
recover, a KOL must open a new account and tell their followers "this new account is
me." The hard part is **trust**: how does anyone else become confident that the new
account really belongs to the same person as the banned one?

Reference request post (Threads, @77reading): see [`docs/first_thought.md`](../../first_thought.md).

## 2. Solution

A web service where a user **proactively registers, verifies, and cross-links** the
social accounts they own, and a **public lookup** lets anyone confirm that two or more
accounts belong to the same person.

Conceptually this is "Keybase for social media accounts": an identity hub that links
multiple platform accounts under one owner and proves the links.

Prior art worth studying: Keybase (public proofs), Mastodon `rel="me"` verification,
Bluesky domain-handle verification.

## 3. The core principle (drives every decision)

**Verification must happen while accounts are still alive.**

The proof mechanism requires interacting with a live account. A banned account can no
longer be verified. Therefore the product's value comes from users **pre-registering and
cross-linking their accounts *before* a ban happens**. When one account is banned, the
user's *surviving, already-verified* accounts vouch for the new one:

1. While alive, A verifies `a1`, `a2`, `a3` and links them under one site account.
2. `a1` gets banned.
3. A creates `a4`, verifies it (it is alive), and links it under the same site account.
4. The public lookup now shows `a4` as a sibling of the previously-verified `a1`/`a2`/`a3`.

This "verify while alive" rule is the first-class design constraint. The UX must
actively encourage users to register and verify accounts **before** they are at risk,
not after.

## 4. Scope

### In scope (MVP)
- Platforms: **Threads and Instagram** first, behind a pluggable platform layer.
- Site account login: **passwordless email (magic link / OTP)** *and* **Google OAuth** —
  both passwordless. (Note: this is *site login* and is unrelated to the "no platform OAuth
  **for identity**" rule in §6.1, which is only about proving 分身 ownership. Logging in with
  Google ≠ proving you own a Threads/IG account, so Meta/no-one gates verification.)
- Account verification via **public-post proof only** (no platform OAuth — see §6.1).
- Cross-linking verified accounts under one site account.
- **Profile** — each 正身 has an **avatar**, a **brief description**, and a designated
  **main 分身** (the primary verified account to feature — a *flag on a bound account*, not
  a free-form URL). **The first verified 分身 becomes the main by default; the user can
  change it on the 分身管理 page.** Shown atop the public 驗明正身 page (a Linktree-like
  profile for a *verified* identity).
- **Proof snapshot at verification time** — capture self-contained evidence (content +
  screenshot) so a proof survives the account/post being banned or deleted (§6.4).
- **Unbinding** a linked account that's no longer needed or was sold, modeled as an
  append-only event (§6.5).
- **Append-only public ledger** — bindings and unbindings are permanent records, never
  destructive edits (§6.6). Public = permanent; private stays private.
- **Verification timeline** — surface *when* each account was registered & verified (§6.7).
- **Account status management** — owner can mark a 分身 `banned` or `hacked` (self-service,
  login only); marking it recovered/back requires re-verification (§6.8).
- **Selective disclosure**: per-account public/private visibility.
- **Public lookup**: query a platform account → see its publicly-disclosed sibling
  accounts, each with its (snapshotted) proof and verification date.

### Out of scope (→ Phase 2, see §11)
- Publicly-verifiable / cryptographically-signed proofs.
- Site-account-as-trust-anchor ban-time registration.
- Additional platforms (Facebook, X, …).
- Platform OAuth ("Login with Instagram/Threads") as a verification path.
- Browser-extension verification badge on profiles.
- KOL launch-partner marketing program.

## 5. Key concepts

| Concept | Meaning |
|---------|---------|
| **Site account** (正身) | A registered account on this service. The identity hub and (in MVP) the trust anchor. One per real person. UI term: 正身. |
| **Linked account** (分身) | A social platform account `(platform, account_id)` claimed by a site account. Current-state projection (`status`, `visibility`); full history lives in the ledger. UI term: 分身. |
| **Proof record** | Immutable, **self-contained** evidence of one verification: the captured post snapshot (content + screenshot), author, capture time, and original URL. Survives the post being deleted/banned. |
| **Binding event** | An append-only ledger entry: a `bound` or `unbound` event for a `(platform, account_id)` under a site account. Never updated or deleted. |
| **Binding request** | A pending verification for a `(正身, platform)`: holds the scoped single-use auth code and (optionally) a pre-declared handle. On success, the **resolved post author** becomes the bound 分身. |
| **Auth code** | A 6-digit, expiring, **single-use** token scoped to one binding request; the user places it in a public post to prove control. Security rests on author-match + scope + expiry, not entropy (§6.2). |

## 6. Verification & binding lifecycle (MVP)

### 6.1 Why public-post proof only

Verification uses a **public post containing a one-time auth code** — *not* DMs and *not*
platform OAuth for identity. Rationale:

- **Independence of the trust model.** The product exists *because* Meta bans people.
  Tying *identity verification* to Meta OAuth would let Meta gate who can get verified.
  A post-based model needs no identity permission from the platform. (Note: this is about
  *how identity is proven*, not about *how a post is read* — see §6.3, where using a
  platform API to read the post is acceptable.)
- **No DM automation.** Automated DM reading violates Meta/IG ToS and risks getting the
  service's own accounts banned — a fatal irony for an anti-ban product.
- **Public & auditable.** The proof is a public artifact anyone can re-check, which sets
  up the Phase 2 publicly-verifiable-proofs upgrade.

### 6.2 Flow

1. **Start a binding request.** User picks which platform to bind (Threads or IG). They
   **may optionally pre-declare the handle** they're about to verify (e.g. `@alice_ig`) —
   this is a *confirmation* aid (catches "posted from the wrong account" mistakes), **not**
   the security gate. → a `binding_request` is created for `(正身, platform)`.
2. Site generates a unique, **expiring, single-use 6-digit auth code** scoped to **this
   binding request** and a **ready-to-post text template** for the user to copy. The
   template contains:
   - the **auth code**,
   - a **mention/tag of the service** (`@gua.si.tw`),
   - a short line of copy, and
   - the user's **public 驗明正身 page URL** (e.g. `guasi.tw/<handle>`) so anyone who sees
     the post can click through.
3. User publishes the template as a **public post** from the account they want to bind. (On
   Threads this is a text post; on **Instagram** the caption carries the text — IG requires
   attaching an image.)
4. User **pastes the post URL** back into the site. Manual paste-back is the **primary
   path** and the *most responsive* one — verification completes **synchronously, in
   seconds** (see the auto-capture note for why the mention webhook was set aside).
5. Site resolves the post **through the platform's authority** (oEmbed / API, or a
   strictly-validated canonical platform URL — *never* user-supplied page content; §6.3)
   and confirms **both**:
   - the post text contains **this binding request's** auth code, **and**
   - the post is **authored by a platform account** — and *that resolved author becomes the
     bound 分身*. If the user pre-declared a handle, the resolved author must match it.
6. On success, the site **captures the text proof synchronously**, then **snapshots the
   post** (§6.4), creates/activates the `linked_account` for the **resolved author**, writes
   an **immutable proof record**, appends a `bound` event to the ledger (§6.6), and sets the
   account `verified`. The single-use code is **consumed** and the binding request closes.

> **The verification post is also the growth engine.** Because the post is public and
> links to the user's 驗明正身 page, every verification markets 正身 to that user's
> followers — turning the proof step into an organic acquisition loop. This is the direct
> answer to the "how do we get people to trust & use this" problem (行銷困難) in the
> original idea. Only the **auth code** is *required* for verification; the URL + copy are
> what make the post double as marketing, so the template defaults to including them.

> **Why manual paste-back is the primary path (not the mention webhook).** Tagging
> `@gua.si.tw` could let the platform's mention/tag API surface the post automatically and
> skip the paste step — but this was **deliberately set aside for MVP**, and not only for
> cost/app-review reasons: **manual paste-back is actually *more responsive*.** Pasting the
> URL completes verification **synchronously, in seconds**; a mention webhook is lossy and
> laggy (a poller adds up to a full poll-cycle of latency), while needing a business account
> + Meta app review + a live API token — a hard dependency on the very platform this product
> exists to route around. Since the user *just* composed and published the post, pasting its
> URL one line later is a natural, instant step. Auto-capture stays a **Phase 2
> enhancement** (§11); the tag still adds credibility + a follow path back to the official
> account today. **Security is unchanged either way** — the scoped single-use code + author
> resolved from platform authority do the work, so a stranger tagging `@gua.si.tw` cannot
> get falsely verified.

> **Platform caveat (clickable links):** Threads renders links as clickable, so the loop
> works well there. **Instagram captions do *not* make URLs clickable** — the link shows
> as plain text. Mitigations: keep the URL short and typeable (`guasi.tw/<handle>`), and
> encourage users to also put it in their IG **bio link**. Don't assume the IG caption
> link is tappable.

> **Why 6 digits is enough — and what actually makes it safe.** Security does **not** come
> from code entropy. It rests on three things:
> 1. **Authorship is unforgeable.** The proof post must be *authored by* the account being
>    bound, and the bound account **is** that author (resolved from platform authority,
>    §6.3). Copy-pasting the template text onto your own wall just produces a post authored
>    by *you* — you can never make someone else's account author a post, so you can never
>    bind an account you don't control.
> 2. **The code is scoped + single-use + expiring.** Each code belongs to exactly **one
>    binding request** (`正身` + `platform`), verifies **at most once**, and expires after a
>    short TTL. A **leaked or copied code is useless in anyone else's session** — their
>    binding request carries a *different* code — and useless once consumed or expired.
>    Failed attempts (typo, author mismatch) do **not** consume it; the user can retry within
>    the TTL. Rate-limit verify attempts to prevent hammering.
> 3. **The match target is the *specific account*, never the identity** (see next note).
>
> So a 6-digit code is plenty — it only has to tie one live post to one pending request and
> prove intent, and it stays easy to copy.

> **Three distinct handles — don't conflate them.** The author check compares the post
> author to the **分身 being bound** (one specific platform account) and to *nothing else*:
> - **`@gua.si.tw`** — the *service's* own account, present only as a tag (growth /
>   discoverability). **Not** a security check.
> - **正身 identity name** (the `guasi.tw/<handle>` profile) — the user's identity on *our*
>   site. **Not** what the post author is matched against.
> - **分身 handle** (e.g. `@alice_ig`, `@alice_threads`, `@alice_backup`) — the platform
>   account being proven. **This is the only handle the author check uses.** One 正身 owns
>   **many** 分身, including **several on the same platform** — each is its own binding
>   request, its own code, and its own author-proven `bound` event.

> **Design rule:** persist the *full, self-contained proof record* (snapshot, not just a
> live URL, and never just a `verified: true` boolean). Storing the captured evidence is
> what makes proofs survive bans (§6.4) and makes the Phase 2 publicly-verifiable-proofs
> upgrade additive rather than a re-verification of every user.

### 6.3 Fetching the post

Reading the public post (given its URL, obtain author + text) is the riskiest piece of
the system. **Two implementation routes are acceptable**, chosen per-platform for
whichever ships Phase 1 fastest; the other serves as fallback:

1. **Platform API (preferred where straightforward).** Use the platform's official
   **oEmbed** endpoint (available for both Instagram and Threads): given a public post
   URL it returns the author handle/URL and embed content — enough to take the **resolved
   author** as the bound 分身 (matching the pre-declared handle if one was given) and to
   check the auth code appears in the text. Requires a Meta app +
   access token. *This is acceptable for reading posts — it does not tie the trust model
   to Meta (see §6.1).*
2. **Public web fetch (fallback / easier-first-phase option).** Fetch the public post
   page and parse author + text. Needs no Meta app, but is more fragile (markup changes,
   anti-bot measures).
3. **Manual review (safety net).** If automated fetch fails or is ambiguous, queue the
   verification for human confirmation.

**Author integrity (critical).** Whichever route is used, the **post author must be derived
from the platform's own authority, never from attacker-influenced page content.** Concretely:
(a) accept **only canonical platform URLs** (`threads.net/@author/post/…`,
`instagram.com/p/…`) and parse out **platform + post-id**; (b) resolve the author via the
platform's oEmbed/API for that post-id, or — for the web-fetch route — fetch **only from the
real platform domain over HTTPS with no arbitrary redirects**, reading the author from the
platform's markup, not from anything the user supplied. Without this, an attacker could paste
a URL to a **page they control** that mimics a post claiming any author, defeating the
author-match gate. The author-match is only as strong as the trustworthiness of *who told us
the author*.

**Keep web fetch viable as a fallback even if the API is the primary path.** Because the
product's reason for existing is Meta cutting people off, a revoked oEmbed token must not
take the whole service down.

Risks to document and revisit during implementation: anti-bot measures, markup changes
breaking parsers, rate limits, API token revocation, and ToS considerations. The platform
adapter (§7.3) isolates all of this so the fetch strategy can change per platform without
touching the rest of the system.

### 6.4 Snapshot the proof at verification time

**A banned account's public post becomes inaccessible — and that is exactly the moment
the proof matters most.** Storing only `proof_post_url` is therefore insufficient: the
link dies with the account. The proof must be **captured as self-contained evidence at
verification time, not stored as a live pointer.**

At successful verification, capture and store:

- the **raw fetched content** (oEmbed / HTML response),
- a **rendered screenshot/image** of the post,
- the **author handle + display name** at capture time,
- the **capture timestamp**, and
- the original **post URL** — kept only as a reference, not depended on.

**Trust caveat.** A snapshot the service captured *by itself* is only as trustworthy as
the service ("trust the site" again). To corroborate independently, also **submit the
post URL to a third-party web archive** (e.g. Internet Archive / archive.today) at
capture time, producing a timestamped record outside the service's control. **Phase 2:**
cryptographic timestamping / hash anchoring makes the snapshot tamper-evident and
verifiable *without* trusting the service — the natural extension of the
publicly-verifiable-proofs goal.

Result: the verification still stands even after the account and its post are gone.

### 6.5 Unbinding (解除綁定)

A user can unbind a linked account that is **no longer needed** or was **sold**. Unbinding
is an **append-only event, never a deletion**:

- The binding's current status becomes `unbound`, recorded with a `reason`
  (`unneeded` | `sold` | `other`) and timestamp.
- (A *hacked* or *banned* account is normally **flagged** (§6.8), not unbound — so the
  public warning stays visible. Unbinding would hide it.)
- For a **public** account, the unbind event is itself **permanently public** — viewers
  see "linked T1–T2, unbound (reason)". You cannot silently disavow a public account.
- Unbinding **releases the uniqueness lock** on `(platform, account_id)`, so a *sold*
  account can later be verified by its new owner under a different 正身. The ledger
  preserves the full chain of custody.

### 6.6 Append-only public ledger

The system is **purely additive**: bindings and unbindings are permanent records, never
destructive edits. This is also the foundation of the Phase 2 publicly-verifiable proofs.

- **Public** bindings/unbindings are permanently visible in public lookup.
- **Private** links are still recorded append-only internally, but are **not shown** in
  public lookup — selective disclosure preserved. Making a private link public later
  simply reveals its already-existing history.
- **Decision: "public = permanent; private stays private."**

### 6.7 Verification timeline

Trust scales with time. The public lookup surfaces **when** each account was registered
and verified ("verified since 2026-03"). An account verified *well before* a ban is far
more credible than one linked the day after; showing the timeline lets viewers judge for
themselves. The data already exists (`created_at`, `verified_at`, ledger events).

### 6.8 Account status management (banned / hacked / recovered)

A management page (**分身管理**) lets the owner record the real-world condition of each
linked account, set visibility, and **choose which bound 分身 is the main one** (default:
the first verified 分身 — §4). Condition is **separate from the binding status** (§8): an
account can be `verified` (bound) yet `banned` in reality.

**Status-change asymmetry (the security principle):**

- **Trust-reducing reports — self-service, login only.** Marking an account **banned** or
  **hacked** requires only logging into the 正身 (`guasi.tw`); **no social-network
  re-verification.** Why this is safe: (a) you usually *can't* verify a banned/hacked
  account — you've lost access — so demanding it would fail exactly when it's needed;
  (b) these flags only *lower* trust in an account, so they can't be abused to impersonate
  — worst case you falsely flag your own account, harming only yourself; (c) the 正身 owner
  has standing. The **hacked** flag doubles as a fast public warning ("this account is
  compromised — no longer me"), core to the anti-impersonation mission. A hijacker who
  controls the platform account still **cannot** remove the flag, because it lives on the
  正身 account they don't control.
- **Trust-restoring claims — require re-verification.** Marking an account **unbanned /
  reclaimed** (it's back, and still me) **requires re-verifying** via the public-post flow
  (§6.2), producing a fresh proof record (§6.4). Why: during a ban or hack, control may
  have changed (handle reassigned, hijacker still in place), so restoring trust must be
  re-proven — not merely self-asserted.

All status changes are **append-only ledger events** (§6.6) and appear in the 驗明正身
timeline (§6.7), each labeled **owner-reported** vs **re-verified** so viewers can weigh
them accordingly.

## 7. Architecture

### 7.1 Shape

A single full-stack web application backed by a relational database. No microservices
for the MVP.

```
Browser ──> Web app (UI + API) ──> Database
                  │
                  └──> PlatformAdapter ──> public post fetch (Threads / IG)
```

### 7.2 Components

- **Auth module** — passwordless email magic-link / OTP login; issues and validates
  session.
- **Linked-account manager** — add/list/unbind linked accounts and record their status
  (banned/hacked/recovered, §6.8); owns status, condition & visibility; writes events to
  the ledger (§6.6).
- **Verification service** — opens binding requests, generates scoped single-use codes,
  resolves the post author from platform authority (§6.3), and writes proof records.
- **Snapshot/archive service** — at verification, captures the post snapshot (content +
  screenshot) and submits the URL to a third-party archive (§6.4).
- **PlatformAdapter layer** — the pluggable seam for platforms (§7.3).
- **Public lookup service** — read-only, unauthenticated; resolves a queried account to
  its public verified siblings, their snapshots, and the verification timeline.

### 7.3 PlatformAdapter interface

The pluggable boundary for adding platforms later.

```
interface PlatformAdapter {
  // Given a public post URL, return the author id, text, and timestamp.
  fetchPost(url: string): Promise<{ authorId: string; text: string; timestamp: string }>
  // Normalize/validate a platform account identifier.
  normalizeAccountId(raw: string): string
}
```

Concrete implementations for MVP: `ThreadsAdapter`, `InstagramAdapter`. Adding Facebook
or X later is "write a new adapter," not a rewrite.

## 8. Data model (sketch)

- **users** (a person's 正身) — `id`, `email`, `display_name`, `avatar_url`, `bio` (brief
  description), `created_at`. (Passwordless: no password hash.) Profile fields set at
  建立正身, editable later. (The "main link" is **not** stored here — it's a flag on a
  bound account, see `linked_accounts.is_main`.)
- **email_tokens** — `id`, `user_id?`, `email`, `code`, `expires_at`, `consumed_at`
  (for magic-link / OTP login).
- **linked_accounts** — `id`, `user_id`, `platform`, `account_id`, `display_name`,
  `status` (`verified` | `unbound` — a row exists only once an account is **bound**, i.e.
  the resolved author of a successful binding request; the *pending* state lives in
  `binding_requests`), `condition` (`active` | `banned` |
  `hacked`, owner-reported real-world state — see §6.8), `visibility` (`public` |
  `private`), `is_main` (boolean — the user's featured "main 分身"; **at most one `true`
  per user**; defaults to the first verified 分身, reassignable on the 分身管理 page),
  `created_at`, `verified_at`. Current-state projection; full history lives in
  `binding_events`.
- **binding_events** (append-only ledger, §6.6) — `id`, `user_id`, `platform`,
  `account_id`, `event_type` (`bound` | `unbound` | `reported_banned` | `reported_hacked`
  | `re_verified`), `reason` (`unneeded` | `sold` | `other`, for unbind),
  `proof_record_id?` (set for `bound` / `re_verified`), `created_at`. **Append-only —
  never updated or deleted.** `reported_banned` / `reported_hacked` are self-service
  (login only); `re_verified` requires the public-post flow (§6.8).
- **binding_requests** — `id`, `user_id`, `platform`, `expected_handle?` (optional
  pre-declared handle, **confirmation only** — §6.2), `code` (6-digit numeric, **scoped to
  this request**), `status` (`pending` | `verified` | `expired`), `expires_at`,
  `consumed_at` (**single-use** — set on success), `created_at`. The *pending* state of a
  verification lives here; on success the **resolved post author** becomes the `account_id`
  of a new/activated `linked_account`. A code verifies **at most once** and only ever
  completes **its own** request (§6.2). See §6.2 for why 6 digits suffices.
- **proof_records** — `id`, `linked_account_id`, `proof_post_url`, `auth_code`,
  `author_handle`, `author_display_name`, `snapshot_content` (raw fetched content),
  `snapshot_image` (screenshot reference), `archive_url` (third-party archive),
  `captured_at`, `verified_at`. **Immutable, self-contained (§6.4).**
- **audit_log** — `id`, `user_id`, `action`, `target`, `created_at` (supports
  takeover investigation — see §9).

Uniqueness: a given `(platform, account_id)` may have only **one current `verified`
binding** at a time. Once `unbound`, the lock releases so another user can verify it
later; all past events remain in `binding_events`.

## 9. Threats & mitigations

| Threat | Mitigation |
|--------|-----------|
| **Verification timing** (can't verify a banned account) | Core principle §3: encourage pre-verification while accounts are alive; surviving accounts vouch for new ones. |
| **Impersonation** (claiming an account you don't own) | The bound account **is** the proof post's author, resolved from platform authority (§6.3); you cannot make an account you don't control author a post, so you cannot bind it. |
| **Copy-paste / stolen-code abuse** (reposting someone's verification template, or reusing a leaked code) | The code is **scoped to one binding request, single-use, and expiring** (§6.2/§8): a copied post carries *someone else's* code, which matches no other session's request; a consumed or expired code is dead. |
| **Spoofed post page** (pasting a URL to attacker-controlled content that fakes the author) | Author is resolved **only** from the platform's authority via **canonical URLs** + oEmbed/API, never from user-supplied page content (§6.3 author integrity). |
| **Platform-account takeover** (your `a1` is hacked) | The **site account**, not the platform account, controls bindings. A hijacker of `a1` cannot alter your links, and cannot re-verify `a1` elsewhere while it is bound to you (uniqueness, §8). |
| **Site-account takeover** (your 正身 login is compromised) | The real attack surface. Mitigations: secure passwordless email login, notify on binding changes, and the append-only ledger (§6.6) makes any malicious bind/unbind publicly visible — history cannot be erased. |
| **Banned/deleted proof post** | Proof is **snapshotted at verification time** (content + screenshot) and independently archived (§6.4), so it survives the account/post disappearing — the case that matters most. |
| **False "account recovered" claim** (asserting a banned/hacked account is back when control may have changed) | Marking *unbanned/reclaimed* requires re-verification via public post (§6.8); only the trust-*reducing* banned/hacked flags are self-service. |
| **Stealth disavowal** (quietly pretending a past public account was never yours) | Append-only public ledger (§6.6): public unbindings and status changes stay visible with their reason. |
| **Privacy** (users who want pseudonymity) | Selective disclosure: each linked account is independently public or private. Private links and their ledger history are never shown in public lookup. |
| **Platform ToS / anti-bot** | No DM automation; no OAuth dependency for identity; public-post fetch isolated in the adapter with a manual-review fallback (§6.3). |

## 10. Naming

Two deliberately-separated layers:

- **Product concept term: 正身 (tsiànn-sin)** — Taiwanese for "the authentic person / the
  real one." Used throughout the UI as the thing users create and look up
  ("create your 正身", "查詢某人的正身"). This is the meaningful, story-rich word.
- **Brand / domain name: 我是 (guá-sī, "I am")** → **`guasi`**. Short, clean, easy to type.
- **Tagline: 我是正身** ("I am the authentic one") — the two layers compose into one phrase.

**Why split them.** Letting 正身 carry the meaning and personality frees the domain to be
simple. 我是 + 正身 compose into 「我是正身」 — same language register, mutually
reinforcing. A Japanese-pun alternative — `guatasi` / `guatashi` (我 gua + わたし watashi,
"me" in Taiwanese + Japanese, also loosely 我今是 "I am, now") — was considered but **set
aside**: it lives in a different language register and won't compose with 正身, splitting
the brand into two competing ideas.

Fallback name considered: 是我啦 (sī guá lah, "it really is me"); also 甘是你 (kám sī lí).

### Domain

- **`guasi.tw` — registered; this is the website domain.** `.tw` suits the Taiwan-focused
  audience, and domain discovery matters less here than the social handle anyway.
- **Future / optional (not needed for MVP):** `guasi.com` (taken since 2010 — acquire only
  if it matters later); `guasi.id` (available — `.id` reads as "identity," a possible
  thematic redirect later). Low priority; revisit with traction.

### Social handles

- **`@gua.si.tw`** — **registered** by the owner on **Instagram**. Because Threads shares
  Instagram's username namespace, this also secures the **Threads** handle.
- IG/Threads usernames disallow hyphens, so the dot form is used. Avoid bare `@guasi`;
  fallback would be `@gua_si`.
- Recommended: grab the same handle on other platforms (X, TikTok, YouTube, FB) for brand
  protection — especially important for an anti-impersonation product.

### UI terminology (user-facing wording)

The 正身 / 分身 wordplay runs through the interface — **正身** = your authentic main
identity; **分身** = an alter-ego (a linked social account):

| UI action | Term | Maps to |
|-----------|------|---------|
| Register a site account (also sets avatar, description, main link) | **建立正身** ("create your 正身") | site account + profile (§4) |
| Add & verify a linked social account (binding) | **註冊分身** ("register a 分身") | verification flow (§6.2), `bound` event (§6.6) |
| Public profile page — avatar, description, main 分身 + all bound accounts, with a click to reveal the **timeline** (registered → bound → unbound / history) | **驗明正身** | profile + public lookup (§4) + ledger (§6.6) + timeline (§6.7) |
| Owner manages 分身: mark banned/hacked, re-verify as recovered, choose the **main 分身**, set visibility | **分身管理** ("manage your 分身") — *term suggested, TBD* | account status management (§6.8) + profile (§4) |

**驗明正身** is a well-known Chinese idiom — "to ascertain someone's true identity" —
which is exactly what the public verification view does. The timeline view it opens is
powered by `created_at` / `verified_at` and the append-only `binding_events` ledger.

## 11. Phase 2 / future enhancements

- **Publicly-verifiable proofs** — expose each proof's source post publicly and/or add
  cryptographic timestamping / hash anchoring (Keybase-style) so anyone can re-verify
  *without trusting the service*. The MVP's immutable, snapshotted proof records (§6.4)
  are the foundation for this.
- **Bio-URL verification** — a *complementary* method (Mastodon `rel="me"` style): a link
  in the account's profile pointing back to its 正身 page gives an *ongoing* signal,
  versus a one-time post. (DM verification is rejected outright — it leaves no public
  evidence.)
- **Site-account-as-trust-anchor** — leverage the fact that a KOL provably controls
  their site account to support faster ban-time registration.
- **More platforms** — Facebook, X, etc., via new `PlatformAdapter`s.
- **Platform OAuth verification** — optional faster path on platforms that support it.
- **Browser-extension badge** — surface verification directly on platform profiles.
- **Marketing / adoption** — the verification-post growth loop (§6.2) is the built-in
  organic channel (each proof post tags `@gua.si.tw` and links back to the user's 驗明正身
  page). Additionally, anchor a few large KOLs as launch partners to break the
  chicken-and-egg trust bootstrap.
- **Tag-based auto-capture** — detect verification posts via the `@gua.si.tw` mention/tag
  API so users *could* skip pasting the URL (§6.2). **Deferred from MVP on purpose:** manual
  paste-back is *more responsive* (synchronous vs. a lossy/laggy webhook) and avoids a
  business-account + app-review + live-token dependency on the platform. Revisit only if a
  paste-free flow proves worth that cost.

## 12. Tech stack (MVP — locked)

**Everything runs on Vercel for the MVP.** Decided 2026-06-15.

- **Framework:** Next.js + TypeScript (full-stack: UI + API routes).
- **Hosting:** **Vercel** — serverless compute + CDN. The public 驗明正身 pages are cached
  and **purged from the app on write** (on-demand ISR / `revalidateTag`) — Next.js's native
  on-demand revalidation is exactly the "cache-but-expire-from-the-management-side" pattern
  the design needs. GCP was the alternative (Cloud Run + Cloud SQL) and stays a clean future
  escape hatch because the app is a portable container and the DB (below) is provider-neutral;
  avoid Vercel-only APIs in app code where practical.
- **Database:** **Neon** (serverless PostgreSQL) via Prisma. Scales to zero, free tier for
  MVP, runs independently of Vercel (keeps the GCP escape hatch open). **Connection pooling
  is mandatory** on serverless: use Neon's **pooled** connection string for queries and a
  **direct** URL for Prisma **migrations**.
- **Auth:** **Auth.js (NextAuth v5)** with two passwordless methods — **Google OAuth** and
  **email magic-link / OTP** — using the **Prisma adapter** (users/sessions in Neon).
  Verified-email **account linking** so the same address via Google and via email resolves to
  one 正身. Transactional email via Resend/Postmark. *(Lucia, named earlier, was deprecated
  as a library in 2025 — Auth.js replaces it.)* This is **site login only**; it does not
  touch the §6.1 "no platform OAuth for identity" rule.
- **Object storage (images):** snapshot screenshots **and** avatars go in **Vercel Blob**
  (or Cloudflare R2) — **not** Postgres.
- **Post fetching & snapshot (§6.4):** the PlatformAdapter fetch + the synchronous text-proof
  capture run in a Vercel function. The heavier **screenshot + third-party-archive** step runs
  **asynchronously** via a serverless-friendly queue (Vercel Cron/Queues or Upstash QStash).
  To stay fully on Vercel, render the screenshot by calling an **external screenshot API**
  (e.g. Urlbox / ScreenshotOne / Browserless) rather than self-hosting headless Chromium —
  your infra stays all-Vercel; the screenshot is just an outbound API call. (Running
  `@sparticuz/chromium` inside a Vercel function is a viable fallback.)

Rationale: a single TypeScript codebase on Vercel keeps a solo/small-team MVP simple,
Neon+Postgres fits the relational model and stays portable, passwordless auth removes
password-storage burden, and on-demand revalidation makes the cache-on-write design native.

## 13. Open questions

- Final name (§10).
- ~~Cloud provider: GCP vs Vercel~~ — **decided: all on Vercel for MVP** (§12), with Neon
  Postgres + Auth.js (Google OAuth + email OTP) + Vercel Blob; wire Vercel to `guasi.tw`.
- Exact public-post fetch strategy per platform and its fragility budget (§6.3).
- **Snapshot mechanics (§6.4):** which screenshot approach (external screenshot API vs.
  in-function `@sparticuz/chromium` — §12) and which third-party archive to use. *(Image
  storage decided: Vercel Blob / R2 — §12.)*
- Auth-code **expiry window** (format decided: 6-digit numeric, single-use — §6.2/§8).
- Exact copy/wording of the ready-to-post verification template (§6.2).
- ~~Tag-based auto-capture vs paste-URL for MVP~~ — **decided: manual paste-back is the MVP
  primary** (more responsive + no platform dependency, §6.2); tag-based auto-capture deferred
  to Phase 2 (§11).
- Whether the public lookup should be queryable by platform handle, by URL, or both.
