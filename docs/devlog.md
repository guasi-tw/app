# Devlog

Running log of decisions and learnings for 正身 (tsiànn-sin). Newest entries first.

### Learning tags

| Tag | Meaning |
|-----|---------|
| `[note]` | Useful context, well-documented — good to have written down but you'd find it in the docs |
| `[insight]` | Non-obvious; meaningfully changes how you design or debug something |
| `[gotcha]` | A specific trap that bit you; high risk of biting you again — bookmark this |

## TL;DR

| Version | Summary |
|---------|---------|
| [v0.1.1-design](#v011-design--snapshot-ledger-status--naming-2026-06-14-2311) | Deepened the design: proof snapshots, append-only ledger, unbinding, timeline, account status management, verification-post growth loop; finalized naming/domain (我是/正身, `guasi.tw`). |
| [v0.1.0-design](#v010-design--design--pitch-2026-06-14-2054) | Brainstormed the idea into a product + architecture spec, a non-technical pitch, and project context; git initialized. No code yet. |

---

## v0.1.1-design — Snapshot, ledger, status & naming (2026-06-14 23:11)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- Folded a trusted reviewer's notes ([`first_thought.md`](first_thought.md)'s sibling [`random_thoughts.md`](random_thoughts.md)) and several new decisions into the spec.
- **Proof snapshot at verification time** (§6.4) — capture content + screenshot + third-party archive, so a proof survives the account/post being banned.
- **Append-only public ledger** (§6.6), **unbinding** with reasons (§6.5), **verification timeline** (§6.7).
- **Account status management** (§6.8) — owner marks banned/hacked (self-service) vs unbanned/reclaimed (re-verify).
- **Verification-post flow** (§6.2) — choose platform → copy-paste template (6-digit code + `@gua.si.tw` tag + 驗明正身 URL) → post → paste URL or tag auto-capture.
- Finalized naming: concept term **正身**, brand/domain **我是/`guasi`** (`guasi.tw` registered), tagline **我是正身**, UI terms 建立正身 / 註冊分身 / 驗明正身.
- Built a 13-page open-slide pitch deck (kept local, gitignored — not committed).

**Key technical learnings:**
- `[insight]` **A banned account's proof post dies exactly when the proof matters most.** Snapshot + independently archive at verification time; don't store a live URL. A self-captured snapshot is "trust the site," so a third-party archive (+ Phase 2 crypto timestamp) is what makes it independently credible.
- `[insight]` **Status-change asymmetry.** Trust-*reducing* claims (banned/hacked) can be self-service (login only) — they can't be abused to impersonate, and a hijacker can't remove a flag on the 正身 they don't control. Trust-*restoring* claims (recovered) must be re-verified.
- `[insight]` **The verification post is the growth engine.** Public + tags `@gua.si.tw` + links back to the user's page → every proof markets the service. This is the built-in answer to 行銷困難.
- `[insight]` **Separate "OAuth for identity" from "API for reading a post."** Reading/auto-capturing posts via platform API is fine; tying *identity* to Meta OAuth is not.
- `[gotcha]` **Instagram caption links aren't clickable** (Threads' are), and IG posts need an attached image. Keep the URL short/typeable and lean on the IG bio link.
- `[note]` 6-digit auth code suffices — security is author-match + expiry + single-use, not code entropy.

**Process learnings:**
- `[insight]` **Brand name vs concept term can be split deliberately.** Letting 正身 carry the meaning frees the domain (我是/guasi) to be simple; they compose into the tagline 我是正身. Avoids two competing "clever" names.
- `[note]` Domain discovery matters less than the social handle for this product, so `.com`/`.id` are optional later pickups; `guasi.tw` is enough to launch.

## v0.1.0-design — Design & pitch (2026-06-14 20:54)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- Turned the raw idea ([`first_thought.md`](first_thought.md)) into a full product + architecture design spec.
- Wrote a non-technical product pitch ([`product-pitch.md`](product-pitch.md)) organized by actor (the website, the KOL, the public viewer).
- Created project [`CLAUDE.md`](../CLAUDE.md) capturing locked decisions and open questions for resuming work.
- Initialized git (local only, private) and made the first commit. No remote yet.
- Chose the name 正身 (tsiànn-sin); fallback 是我啦 (sī guá lah).

**Key technical learnings:**
- `[insight]` **Verify while accounts are alive.** A banned account can no longer prove ownership, so the product only has value if users register and cross-link *before* a ban. This single constraint drives the whole UX (push pre-emptive verification).
- `[insight]` **Persist immutable proof records, not a `verified` boolean.** Storing `(platform, account_id, proof_post_url, auth_code, fetched_author_id, verified_at)` is what makes the Phase 2 "publicly-verifiable proofs" upgrade additive instead of forcing a re-verification of every user.
- `[insight]` **Separate "OAuth for identity" from "API for reading a post."** Verification must NOT depend on Meta OAuth (else Meta gates who gets verified — fatal for an anti-ban product). But using a platform API (oEmbed) just to *read* a public post is fine. Keep web-fetch as a fallback so a revoked API token can't take the service down.
- `[note]` Verification mechanism is public-post + one-time auth code (no DMs — DM automation violates ToS and risks banning the service's own accounts).
- `[note]` Prior art to study: Keybase (public proofs), Mastodon `rel="me"`, Bluesky domain handles.

**Process learnings:**
- `[note]` Git privacy is about the *remote*, not git itself — `git init` is fully local/private; staying private until MVP just means no public remote (a private remote is also an option for backup).

**Open questions:**
- Domain name (Hokkien romanization is hard to type; candidates: `thereal.me`, `whoami.tw`, `iam.tw`, `itsme.la`).
- Cloud provider: GCP vs AWS.
- Per-platform post-fetch strategy (oEmbed vs web fetch).
- Auth-code format/expiry; public-lookup query shape (handle vs URL).
