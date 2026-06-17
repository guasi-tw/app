# 正身 (tsiànn-sin) — Project Context

Identity-backup / alter-account verification service. Lets a person **proactively
verify and cross-link the social accounts they own**, so that when one account is banned,
their surviving verified accounts can vouch for a new one — and anyone can publicly look
up "which accounts are the same person."

Think "Keybase for social media accounts." Born from the 2026-06-14 Meta mass-ban wave
that cost many KOLs their primary accounts.

## Who's working on this

SansWord — building guasi (我是) as a public, trust-oriented product for a Traditional-Chinese
(Taiwan) audience, so **copy quality and 繁中 correctness matter as much as the code** (see the
Language convention). Growing web-development skills — comfortable with React/TypeScript and
Next.js App Router patterns and can follow architectural reasoning, but **prefers clear options
with a recommendation over open-ended questions** when there's a design decision to make. Cares
about code quality and documentation hygiene beyond just shipping: proactively reviews for
duplication, asks for code scans, and thinks about cross-project conventions (this project shares
conventions with other repos like `sans_cube`). Decisions that are the user's to make — brand
copy, product framing, scope — should be surfaced, not assumed.

## Current status

> **Where we are right now lives in two maintained sources — this section does *not* restate the
> version/phase, to avoid drift:**
> - **What's shipped** → [`docs/devlog.md`](docs/devlog.md) — the TL;DR table (newest-first; the top
>   row is the current state).
> - **What's next** → [`todo.md`](todo.md) — the working roadmap.
>
> Implementation is underway (first code shipped 2026-06-15). Below are only the *stable* facts.

- **Repo:** private GitHub repo **`guasi-tw/app`** (remote wired). Work via PRs off `main`
  (squash-merge); `main` is the production branch.
- **Hosting / CI/CD:** **Vercel** (project **`guasi-app`**), domain **https://guasi.tw**. Vercel's
  GitHub integration is the pipeline — **push `main` → production**, **PR → preview**. A post-deploy
  smoke test runs as a GitHub Action (`deployment_status`).
- **Code shape:** flat **modular monolith** at the repo root — `app/` (Next 16 + React 19 + TS, App
  Router) + `lib/*` + `prisma/`. (Monorepo/Turborepo considered + rejected for now — one deployable;
  see [`docs/deployment.md`](docs/deployment.md) §3.)
- **DNS/email caveat:** `guasi.tw` DNS is at **GoDaddy**, and the zone also runs **iCloud Custom
  Email Domain** (MX/SPF/DKIM/DMARC) — don't touch those records when changing web hosting.

When starting feature work, turn the requirement into an implementation plan first
(superpowers:writing-plans is the tool). Capture lasting decisions in the maintained docs below —
not only in a one-off plan/spec.

## Docs

**Two tiers — keep the maintained docs current; the design specs are allowed to go stale:**

- **Maintained `docs/*.md` (authoritative, kept up to date during development):** the files listed
  below. When you add a new `docs/*.md`, add it here with a one-line description.
- **Historical `docs/superpowers/specs/*` + `docs/superpowers/plans/*` (allowed to stale):** the
  brainstorm → spec → plan artifacts from each milestone — a record of *thinking at the time*, **not**
  the source of truth. Current decisions live in CLAUDE.md + the maintained docs; don't cite the specs
  as authoritative or trust them where they conflict with the code or CLAUDE.md.

