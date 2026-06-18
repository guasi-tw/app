# Ansible (Tris-Aura) vs. 我是 (guasi): two takes on social identity & trust

*A side-by-side of two sibling projects that both touch "who is this person, really?" — and why
they barely overlap in practice. Written 2026-06-17, against Ansible's `README.md` /
`docs/ROADMAP.md` and guasi's `CLAUDE.md` / `docs/devlog.md`.*

---

## TL;DR

Both projects care about **identity and trust on social platforms**, both are Taiwan-oriented, and
both were shaped by the fear of losing your audience to a platform's whim. But they solve different
problems at different layers:

- **我是 (guasi)** is a thin **attestation layer over the mainstream platforms you already use**
  (Threads / IG / miin.cc). It proves *"these existing accounts are the same person"* so a ban
  can't erase your identity. Centralized, web-only, ships today.
- **Ansible (Tris-Aura)** is a **whole new decentralized network** — its own self-certifying DID
  identity, a forum, federation to Nostr / ActivityPub / AT Protocol, and W3C verifiable
  credentials. It replaces the platform rather than annotating it.

The genuine overlap is a single concept — *"a verified, trustworthy identity"* — expressed at
opposite altitudes. guasi annotates the platforms; Ansible aims to be one.

## What each project is

### 我是 (guasi) — "Keybase for social-media accounts"

| | |
|---|---|
| **Job to be done** | Proactively verify and cross-link the social accounts *you already own*, so a ban on one can be survived by the others vouching for a new one. Public lookup: "which accounts are the same person?" |
| **Trigger** | The 2026-06-14 Meta mass-ban wave that cost KOLs their primary accounts. |
| **Identity model** | Centralized DB. A 正身 (`User`) cross-links existing platform accounts via **public post + 6-digit auth code**; author resolved from platform authority (crawler-UA SSR / oEmbed). No platform OAuth, no DMs. |
| **Surface** | One public **驗明正身 page** (Linktree-like) showing an identity's verified sibling accounts with proof links + a verification timeline. |
| **Stack** | Single Next.js app on Vercel · Neon Postgres + Prisma · Auth.js (Google OAuth) · mobile-first web. One deployable. |
| **Status** | Shipping incrementally; slices 1–5 merged (create identity, add/verify account, public card, manage tab, profile edit). |
| **Audience** | Traditional-Chinese (Taiwan) creators. Copy quality and 繁中 correctness are first-class. |

### Ansible (Tris-Aura Hybrid Network V2.0) — a local-first sovereign-identity forum

| | |
|---|---|
| **Job to be done** | A pseudonymous-but-Sybil-resistant, local-first, multi-protocol forum + identity stack. Own your identity and content portably across relays; earn trust in tiers. |
| **Identity model** | Canonical **`did:elix`** (self-certifying, portable DID) + `did:key` wallet + `did:web` issuers; `did:plc` is an opt-in Bluesky bridge, not canonical. App-held Ed25519 keys; progressive trust replaces passport-gated onboarding. |
| **Surface** | A federated forum: hosted boards, following/home feeds, discovery/search, moderation console, notifications, trust-gated 真人驗證版 boards. |
| **Stack** | Flutter app + Rust core (Ed25519/MST/atproto repo) + Elixir/Phoenix Relay & AppView + Go W3C-VC issuer + Node web frontend. Six toolchains; multi-service backend. |
| **Status** | Multiple MVP slices across services; full federation, hardware key custody, and the standalone reputation labeler are still gaps. |
| **Audience** | Also Taiwan-flavored (TW digital-identity issuer integration, bilingual search), but aimed at a sovereign-network user base, not mainstream-platform creators. |

## Where they overlap

There is real conceptual overlap — just less than the word "identity" suggests:

1. **"Verified human / verified identity" as a trust primitive.** guasi's *"these accounts are the
   same real person, proven by their own public post"* and Ansible's `verified_human` trust-gated
   boards + reputation tiers are both answers to *"can I trust who I'm talking to?"* — guasi proves
   **sameness/ownership across accounts**, Ansible proves **tiered trustworthiness within a
   network**.
