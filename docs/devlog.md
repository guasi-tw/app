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
| [v0.1.0-design](#v010-design--design--pitch-2026-06-14-2054) | Brainstormed the idea into a product + architecture spec, a non-technical pitch, and project context; git initialized. No code yet. |

---

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