- [`docs/first_thought.md`](docs/first_thought.md) — the original raw idea (Traditional Chinese).
- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview for pitching, organized by actor (Traditional Chinese).
- [`docs/product-decisions.md`](docs/product-decisions.md) — current **product/identity decisions**: public-URL & slug provisioning, anti-squatting, binding uniqueness, 404 anti-enumeration. The rules + rationale behind CLAUDE.md "Locked decisions."
- [`docs/brand-and-voice.md`](docs/brand-and-voice.md) — **naming, language, voice & marketing-copy** decisions: brand 我是 vs tagline 我是正身 vs concept 正身, domain/handles, 繁中/Taiwan vocab, the actor-clarity rule, and the welcomed pun/wordplay voice. The detail behind the Conventions quick-rules.
- [`docs/platform-verification.md`](docs/platform-verification.md) — empirical capability matrix for reading the **author** and **code-bearing text** on Threads / IG / miin.cc, across post & bio methods. How-to recipes, the URL-handle spoof proof, Vercel render weights, and an evidence log (verified 2026-06-15). Source of truth for platform read mechanics.
- [`docs/deployment.md`](docs/deployment.md) — deployment model (one Vercel app + managed Neon/Blob), CI/CD via Vercel's git integration, modular-monolith→Turborepo repo strategy, and repo/naming conventions. The north-star plan for infra; §5 is the scaffold checklist.
- [`docs/routes.md`](docs/routes.md) — inventory of every App Router route: URL, file, auth requirement, whether it renders the global site chrome (header/footer), and purpose. Includes the `(site)` route-group chrome model. The current map of the URL surface.
- [`docs/email-login-design.md`](docs/email-login-design.md) — maintained design for the **deferred** email-login feature (opaque-`rid` model, OTP throttling, custom DB-session minting). Not yet built; the Google-only MVP is built so it's additive.
- [`docs/services.md`](docs/services.md) — single inventory of every external service/account (status + role + scope); the "what we use," paired with the cost ledger below.
- [`docs/operating-costs.md`](docs/operating-costs.md) — running ledger of operational costs (Vercel Pro, domain, future services).
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings, newest first.

## MVP scope (one-liner)

Threads + IG + miin.cc (pluggable for more) · passwordless login (Google OAuth; email
magic-link/OTP deferred) · verify account ownership via **public post + auth code** ·
cross-link verified accounts · selective
public/private disclosure · public lookup page showing an account's verified siblings
with proof links.

## Locked decisions

- **Platforms (MVP):** Threads + IG + miin.cc, behind a pluggable `PlatformAdapter`
  (Threads/IG read via crawler-UA SSR of canonical URLs; miin.cc via its public JSON API
  `api.miin.cc`). See [`docs/platform-verification.md`](docs/platform-verification.md).
- **Spec depth:** product + architecture (not full technical spec).
- **Trust model:** centralized DB for MVP, but persist **immutable proof records**
  (not just a `verified` flag) so Phase 2 publicly-verifiable proofs is additive.
- **Proof snapshot — deferred to Phase 2 (MVP links to the live post):** the long-term plan
  is self-contained evidence (content + screenshot) + a third-party archive, because a banned
  account's post is gone exactly when proof matters. **MVP ships link-to-live-post only** —
  `ProofRecord` stores the canonical `proofPostUrl`; the snapshot/archive columns exist but are
  unused until Phase 2 (additive, no migration needed then).
- **Append-only public ledger:** bindings and unbindings are permanent events, never
  deletions. **Public = permanent (unbind is a visible event); private stays private.**
- **Unbinding — deferred (no self-service unbind in MVP):** the model treats unbind as a
  permanent ledger event with a reason (hacked / unneeded / sold). **MVP ships no unbind UI** —
  trust-lowering is condition flags (banned/hacked) + 恢復·重新驗證 only (status reserved in the
  schema).
- **Binding uniqueness — per-正身, not global:** the DB constraint is
  `@@unique([userId, platform, accountId])`. The *same* platform account can be legitimately
  bound by *different* 正身 (shared / transferred ownership) — disambiguated by 驗證時間, not
  blocked. There is **no** global "one owner per account" lock.
- **Verification timeline:** surface *when* each account was verified (older = more
  credible).
- **正身 profile:** each 正身 has an avatar, brief description, and a designated **main 分身**
  (a `is_main` flag on a bound account — *not* a free-form URL; at most one per user;
  **the first binding is accepted as the main 分身** — which is what mints the slug — and is
  changeable later on the 分身管理 page). The public
  驗明正身 page is a Linktree-like profile for a *verified* identity.
- **Account status management (§6.8):** owner can mark a 分身 banned/hacked **self-service
  (login only)** — these only *lower* trust, and a hijacker can't remove a flag they don't
  control. Marking it **recovered/unbanned requires re-verification** (a trust-restoring
  claim). All status changes are append-only ledger events shown in the timeline.
- **Site login:** passwordless — **MVP ships Google OAuth only** (via Auth.js); email
  magic-link/OTP is planned but **deferred / not yet built**. No passwords. This is *site login*
  and is unrelated to the "no platform OAuth for identity" rule below (logging in with Google ≠
  proving you own a Threads/IG account).
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
  chosen per-platform; keep web fetch as a fallback so a revoked API token can't take the
  service down. (This is separate from the "no OAuth for identity" rule.) **Shipped: Threads via
  tokenless crawler-UA SSR** — see [`docs/platform-verification.md`](docs/platform-verification.md)
  for the settled per-platform mechanics.