2. **Proof as a durable record.** guasi persists **append-only `ProofRecord` / `BindingEvent`
   ledger** entries (immutable, Phase-2-verifiable). Ansible issues **W3C Verifiable Credentials**
   (`eddsa-jcs-2022`, did:web) and keeps signed op records. Both deliberately store *evidence*, not
   just a boolean flag.
3. **Platform-independence as a value.** Both are reactions to platform control. guasi: survive a
   ban by linking accounts *before* it happens. Ansible: don't depend on the platform at all —
   own a portable DID.
4. **Taiwan / Traditional Chinese context.** guasi targets TW creators in 繁中; Ansible integrates a
   TW digital-identity provider for credential issuance and does bilingual discovery.
5. **A public "verification post" / signed-op as the unit of truth.** guasi's verification post
   doubles as a growth loop; Ansible's signed ops + Forum Host intents are the write primitive.

## Where they diverge (the bigger story)

| Dimension | 我是 (guasi) | Ansible (Tris-Aura) |
|---|---|---|
| **Relationship to existing platforms** | **Annotates** Threads/IG/miin you already own | **Replaces** them with a new network |
| **Identity root** | A DB row (`User` = 正身); accounts are external | A self-certifying cryptographic DID (`did:elix`) |
| **Centralization** | Centralized DB (by design, for MVP) | Local-first + federated relays/AppViews |
| **Verification target** | *Ownership/sameness* of mainstream accounts | *Trust tier* + Sybil-resistance of a pseudonym |
| **Content** | Holds **none** — links out to live posts | Hosts content: boards, feeds, replies, moderation |
| **Federation** | None — it's a lookup page | Nostr + ActivityPub + AT Protocol + Forum Host |
| **Credentials** | Proof records (link-to-live-post; snapshot is Phase 2) | W3C VCs from a did:web issuer + TW provider |
| **Surface area** | One web app, one deployable | Flutter + Rust + 2× Phoenix + Go + Node |
| **User effort** | Log in with Google, post a code, paste URL | Generate keys, manage a wallet, join a network |
| **What it gives up** | No sovereignty — trusts guasi's DB | No mainstream reach — users must come to the network |

The cleanest way to see the gap: **guasi makes your *current* identity ban-resilient without asking
anyone to leave their platform; Ansible asks you to adopt a *new* identity and network you fully
own.** One is an interoperability/attestation play; the other is a sovereignty play.

## Do the features collide? (No — and here's the test)

A feature collision would mean a user picks one *instead of* the other for the same need. That
doesn't really happen:

- A KOL who wants their Threads + IG audience to survive a ban uses **guasi** — Ansible doesn't
  touch their Threads account at all.
- Someone who wants to leave Meta entirely and live on a sovereign, federated forum uses
  **Ansible** — guasi has no content, feed, or network to move *to*.

The one place they *brush* against each other is the verification mechanic: both bind an identity to
a cryptographically/authoritatively attributable post. But guasi binds *outward* to accounts on
platforms it doesn't control, while Ansible binds *inward* to keys and ops it does.

## If you ever wanted them to compose

They're more complementary than competitive. Two plausible bridges (neither is on either roadmap —
this is just where the seams line up):

- **Ansible as a guasi platform adapter.** guasi's `PlatformAdapter` seam already abstracts
  "resolve the author of a proof post." A `did:elix` profile could become one more linkable
  "account," so a creator's sovereign identity sits in the same 驗明正身 card as their Threads/IG.
- **guasi attestations as an Ansible trust signal.** A guasi public card ("these N mainstream
  accounts are the same person, proven") is exactly the kind of external evidence Ansible's
  reputation tiers could ingest to bootstrap trust for a newcomer — without Ansible having to
  crawl Threads itself.

## Bottom line

Same anxiety ("a platform can erase me"), same region, adjacent vocabulary — but **different layers
of the stack and almost no feature overlap.** guasi is a focused, centralized, web-only
*attestation layer* that makes the accounts you already have ban-resilient and publicly cross-linked.
Ansible is a broad, decentralized, multi-service *sovereign-identity network* that replaces the
platform with portable DIDs, credentials, and a federated forum. If anything, guasi could be a small
node in — or a trust feeder for — the kind of world Ansible is trying to build.
