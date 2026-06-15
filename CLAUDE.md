# 正身 (tsiànn-sin) — Project Context

Identity-backup / alter-account verification service. Lets a person **proactively
verify and cross-link the social accounts they own**, so that when one account is banned,
their surviving verified accounts can vouch for a new one — and anyone can publicly look
up "which accounts are the same person."

Think "Keybase for social media accounts." Born from the 2026-06-14 Meta mass-ban wave
that cost many KOLs their primary accounts.

## Current status

**Phase: implementation started — walking skeleton live (v0.4.0, 2026-06-15).** Design + pitch
are complete; the first code has shipped.

- **Repo:** private GitHub repo **`guasi-tw/app`** (remote wired). Work via PRs off `main`
  (squash-merge); `main` is the production branch.
- **Live:** **https://guasi.tw** serves a Next.js hello-world on **Vercel** (project
  **`guasi-app`**). CI/CD = Vercel's GitHub integration — **push `main` → production**,
  **PR → preview** (no GitHub Actions yet).
- **Code shape:** flat **modular monolith** — `app/` (Next 16 + React 19 + TS, App Router) at
  the repo root; `lib/*` and `prisma/` arrive when product code lands. (Monorepo/Turborepo
  considered + rejected for now — one deployable; see [`docs/deployment.md`](docs/deployment.md) §3.)
- **DNS/email caveat:** `guasi.tw` DNS is at **GoDaddy**, and the zone also runs **iCloud Custom
  Email Domain** (MX/SPF/DKIM/DMARC) — don't touch those records when changing web hosting.

**Next milestone:** Neon Postgres + first Prisma migration + a `/api/health` route (app→DB
proof), then MVP features. Use **superpowers:writing-plans** against the design spec to turn it
into an implementation plan before building features.

## Docs

- [`docs/first_thought.md`](docs/first_thought.md) — the original raw idea (Traditional Chinese).
- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview for pitching, organized by actor (Traditional Chinese).
- [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](docs/superpowers/specs/2026-06-14-identity-backup-design.md) — the full product + architecture design spec. **Source of truth for what to build.**
- [`docs/superpowers/specs/2026-06-15-routing-and-identity-design.md`](docs/superpowers/specs/2026-06-15-routing-and-identity-design.md) — deep-dive on URL routing, public-ID provisioning + squatting protection, and platform-adapter author-resolution (incl. the miin.cc finding). Splits these concerns out of the main spec.
- [`docs/platform-verification.md`](docs/platform-verification.md) — empirical capability matrix for reading the **author** and **code-bearing text** on Threads / IG / miin.cc, across post & bio methods. How-to recipes, the URL-handle spoof proof, Vercel render weights, and an evidence log (verified 2026-06-15). Source of truth for platform read mechanics.
- [`docs/deployment.md`](docs/deployment.md) — deployment model (one Vercel app + managed Neon/Blob), CI/CD via Vercel's git integration, modular-monolith→Turborepo repo strategy, and repo/naming conventions. The north-star plan for infra; §5 is the scaffold checklist.
- [`docs/superpowers/specs/2026-06-15-walking-skeleton-design.md`](docs/superpowers/specs/2026-06-15-walking-skeleton-design.md) — the scaffold + Vercel CI/CD + `guasi.tw` domain milestone (shipped as v0.4.0); a per-session execution tracker (checkboxes + session log) against `deployment.md`.
- [`docs/operating-costs.md`](docs/operating-costs.md) — running ledger of operational costs (Vercel Pro, domain, future services).
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings, newest first.

## MVP scope (one-liner)

Threads + IG + miin.cc (pluggable for more) · passwordless email login · verify account
ownership via **public post + auth code** · cross-link verified accounts · selective
public/private disclosure · public lookup page showing an account's verified siblings
with proof links.

## Locked decisions

- **Platforms (MVP):** Threads + IG + miin.cc, behind a pluggable `PlatformAdapter`
  (Threads/IG read via crawler-UA SSR of canonical URLs; miin.cc via its public JSON API
  `api.miin.cc`). See [`docs/platform-verification.md`](docs/platform-verification.md).
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
- **正身 profile:** each 正身 has an avatar, brief description, and a designated **main 分身**
  (a `is_main` flag on a bound account — *not* a free-form URL; at most one per user;
  **defaults to the first verified 分身**, changeable on the 分身管理 page). The public
  驗明正身 page is a Linktree-like profile for a *verified* identity.
- **Account status management (§6.8):** owner can mark a 分身 banned/hacked **self-service
  (login only)** — these only *lower* trust, and a hijacker can't remove a flag they don't
  control. Marking it **recovered/unbanned requires re-verification** (a trust-restoring
  claim). All status changes are append-only ledger events shown in the timeline.