- **Name:** **正身 (tsiànn-sin)** is the product concept term used in the UI
  ("create your 正身"). **我是 / `guasi`** is the brand & domain. **Tagline: 我是正身.**
  Domain **`guasi.tw` is registered** (the website domain). Handle `@gua.si.tw` registered
  on IG (also secures Threads). `guasi.com` taken / `guasi.id` available — both optional,
  later. Japanese-pun alt `guatasi`/`guatashi` was set aside for coherence with 正身.
- **Tech stack (MVP — locked, all on Vercel):** Next.js + TypeScript on **Vercel**;
  **Neon** (serverless Postgres) via Prisma — pooled connection for queries, direct URL for
  migrations; **Auth.js** (Google OAuth — Prisma adapter; email magic-link/OTP deferred) with
  **transactional email via Resend from a `send.guasi.tw` subdomain** (iCloud Custom Email stays
  on root `guasi.tw` for *receiving* only — separate job, never used to send); images
  (snapshots + avatars) in **Vercel Blob / R2**; async screenshot + archive via a
  serverless queue calling an **external screenshot API**. GCP (Cloud Run + Cloud SQL) stays
  a portable future escape hatch. (Spec §12.)

## Open questions / TBD
- Per-platform post-fetch strategy (oEmbed vs web fetch) and its fragility budget (Threads settled — crawler-UA SSR; IG/miin TBD as they ship).
- Whether public lookup is queryable by handle, by URL, or both.
- (Snapshot mechanics → now a Phase-2 deferral, see Locked decisions; auth-code format → shipped: 6-digit, scoped/single-use/expiring.)

## The one principle that drives everything

**Verify while accounts are alive.** A banned account can no longer prove ownership, so
the product only works if users register and cross-link *before* a ban. All UX should
push pre-emptive verification.

## Conventions

