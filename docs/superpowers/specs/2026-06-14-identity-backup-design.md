# Identity Backup / Alter-Account Verification — Design Spec

**Date:** 2026-06-14 (rev. append-only ledger, unbinding, verification timeline, naming/domain finalized, account status management, verification-post flow & growth loop, 正身 profile)
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
- Site account with **passwordless email (magic link / OTP)** login.
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
| **Auth code** | A unique, expiring token the user must place in a public post to prove control of an account. |

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

1. **Choose platform.** User picks which platform to bind (Threads or IG) and enters the
   account id `id1`. → status `pending`.
2. Site generates a unique, **expiring 6-digit auth code** and a **ready-to-post text
   template** for the user to copy. The template contains:
   - the **auth code**,
   - a **mention/tag of the service** (`@gua.si.tw`),
   - a short line of copy, and
   - the user's **public 驗明正身 page URL** (e.g. `guasi.tw/<handle>`) so anyone who sees
     the post can click through.
3. User publishes the template as a **public post** from `id1`. (On Threads this is a text
   post; on **Instagram** the caption carries the text — IG requires attaching an image.)
4. User pastes the **post URL** back into the site — *or* we auto-detect the post via the
   `@gua.si.tw` tag (see note below).
5. Site fetches the post and confirms **both**:
   - the post text contains the matching auth code, **and**
   - the post author equals `id1`.
6. On success, the site **snapshots the post** (§6.4), writes an **immutable proof
   record**, appends a `bound` event to the ledger (§6.6), and sets the account `verified`.

> **The verification post is also the growth engine.** Because the post is public and
> links to the user's 驗明正身 page, every verification markets 正身 to that user's
> followers — turning the proof step into an organic acquisition loop. This is the direct
> answer to the "how do we get people to trust & use this" problem (行銷困難) in the
> original idea. Only the **auth code** is *required* for verification; the URL + copy are
> what make the post double as marketing, so the template defaults to including them.

> **Tagging `@gua.si.tw` enables auto-capture.** Because the post tags the service's
> account, the platform's mention/tag API can surface the post to us automatically —
> potentially letting users **skip the paste-URL step** (we detect the tagged post, then
> match the auth code + author and verify). Treat this as a UX **enhancement, not the
> primary path**: mention APIs typically need a business account + app review and have
> coverage limits, so the manual **paste-URL flow stays the reliable fallback** (consistent
> with §6.3). Bonus: the tag adds credibility and a follow path back to the official
> account. **Security is unchanged** — the auth code + author-match still do the work, so a
> stranger tagging `@gua.si.tw` cannot get falsely verified.

> **Platform caveat (clickable links):** Threads renders links as clickable, so the loop
> works well there. **Instagram captions do *not* make URLs clickable** — the link shows
> as plain text. Mitigations: keep the URL short and typeable (`guasi.tw/<handle>`), and
> encourage users to also put it in their IG **bio link**. Don't assume the IG caption
> link is tappable.

> **Why 6 digits is enough.** Security comes from the **author match** (the post must come
> from `id1`, which an impersonator doesn't control) plus **expiry + single use** — not
> from code entropy. The code just ties one specific post to one pending binding and proves
> intent. 6 digits keeps it easy to copy.

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
   URL it returns the author handle/URL and embed content, which is enough to check
   `author == id1` and that the auth code appears in the text. Requires a Meta app +
   access token. *This is acceptable for reading posts — it does not tie the trust model
   to Meta (see §6.1).*
2. **Public web fetch (fallback / easier-first-phase option).** Fetch the public post
   page and parse author + text. Needs no Meta app, but is more fragile (markup changes,
   anti-bot measures).
3. **Manual review (safety net).** If automated fetch fails or is ambiguous, queue the
   verification for human confirmation.

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
- **Verification service** — generates auth codes, drives the proof flow, writes proof
  records.
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
  `status` (`pending` | `verified` | `unbound`), `condition` (`active` | `banned` |
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
- **auth_codes** — `id`, `linked_account_id`, `code` (6-digit numeric), `expires_at`,
  `consumed_at` (single-use). See §6.2 for why 6 digits suffices.
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
| **Impersonation** (claiming an account you don't own) | Verification requires posting from the account itself; post-author check blocks this. |
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
  API so users can skip pasting the URL (§6.2). Likely Phase 2, since it needs a business
  account + app review; paste-URL remains the MVP path.

## 12. Tech stack (recommendation, not locked)

- **Framework:** Next.js + TypeScript (full-stack: UI + API routes).
- **Database:** PostgreSQL via Prisma.
- **Auth:** passwordless email magic-link / OTP (e.g. Lucia or a lightweight custom
  flow; transactional email via a provider such as Resend/Postmark).
- **Hosting:** **GCP, AWS, or Vercel — to be decided later** (see §13). Examples per
  option: Cloud Run + Cloud SQL (GCP), App Runner/ECS + RDS (AWS), or Vercel + managed
  Postgres (Neon/Supabase). To keep the choice open, avoid provider-specific lock-in in
  the application code where practical.
- **Post fetching & snapshot:** server-side fetch within the PlatformAdapter, plus
  screenshot capture and third-party archive submission (§6.4); background queue if needed.

Rationale: a single TypeScript codebase keeps a solo/small-team MVP simple, Postgres
fits the relational data model, and passwordless auth removes password-storage burden.
Open to alternatives if the team has stronger preferences.

## 13. Open questions

- Final name (§10).
- **Cloud provider: GCP vs AWS vs Vercel — to be decided later** (§12). Affects
  managed-service choices for hosting and the database.
- Exact public-post fetch strategy per platform and its fragility budget (§6.3).
- **Snapshot mechanics (§6.4):** how to render the screenshot (headless browser?), which
  third-party archive to use, and where to store images (snapshot screenshots **and**
  uploaded avatars) — likely object storage tied to the chosen cloud provider.
- Auth-code **expiry window** (format decided: 6-digit numeric, single-use — §6.2/§8).
- Exact copy/wording of the ready-to-post verification template (§6.2).
- Tag-based auto-capture feasibility (mention API access, business-account/app-review
  requirements) vs paste-URL only for MVP (§6.2).
- Whether the public lookup should be queryable by platform handle, by URL, or both.
