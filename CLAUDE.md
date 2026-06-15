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
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings, newest first.

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
- **Proof snapshot:** capture self-contained evidence (content + screenshot) at
  verification time AND submit the post URL to a third-party archive — a banned account's
  post is gone exactly when the proof matters most. Don't rely on the live URL.
- **Append-only public ledger:** bindings and unbindings are permanent events, never
  deletions. **Public = permanent (unbind is a visible event); private stays private.**
- **Unbinding:** users can unbind with a reason (hacked / unneeded / sold); a sold account
  releases its uniqueness lock so a new owner can re-verify it later.
- **Verification timeline:** surface *when* each account was verified (older = more
  credible).
- **Account status management (§6.8):** owner can mark a 分身 banned/hacked **self-service
  (login only)** — these only *lower* trust, and a hijacker can't remove a flag they don't
  control. Marking it **recovered/unbanned requires re-verification** (a trust-restoring
  claim). All status changes are append-only ledger events shown in the timeline.
- **Site login:** passwordless email magic link / OTP. No passwords.
- **Verification model:** public-post proof **only**. No DMs. No platform OAuth for
  identity (so Meta can't gate who gets verified).
- **Binding flow (§6.2):** user picks platform → we give a copy-paste template containing a
  6-digit auth code, a `@gua.si.tw` tag, and the user's 驗明正身 page URL → user posts it →
  pastes the URL back (or we auto-detect via the tag). **The verification post doubles as
  the growth engine** (public + links back), the built-in answer to 行銷困難. 6-digit code
  is fine because security = author-match + expiry, not entropy. IG caption links aren't
  clickable (Threads' are).
- **Reading the post:** platform API (oEmbed) *or* public web fetch is acceptable,
  chosen per-platform for whichever ships Phase 1 fastest; keep web fetch as a fallback
  so a revoked API token can't take the service down. (This is separate from the
  "no OAuth for identity" rule.)
- **Name:** **正身 (tsiànn-sin)** is the product concept term used in the UI
  ("create your 正身"). **我是 / `guasi`** is the brand & domain. **Tagline: 我是正身.**
  Domain **`guasi.tw` is registered** (the website domain). Handle `@gua.si.tw` registered
  on IG (also secures Threads). `guasi.com` taken / `guasi.id` available — both optional,
  later. Japanese-pun alt `guatasi`/`guatashi` was set aside for coherence with 正身.
- **Tech stack (recommendation, not locked):** Next.js + TypeScript, PostgreSQL + Prisma,
  passwordless email auth.

## Open questions / TBD

- **Cloud provider: GCP vs AWS vs Vercel** — to be decided later; affects managed-service choices.
- Per-platform post-fetch strategy (oEmbed vs web fetch) and its fragility budget.
- Snapshot mechanics: screenshot rendering (headless browser?), which third-party archive, where to store snapshot images.
- Auth-code format and expiry window.
- Whether public lookup is queryable by handle, by URL, or both.

## The one principle that drives everything

**Verify while accounts are alive.** A banned account can no longer prove ownership, so
the product only works if users register and cross-link *before* a ban. All UX should
push pre-emptive verification.

## Conventions

- Versioning: three-part semver (`vX.Y.Z`).
- Git initialized (local only, no remote). Commit when the user asks; branch off `main`
  for feature work.
- Devlog at [`docs/devlog.md`](docs/devlog.md) — update at the end of each session.
  Design-only sessions use `vX.Y.0-design` with no git tag; releases get semver tags.