- **Language: Traditional Chinese (繁體中文, zh-Hant / Taiwan) for ALL Chinese text** — every
  user-facing UI string, product copy, and doc. Never Simplified (简体). Use Taiwan vocabulary
  (e.g. 登入 not 登录, 帳號 not 账号, 驗證 not 验证, 建置 not 搭建). The only exception is
  user-supplied data we render verbatim (e.g. a person's Google display name). **"Verbatim" means
  don't *translate* it — not skip escaping.** Always escape user-supplied text against injection
  (and reject SVG avatar uploads — a script vector).
- **Brand & terminology (don't mix these up):**
  - **我是** — the **brand name** (paired with `guasi` / domain `guasi.tw`). Use plain **我是**
    for brand/identity fields (e.g. OG `siteName`, wordmark, "the 我是 service").
  - **我是正身** — the **tagline** only. Use where a slogan fits, *not* as the brand name.
  - **正身 (tsiànn-sin)** — the **product concept** term used in UI copy ("建立你的正身",
    "驗明正身 page"). Not the brand.
  - Quick rule: brand → **我是**; slogan → **我是正身**; the thing a user creates → **正身**.
  - (Full naming / domain / handle detail → [`docs/brand-and-voice.md`](docs/brand-and-voice.md).)
- **Copy clarity & voice:** make the *actor* unambiguous — the **user** verifies their own accounts
  (we provide the mechanism), so prefer "驗證並串連你擁有的社群帳號" over "主動驗證…" (which misreads
  as the site doing the verifying). **Wordplay/puns that reinforce the 我是 / 正身 identity theme are
  welcomed** (e.g. the footer link 「關於，我是什麼」) — but clarity wins ties. Detail in
  [`docs/brand-and-voice.md`](docs/brand-and-voice.md).
- Versioning: three-part semver (`vX.Y.Z`). Releases that ship code get a git tag; design-only
  sessions use `vX.Y.0-design` with no tag.
- **Git/PRs:** private GitHub remote **`guasi-tw/app`**. Branch off `main` for work, open a PR,
  **squash-merge**. Commit/push when the user asks. `main` = production (Vercel deploys it).
- **Repo structure:** flat **modular monolith** (`app/` + `lib/*` + `prisma/` at root) — *not* a
  monorepo yet; see [`docs/deployment.md`](docs/deployment.md) §3.
- **Build milestones** are planned with **superpowers:brainstorm → writing-plans**; the resulting
  spec/plan artifacts land under `docs/superpowers/` as *historical* records (see the Docs two-tier
  note — they're allowed to go stale). Lasting decisions from a milestone must be folded into the
  maintained docs (CLAUDE.md Locked decisions, `docs/product-decisions.md`, `docs/routes.md`, etc.),
  and shipped state into `docs/devlog.md` — those, not the spec, are the source of truth afterward.
- Devlog at [`docs/devlog.md`](docs/devlog.md) — update at the end of each session (newest first;
  TL;DR table + tagged learnings). See **Devlog format** below for the exact shape.

## Devlog format (so you don't have to re-read `devlog.md`)

`docs/devlog.md` is newest-first. To add an entry:

1. **TL;DR row** at the top of the TL;DR table (just under the header row), linking to the section
   anchor. Anchors are GitHub auto-generated: lowercase, drop punctuation **except hyphens**
   (`.`, `—`, `:`, `,`, `+`, `(`, `)` are removed), spaces → hyphens — and each space still becomes
   a hyphen even next to a dropped char, so they double up. E.g.
   `## v0.13.0 — site chrome (2026-06-17)` → `#v0130--site-chrome-2026-06-17`.
2. **Section** below the `---`, in this shape:
   ```
   ## vX.Y.Z — <title> (YYYY-MM-DD)
   **Review:** not yet
   (optional) **Design docs:** <links>
   **What was built:** <bullets>
   **Key technical learnings:** <tagged bullets>
   (optional) **Process learnings:** <tagged bullets>
   ```
   - **Version:** `vX.Y.0` main release · `vX.Y.1`+ follow-up sessions on the same version ·
     `vX.Y.0-design` design-only (no git tag).
   - **Heading date:** date-only `(YYYY-MM-DD)` is fine (recent convention); add `HH:MM` only to
     disambiguate multiple same-day entries (pull the time from `git log` of the final commit).
   - **Learning tags:** `` `[note]` `` (well-documented; you'd find it in the docs) ·
     `` `[insight]` `` (non-obvious; changes how you design/debug) · `` `[gotcha]` `` (a trap that
     bit you; high repeat risk).
   - `**Review:**` flips to `complete` once the entry has been reviewed for correctness.

## "Raise a PR" / "ship it" shortcut

When the user says **"ship it"**, **"raise a PR"** (or equivalent), run the prep-and-open-PR flow for
the current feature branch — this counts as the user authorizing the commit/push:

1. **Stage + commit** pending work with a clear message (end with the `Co-Authored-By:` trailer).
2. **Update docs** — refresh any affected `docs/*.md` (esp. [`docs/routes.md`](docs/routes.md) when
   routes change; see **Docs hygiene**).
3. **Update devlog** — add/refresh the `vX.Y.Z` entry + TL;DR row (see **Devlog format**); cross off
   done items in [`todo.md`](todo.md). Commit the doc changes.
4. **Verify** — `npx tsc --noEmit` clean **and** `npx vitest run` green before opening the PR.
5. **Open the PR** — branch off `main`, `gh pr create --base main`. **Then stop.**

**Do NOT merge.** Merging is the user's manual decision: they review the **Vercel preview** deploy on
the PR and **squash-merge on GitHub themselves**. Don't run `gh pr merge` or otherwise merge unless
explicitly told to.

**Tagging is a separate, explicit step.** Only when the user says **"tag it"** (or similar), *after*
they've merged:
1. `git checkout main && git pull` **first** — a squash-merge created a new commit on `main`, so local
   `main` is behind; the tag must land on that merge commit, not a stale one.
2. `git tag -a vX.Y.Z -m "vX.Y.Z — <title>"` then `git push origin vX.Y.Z`. (Releases that ship code
   get a tag; design-only sessions don't. Version + devlog heading + tag must match.)

If any step fails (tsc/tests/push), **stop and report** — don't paper over it.

## GitHub upload safety

Before committing or pushing, scan for:

- Secrets, API keys, tokens, passwords (hardcoded or in `.env*`).
- Private personal info beyond what's already public (a personal email/name not meant to ship).
- Any file not meant to be public (`.env*`, `*.pem`, `*.key`, credential dumps).

The repo is **private**, but treat everything as if it could go public — guasi.tw is a public
product. CLAUDE.md itself is safe to commit (no secrets).