- **Site login:** passwordless — **email magic link / OTP *and* Google OAuth** (via Auth.js).
  No passwords. This is *site login* and is unrelated to the "no platform OAuth for identity"
  rule below (logging in with Google ≠ proving you own a Threads/IG account).
- **Verification model:** public-post proof **only**. No DMs. No platform OAuth for
  identity (so Meta can't gate who gets verified).
- **Binding flow (§6.2):** user picks platform (optionally pre-declares the handle, as a
  confirmation aid only) → we give a copy-paste template containing a 6-digit auth code, a
  `@gua.si.tw` tag, and the user's 驗明正身 page URL → user posts it → **pastes the URL back
  (manual paste is the MVP primary path — synchronous & more responsive than a mention
  webhook; auto-capture deferred to Phase 2)**. **The verification post doubles as the growth
  engine** (public + links back), the built-in answer to 行銷困難.
- **Verification security model (§6.2/§6.3/§8):** the **bound 分身 is the proof post's
  author, resolved from platform authority** (oEmbed/API or strictly-validated canonical URL
  — never user-supplied page content). The author-match target is the *specific 分身*, never
  the 正身 identity name or the `@gua.si.tw` tag; **many 分身 per platform** are allowed, each
  its own binding request. The **auth code is scoped to one binding request, single-use, and
  expiring** — a leaked/copied code is useless in any other session. 6 digits is fine because
  security = author-match + scope + expiry, not entropy. (Data model: `binding_requests`
  table holds the pending state.) IG caption links aren't clickable (Threads' are).
- **Reading the post:** platform API (oEmbed) *or* public web fetch is acceptable,
  chosen per-platform for whichever ships Phase 1 fastest; keep web fetch as a fallback
  so a revoked API token can't take the service down. (This is separate from the
  "no OAuth for identity" rule.)
- **Name:** **正身 (tsiànn-sin)** is the product concept term used in the UI
  ("create your 正身"). **我是 / `guasi`** is the brand & domain. **Tagline: 我是正身.**
  Domain **`guasi.tw` is registered** (the website domain). Handle `@gua.si.tw` registered
  on IG (also secures Threads). `guasi.com` taken / `guasi.id` available — both optional,
  later. Japanese-pun alt `guatasi`/`guatashi` was set aside for coherence with 正身.
- **Tech stack (MVP — locked, all on Vercel):** Next.js + TypeScript on **Vercel**;
  **Neon** (serverless Postgres) via Prisma — pooled connection for queries, direct URL for
  migrations; **Auth.js** (Google OAuth + email magic-link/OTP, Prisma adapter) with
  **transactional email via Resend from a `send.guasi.tw` subdomain** (iCloud Custom Email stays
  on root `guasi.tw` for *receiving* only — separate job, never used to send); images
  (snapshots + avatars) in **Vercel Blob / R2**; async screenshot + archive via a
  serverless queue calling an **external screenshot API**. GCP (Cloud Run + Cloud SQL) stays
  a portable future escape hatch. (Spec §12.)

## Open questions / TBD
- Per-platform post-fetch strategy (oEmbed vs web fetch) and its fragility budget.
- Snapshot mechanics: screenshot rendering (headless browser?), which third-party archive, where to store snapshot images.
- Auth-code format and expiry window.
- Whether public lookup is queryable by handle, by URL, or both.

## The one principle that drives everything

**Verify while accounts are alive.** A banned account can no longer prove ownership, so
the product only works if users register and cross-link *before* a ban. All UX should
push pre-emptive verification.

## Conventions

- Versioning: three-part semver (`vX.Y.Z`). Releases that ship code get a git tag; design-only
  sessions use `vX.Y.0-design` with no tag.
- **Git/PRs:** private GitHub remote **`guasi-tw/app`**. Branch off `main` for work, open a PR,
  **squash-merge**. Commit/push when the user asks. `main` = production (Vercel deploys it).
- **Repo structure:** flat **modular monolith** (`app/` + `lib/*` + `prisma/` at root) — *not* a
  monorepo yet; see [`docs/deployment.md`](docs/deployment.md) §3.
- **Build milestones** get an **execution spec** under `docs/superpowers/specs/` (per-session
  tracker: checkboxes + session log), with `deployment.md` / the design specs as the north star —
  see the walking-skeleton spec for the pattern.
- Devlog at [`docs/devlog.md`](docs/devlog.md) — update at the end of each session (newest first;
  TL;DR table + tagged learnings).
