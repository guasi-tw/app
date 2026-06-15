# Identity Backup / Alter-Account Verification — Design Spec

**Date:** 2026-06-14
**Status:** Draft (product + architecture)
**Source:** [`docs/first_thought.md`](../../first_thought.md)
**Name:** 正身 (tsiànn-sin) — fallback 是我啦 (sī guá lah). See [§10 Naming](#10-naming)

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
- **Selective disclosure**: per-account public/private visibility.
- **Public lookup**: query a platform account → see its publicly-disclosed sibling
  accounts, each with a link to its proof.

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
| **Site account** | A registered account on this service. The identity hub and (in MVP) the trust anchor. One per real person. |
| **Linked account** | A social platform account `(platform, account_id)` claimed by a site account. Has a `status` and a `visibility`. |
| **Proof record** | Immutable evidence of one successful verification: which post proved which account, when. |
| **Auth code** | A unique, expiring token the user must place in a public post to prove control of an account. |

## 6. Verification mechanism (MVP)

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

1. User adds a linked account `(platform P, account_id id1)`. → status `pending`.
2. Site generates a unique, **expiring auth code** bound to that pending account.
3. User publishes a **public post** from `id1` containing the auth code.
4. User pastes the **post URL** back into the site.
5. Site fetches the post and confirms **both**:
   - the post text contains the matching auth code, **and**
   - the post author equals `id1`.
6. On success, the site writes an **immutable proof record**
   `(platform, account_id, proof_post_url, auth_code, fetched_author_id, fetched_text, verified_at)`
   and sets the linked account's status to `verified`.

> **Design rule:** persist the *full proof record*, never just a `verified: true` boolean.
> Storing the evidence is what makes the Phase 2 publicly-verifiable-proofs upgrade
> additive rather than a re-verification of every user.

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
- **Linked-account manager** — add/list/revoke linked accounts; owns status & visibility.
- **Verification service** — generates auth codes, drives the proof flow, writes proof
  records.
- **PlatformAdapter layer** — the pluggable seam for platforms (§7.3).
- **Public lookup service** — read-only, unauthenticated; resolves a queried account to
  its public verified siblings.

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

- **users** — `id`, `email`, `created_at`. (Passwordless: no password hash.)
- **email_tokens** — `id`, `user_id?`, `email`, `code`, `expires_at`, `consumed_at`
  (for magic-link / OTP login).
- **linked_accounts** — `id`, `user_id`, `platform`, `account_id`, `display_name`,
  `status` (`pending` | `verified` | `revoked`), `visibility` (`public` | `private`),
  `created_at`, `verified_at`.
- **auth_codes** — `id`, `linked_account_id`, `code`, `expires_at`, `consumed_at`.
- **proof_records** — `id`, `linked_account_id`, `proof_post_url`, `auth_code`,
  `fetched_author_id`, `fetched_text`, `verified_at`. **Immutable.**
- **audit_log** — `id`, `user_id`, `action`, `target`, `created_at` (supports
  takeover/revocation investigation — see §9).

Uniqueness: a given `(platform, account_id)` may only be in `verified` state under one
site account at a time.

## 9. Threats & mitigations

| Threat | Mitigation |
|--------|-----------|
| **Verification timing** (can't verify a banned account) | Core principle §3: encourage pre-verification while accounts are alive; surviving accounts vouch for new ones. |
| **Impersonation** (claiming an account you don't own) | Verification requires posting from the account itself; post-author check blocks this. |
| **Account takeover** (a hacked verified account links a malicious sibling) | Owner can revoke linked accounts; audit log records all link/verify/revoke actions; consider re-confirmation for sensitive changes. |
| **Privacy** (users who want pseudonymity) | Selective disclosure: each linked account is independently public or private. Private links are never shown in public lookup. |
| **Platform ToS / anti-bot** | No DM automation; no OAuth dependency; public-post fetch isolated in the adapter with a manual-review fallback (§6.3). |
| **Proof-post deletion** | Proof record stores fetched text + URL at verification time; Phase 2 signed proofs harden this further. |

## 10. Naming

Theme: Taiwanese-Hokkien (台語) pun + the ideas of *alter-ego (分身)*, *backup*, and
*whoami* (à la Linktree).

**Chosen name: 正身 (tsiànn-sin)** — "the authentic person / the real one." Directly
names what the service proves.
**Fallback: 是我啦 (sī guá lah)** — "it really is me."
(Also considered: 甘是你 / kám sī lí — "is it you?", echoing `whoami`.)

### Domain

The Hokkien romanization ("tsiànn-sin") is hard to type, so the domain should be a short
English/meaning-based name while 正身 stays the displayed brand. Candidates (availability
to be confirmed):

- `thereal.me` — "the real me," true to 正身's meaning.
- `also.me` — 也是我 ("this is *also* me"); strong conceptual fit if available.
- `whoami.tw`, `iam.tw`, `thereal.tw` — `.tw` signals the Taiwan audience, likelier to be
  free.
- `itsme.la` — `.la` TLD spells the 啦 ending of the fallback name 是我啦.

Decision pending availability check.

## 11. Phase 2 / future enhancements

- **Publicly-verifiable proofs** — expose each proof's source post publicly and/or add
  cryptographic signing (Keybase-style) so anyone can re-verify *without trusting the
  service*. The MVP's immutable proof records are the foundation for this.
- **Site-account-as-trust-anchor** — leverage the fact that a KOL provably controls
  their site account to support faster ban-time registration.
- **More platforms** — Facebook, X, etc., via new `PlatformAdapter`s.
- **Platform OAuth verification** — optional faster path on platforms that support it.
- **Browser-extension badge** — surface verification directly on platform profiles.
- **Marketing / adoption** — anchor a few large KOLs as launch partners to break the
  chicken-and-egg trust bootstrap.

## 12. Tech stack (recommendation, not locked)

- **Framework:** Next.js + TypeScript (full-stack: UI + API routes).
- **Database:** PostgreSQL via Prisma.
- **Auth:** passwordless email magic-link / OTP (e.g. Lucia or a lightweight custom
  flow; transactional email via a provider such as Resend/Postmark).
- **Hosting:** a public cloud — **GCP or AWS, to be decided later** (see §13). The app
  and database will run on managed services of the chosen provider (e.g. Cloud Run +
  Cloud SQL on GCP, or App Runner/ECS + RDS on AWS). To keep the choice open, avoid
  provider-specific lock-in in the application code where practical.
- **Post fetching:** server-side fetch within the PlatformAdapter; background queue if
  needed.

Rationale: a single TypeScript codebase keeps a solo/small-team MVP simple, Postgres
fits the relational data model, and passwordless auth removes password-storage burden.
Open to alternatives if the team has stronger preferences.

## 13. Open questions

- Final name (§10).
- **Cloud provider: GCP vs AWS — to be decided later** (§12). Affects managed-service
  choices for hosting and the database.
- Exact public-post fetch strategy per platform and its fragility budget (§6.3).
- Auth-code format and expiry window.
- Whether the public lookup should be queryable by platform handle, by URL, or both.
