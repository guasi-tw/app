# 正身 (tsiànn-sin) — Project Context

Identity-backup / alter-account verification service. Lets a person **proactively
verify and cross-link the social accounts they own**, so that when one account is banned,
their surviving verified accounts can vouch for a new one — and anyone can publicly look
up "which accounts are the same person."

Think "Keybase for social media accounts." Born from the 2026-06-14 Meta mass-ban wave
that cost many KOLs their primary accounts.

## Current status

**Phase: design + pitch complete. Implementation NOT started.** The user is not ready to
build yet. No code, no git repo, no stack scaffolding exists.

The next implementation step (when the user is ready) is to invoke the
**superpowers:writing-plans** skill against the design spec to produce an implementation
plan, then execute it.

## Docs

- [`docs/first_thought.md`](docs/first_thought.md) — the original raw idea (Traditional Chinese).
- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview for pitching, organized by actor (Traditional Chinese).
- [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](docs/superpowers/specs/2026-06-14-identity-backup-design.md) — the full product + architecture design spec. **Source of truth for what to build.**

## MVP scope (one-liner)

Threads + IG first (pluggable for more) · passwordless email login · verify account
ownership via **public post + auth code** · cross-link verified accounts · selective
public/private disclosure · public lookup page showing an account's verified siblings
with proof links.

## Locked decisions

- **Platforms (MVP):** Threads + IG first, behind a pluggable `PlatformAdapter`.
- **Spec depth:** product + architecture (not full technical spec).
- **Trust model:** centralized DB for MVP, but persist **immutable proof records**
  (not just a `verified` flag) so Phase 2 publicly-verifiable proofs is additive.
- **Site login:** passwordless email magic link / OTP. No passwords.
- **Verification model:** public-post proof **only**. No DMs. No platform OAuth for
  identity (so Meta can't gate who gets verified).
- **Reading the post:** platform API (oEmbed) *or* public web fetch is acceptable,
  chosen per-platform for whichever ships Phase 1 fastest; keep web fetch as a fallback
  so a revoked API token can't take the service down. (This is separate from the
  "no OAuth for identity" rule.)
- **Name:** 正身 (tsiànn-sin) — "the authentic person." Fallback: 是我啦 (sī guá lah).
- **Tech stack (recommendation, not locked):** Next.js + TypeScript, PostgreSQL + Prisma,
  passwordless email auth.

## Open questions / TBD

- **Domain name** — easy-to-type, since the Hokkien romanization is awkward. Candidates:
  `thereal.me`, `also.me`, `whoami.tw`, `iam.tw`, `itsme.la` (availability unchecked).
- **Cloud provider: GCP vs AWS** — to be decided later; affects managed-service choices.
- Per-platform post-fetch strategy (oEmbed vs web fetch) and its fragility budget.
- Auth-code format and expiry window.
- Whether public lookup is queryable by handle, by URL, or both.

## The one principle that drives everything

**Verify while accounts are alive.** A banned account can no longer prove ownership, so
the product only works if users register and cross-link *before* a ban. All UX should
push pre-emptive verification.

## Conventions

- Versioning: three-part semver (`vX.Y.Z`).
- No git repo yet — `git init` before any version-controlled work (offer this when
  starting implementation).
- No `docs/devlog.md` yet — create one when implementation begins to track learnings.
