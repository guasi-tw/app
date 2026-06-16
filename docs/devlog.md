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
| [v0.7.0-design](#v070-design--mvp-wireframes--page-flows-2026-06-16) | **MVP wireframes & page flows (design, approved).** All 9 surfaces (Home, Create Identity, Add Account per-platform wizard, Identity Card = Accounts/Timeline/Manage, pre-provisioned state). Decisions that **change** parent specs: snapshots **dropped** → link to live post; slug minted at main-account designation (**IG/Threads-only** source); **no self-service unbind**; **no binding-uniqueness lock** (per-owner `linked_accounts` rows); `/r/{short_ref}` collision-proof short-link; `binding_requests` **commit-on-confirm**. To be built **incrementally** (Slice 1 = Foundation + Create Identity). No code shipped. |
| [v0.6.0](#v060--authjs-site-login-google-oauth-2026-06-15-2053) | **Site login (Google).** Auth.js v5 + `@auth/prisma-adapter` on Neon, **DB sessions**; `User`=正身 with profile columns seeded once from Google via an adapter `createUser` wrapper (also normalizes email); `signIn` rejects unverified Google emails; login/logout in the shell. New **Vitest** harness (unit + self-skipping DB integration). Gotchas: next-auth v5 peer range stops at Next 15 → `.npmrc legacy-peer-deps`; Next 16 renamed `middleware.ts`→`proxy.ts` (built neither). Preview OAuth proxies through prod via `AUTH_REDIRECT_PROXY_URL`. |
| [v0.5.0](#v050--db-skeleton-neon--prisma--token-gated-apihealth-2026-06-15-1502) | **DB skeleton.** Neon Postgres + Prisma wired in; `prisma migrate deploy` in the build; trivial `HealthCheck` model + first migration; **token-gated `/api/health`** (401 before any DB call); per-preview **Neon branching**; repo's **first GitHub Action** (post-deploy smoke test). Gotchas: preview deploys sit behind **Vercel SSO** (need automation-bypass); `prisma@latest`=7.x → pinned 6.x for clean audit. |
| [v0.4.1](#v041--post-launch-ops--decisions-2026-06-15-1229) | Post-launch ops + decisions: Vercel **Ignored Build Step** (skip docs-only deploys, verified live), README **live-status badges**, started the **cost ledger** + **services inventory**, and **locked the email architecture** (Resend on `send.guasi.tw`; iCloud for receiving). Gotcha: Vercel Hobby can't deploy an **org-owned private repo** → Pro. |
| [v0.4.0](#v040--walking-skeleton-scaffold-vercel-cicd--guasitw-live-2026-06-15) | **First code.** Flat modular-monolith Next.js scaffold (Next 16 + React 19 + TS) + hello-world landing; **Vercel CI/CD** wired (`push main`→prod, PR→preview); **`guasi.tw` live** (GoDaddy DNS → Vercel, SSL, `www`→apex). postcss advisory cleared via `overrides`. |
| [v0.3.0-design](#v030-design--routing-id-provisioning--platform-verification-2026-06-15) | Designed URL routing + proof-gated ID provisioning & squatting protection; **empirically verified** platform read-mechanics (Threads/IG crawler-UA SSR; miin's public JSON API) and the URL-handle spoof defense; created [`platform-verification.md`](platform-verification.md); slimmed the routing spec's §5 to a pointer. |
| [v0.2.0-design](#v020-design--verification-security-model--vercel-stack-lock-in-2026-06-15-0029) | Locked the verification security model (bound 分身 = post author from platform authority; scoped single-use code; manual paste-back primary) and the full MVP stack (all on Vercel: Neon + Auth.js + Google OAuth/email OTP + Vercel Blob). |
| [v0.1.1-design](#v011-design--snapshot-ledger-status--naming-2026-06-14-2311) | Deepened the design: proof snapshots, append-only ledger, unbinding, timeline, account status management, verification-post growth loop; finalized naming/domain (我是/正身, `guasi.tw`). |
| [v0.1.0-design](#v010-design--design--pitch-2026-06-14-2054) | Brainstormed the idea into a product + architecture spec, a non-technical pitch, and project context; git initialized. No code yet. |

---

## v0.7.0-design — MVP wireframes & page flows (2026-06-16)

**Review:** complete — a fresh-context consistency review (general-purpose subagent) mid-session caught a
dropped `§B` heading + a `§D.3`/`§H` "delete-binding vs commit-on-confirm" contradiction (both fixed);
then user-reviewed and **approved**.

**Design docs:**
- MVP wireframes & page flows: [Spec](superpowers/specs/2026-06-16-mvp-wireframes-design.md)

**What was built:** (design only — no code shipped)
- Wireframed all **9 MVP surfaces** against the spec §6 flows (used the brainstorming **visual
  companion**): Home (search box = placeholder, feature deferred), Create Identity onboarding, Add Account
  per-platform wizard, Identity Card (Accounts / Timeline / Manage tabs), and the pre-provisioned state.
- Settled English page names: Home / Create Identity / Add Account / **Identity Card** (驗明正身) /
  **Manage** (分身管理).
- Recorded a build sequence + **Slice-1 scope** for incremental implementation (spec §I).

**Key technical learnings:**
- `[insight]` **Removing the pre-declared handle forces commit-on-confirm.** Without a declared handle,
  the user first sees the *resolved* author at the success step → must be able to reject it. To let
  "wrong account" cancel without reversing an append-only `bound` event, the durable artifacts
  (`linked_account`, ledger event, slug) are written **only at the terminal confirm**; before that only
  the `binding_requests` row exists (`pending`/`resolved`) and simply expires if abandoned.
- `[insight]` **The first verification post is a short-URL design.** The slug can't exist at first-post
  time (derived from the not-yet-resolved author), so the post carries `/r/{short_ref}` — a short opaque
  token minted at account creation that 308-redirects to the slug once provisioned. Putting it on its
  **own `/r/` path** (not `/gua/`) makes refs and handle-derived slugs **collision-proof by construction**
  (a same-namespace short ref could squat a real handle someone later proves).
- `[insight]` **Slug minting = a deliberate "set 主要帳號" action, not silent on first bind** — resolves
  the routing-spec open slug-setup-UX question; confirm-as-slug forces the main account public (it's the
  public face).
- `[insight]` **Dropping the uniqueness lock → per-owner `linked_accounts` rows.** The same
  `(platform, account_id)` can be bound by multiple 正身 (each proves ownership); uniqueness moves to
  `(user_id, platform, account_id)`. Viewers disambiguate competing claims via the timeline
  (recency/condition); this also mooted the parent "sold → release lock" concern.
- `[gotcha]` **`updated_at` is for the future search feature, not the timeline.** The timeline must come
  from the append-only `binding_events` ledger — a single mutable `updated_at` can't represent a
  multi-event history (banned → recovered → banned).
- `[note]` **Decisions that change parent specs** (spec §A): proof snapshots **dropped** for MVP (link to
  live post; dead link acceptable) — reverses the §6.4 + CLAUDE.md locked decision; **IG/Threads-only**
  slug source (miin stays a binding platform but defers as a slug source — closes weak-platform
  squatting); **no self-service unbind** (bindings permanent; only status changes). All kept additive for
  Phase 2.
- `[note]` **Per-platform publish affordance:** Threads has a prefilled web compose intent (one-click
  post); IG can't prefill a feed caption + needs an image (copy-paste); miin copy-paste. The
  `PlatformAdapter` declares it — confirm the Threads intent empirically before build.

**Process learnings:**
- `[insight]` **Editing a long spec across many turns drifts.** A late insert silently swallowed the §B
  heading; the fresh-context reviewer caught it where the main loop (primed to think it's fine) didn't —
  the review-protocol payoff in miniature. Lesson: re-read structural anchors after big inserts.
- `[note]` Decided to build the MVP **incrementally** (one page/slice at a time, each its own
  writing-plans → execute → review → merge) rather than one-shot. Visual mockups persist under
  `.superpowers/brainstorm/` (gitignored).

## v0.6.0 — Auth.js site login (Google OAuth) (2026-06-15 20:53)

**Review:** complete — fresh-context code review (no critical/important issues) + **production login round-trip verified on `https://guasi.tw`** (seeded 正身 row confirmed in the prod Neon branch; login→logout→re-login all clean).

**Design docs:**
- Auth.js site login (Google MVP): [Spec](superpowers/specs/2026-06-15-authjs-site-login-design.md) [Plan](superpowers/plans/2026-06-15-authjs-site-login.md)

**What was built:**
- **Auth.js v5 (`next-auth@5.0.0-beta.31`) + `@auth/prisma-adapter`** wired into the App Router with
  **database sessions** (`session.strategy: "database"`) — server-side revocation, the foundation for
  §6.8 hacked-account flows. Route handler at `app/api/auth/[...nextauth]/route.ts`; `lib/auth/*` opens
  the auth seam (`adapter.ts`, `callbacks.ts`, `providers.ts`, `index.ts`).
- **Google is the only login method** (`providers.ts`); email magic-link/OTP stays deferred and additive.
- **`User` IS the 正身** — schema extended with app-owned `displayName`/`avatarUrl`/`bio`/`createdAt`
  alongside the Auth.js-managed columns; one migration adds `User`/`Account`/`Session`/`VerificationToken`,
  `HealthCheck` untouched.
- **Adapter `createUser` wrapper** folds email normalization + one-time profile seeding into the single
  `User` insert (seeds `displayName`/`avatarUrl` from the Google profile as editable defaults).
- **`signIn` callback rejects unverified Google emails**; non-Google providers pass through.
- **Login page** (`/login`, server-action Google button) + **app-shell login/logout** (`/` reads
  `auth()`, shows 已登入：<name> + 登出, or a 登入 link).
- **New Vitest harness** — pure-function unit tests (normalize/seed/signIn guard) run in `node` with no
  DB; one DB integration test exercises the real wrapped adapter against the Neon `vercel-dev` branch and
  **self-skips** when `DATABASE_URL` is unset, so `npm test` is green everywhere. 10 tests pass.
- **Post-merge fixes from smoke-testing:** un-nested the logout `<form>` from a `<p>` (invalid HTML →
  hydration error); added `suppressHydrationWarning` to `<body>` (browser extensions mutate it); locked
  **Traditional Chinese (zh-Hant)** as a project-wide convention in `CLAUDE.md`. Home/login headings set
  to 我是首頁 / 我是登入頁.

**Key technical learnings:**
- `[gotcha]` **next-auth v5 (`@beta`) declares a peer range of `next: ^14 || ^15`** — a plain
  `npm install` aborts with `ERESOLVE` against Next 16. Fix: `.npmrc` `legacy-peer-deps=true`, committed
  so Vercel's build install honors it too.
- `[gotcha]` **Next 16 renamed `middleware.ts` → `proxy.ts`** (old name still works). We built **neither** —
  route protection is out of scope for site login.
- `[insight]` **Seeding + email-normalization belong in the adapter `createUser` wrapper, not
  `events.createUser`.** One atomic insert with the normalized email and seeded profile; can't be skipped,
  no second write, and the mapping is a pure function we unit-test. `events.createUser` would fire *after*
  the row exists with a non-normalized email.
- `[insight]` **Vercel preview OAuth must proxy through prod via `AUTH_REDIRECT_PROXY_URL`** — preview URLs
  are dynamic and can't be pre-registered as Google redirect URIs, so register only prod + localhost and
  set the proxy URL on Vercel's Preview env (Auth.js v5's documented answer).
- `[gotcha]` **`signInCallback`'s type needs a *double* `NonNullable`** — `NextAuthConfig["callbacks"]` is
  optional *and* its `signIn` member is optional, so `NonNullable<...>["signIn"]` still includes `undefined`
  and `tsc` rejects invoking it in tests. `NonNullable<NonNullable<...>["signIn"]>` strips it.
- `[note]` **Vitest loads `.env` into `process.env`**, so the DB integration test ran for real (not
  skipped) locally against the `vercel-dev` branch — Prisma Client itself doesn't load `.env`, but Vitest
  does.
- `[gotcha]` **The preview-proxy strategy can't smoke-test the *first* auth PR.** `AUTH_REDIRECT_PROXY_URL`
  routes preview OAuth callbacks *through production* (`https://guasi.tw/api/auth/...`) — but this is the PR
  that *introduces* those routes, so the prod callback **404s until merge**. Bootstrap gap: smoke-test
  **locally** (registered `localhost` redirect, no proxy) pre-merge, then on prod post-merge. Future preview
  PRs work fine once prod has the routes.
- `[gotcha]` **`<form>` cannot be nested inside `<p>`** (invalid HTML) — but neither `tsc` nor `next build`
  catches it; it only surfaces at **runtime as a hydration error**. The logout form shipped inside a `<p>`
  from the plan's literal JSX; fixed to a `<div>`. Build-green ≠ valid DOM.
- `[note]` **Browser extensions (Feedly's `data-feedly-mini`, Grammarly, etc.) mutate `<body>`/`<html>`
  before React hydrates**, producing an attribute-mismatch hydration warning that looks like our bug but
  isn't. The sanctioned fix is `suppressHydrationWarning` on `<body>` — safe because our own render there
  is deterministic. The dev-overlay call stack naming a `chrome-extension://…` script is the tell.

**Process learnings:**
- `[gotcha]` A **Google `client_secret_*.json`** downloaded from Cloud Console landed loose in the repo
  root and wasn't covered by `.gitignore` (creds already live in `.env`). Added a `client_secret_*.json`
  ignore rule before the first commit so the secret can't be committed.

---

## v0.5.0 — DB skeleton: Neon + Prisma + token-gated /api/health (2026-06-15 15:02)

**Review:** not yet

**Design docs:**
- DB Skeleton (Milestone 2): [Spec](superpowers/specs/2026-06-15-db-skeleton-design.md)

**What was built:**
- **Neon Postgres + Prisma 6.19.3** wired into the app — pooled `DATABASE_URL` for runtime queries,
  direct `DATABASE_URL_UNPOOLED` for migrations; `lib/db/client.ts` Prisma singleton (opens the
  `lib/*` seam).
- **Migrations in the pipeline** — `build: prisma migrate deploy && next build`, `postinstall:
  prisma generate` (both in `package.json`, no Vercel dashboard override).
- **Trivial `HealthCheck` model + first migration** (`init_health_check`) — proves the migration
  runs end-to-end without committing to the real §8 schema.
- **Token-gated `GET /api/health`** — checks `x-health-token` against `HEALTH_CHECK_SECRET` and
  returns 401 *before any DB call*; on success does a real `healthCheck.count()` →
  `{status,db,rows,time}`. `rows` exposes per-branch DB isolation directly in the response.
- **Per-preview Neon branching** via the Neon–Vercel integration — each preview deploy gets its own
  branch off `production`, auto-deleted on merge; prod hits the `production` branch.
- **Repo's first GitHub Action** — `scripts/smoke.mjs` (zero-dep) + `.github/workflows/smoke.yml`,
  a post-deploy smoke test on `deployment_status` (prod: apex + www + health; preview: health; with
  the Vercel automation-bypass header). Prod run: **4/4 green**.
- Docs: the milestone execution spec, plus README / `services.md` / `operating-costs.md` updates;
  `deployment.md` §5 ticked.

**Key technical learnings:**
- `[gotcha]` **Vercel preview deploys sit behind Vercel Authentication (SSO).** Any automated probe
  (curl, the smoke Action) gets a *false 401* — the SSO wall, not the app — *before* reaching the
  route. Fix: enable **Protection Bypass for Automation** and send `x-vercel-protection-bypass`. The
  **production custom domain (`guasi.tw`) is exempt**; only preview + generated prod `*.vercel.app`
  URLs are gated.
- `[insight]` **Preview DB env vars are injected per-deployment, not as static project vars.** With
  preview branching on, the integration sets `DATABASE_URL`/`DATABASE_URL_UNPOOLED` on each preview
  *at deploy time* (→ that deploy's branch), so the "Preview" column in Settings is **blank by
  design** — empty-Preview is correct *iff* branching is on, broken if it's off.
- `[insight]` The integration **auto-creates a `vercel-dev` branch** for Vercel's Development env;
  point local `.env` at it instead of a hand-made `dev` branch, or you get two drifting dev DBs.
- `[gotcha]` **`prisma@latest` is now 7.x (7.8.0)** — pinned **6.19.3**: Prisma 7's `@prisma/dev`
  pulls a vulnerable `@hono/node-server` (3 moderate advisories; `npm audit fix` *downgrades to 6*),
  and 7's new mandatory-output/ESM generator is churn a trivial skeleton doesn't need.
- `[insight]` **Token-gate the health route as cost control, not authzn.** Rejecting before the DB
  read means an anonymous flood costs ~nothing — no billed Vercel invocation work, no warm Neon
  compute (which would defeat scale-to-zero). An auth wall wouldn't help and isn't available pre-auth.
- `[note]` **Connecting an *existing* standalone Neon project to Vercel is done from the Neon side**
  (Neon → Integrations → Vercel). Vercel's Storage → "Create" only provisions a *new, Vercel-managed*
  DB — keeping the project standalone preserves the §12 portability / GCP escape hatch.
- `[note]` **`deployment_status` workflows fire from the *deployed ref's* workflow file, not only
  `main`.** The smoke Action ran on this PR's previews *before* merge (pre-bypass runs failed
  correctly on the SSO wall, then went green) — no chicken-and-egg, contrary to my initial assumption.

**Process learnings:**
- `[insight]` **Split operator-driven vs in-repo phases in the execution spec.** Phases A–B (Neon
  project, integration, env vars/secrets — all dashboard work) gated Phase C (code). Writing them as
  separate checklists with explicit "report back X" handoffs kept the dashboard round-trips crisp.
- `[gotcha]` Background `next start` left port 3000 held; a later `npm start` died `EADDRINUSE` and a
  stale server served an *old* build — a verification read silently showed the pre-change response.
  Kill `lsof -ti:3000` before re-verifying after a rebuild.

## v0.4.1 — Post-launch ops & decisions (2026-06-15 12:29)

**Review:** not yet

No app code shipped — Vercel/Git config + ops docs + decisions on top of the v0.4.0 release
(so no new git tag). Capturing the learnings before they're lost (only committed docs carry forward).

**What was built / decided:**
- **Tagged `v0.4.0`** and refreshed `CLAUDE.md` to "implementation started."
- **Vercel Ignored Build Step** configured to **skip docs-only deploys**; verified live (three
  docs commits each "Canceled by Ignored Build Step"). Recorded in `deployment.md` §2.
- **README status badges** — live up/down for `guasi.tw` + `www.guasi.tw` (shields `website`) + a
  "Deployed on Vercel" link badge.
- **New `docs/operating-costs.md`** — cost ledger (Vercel Pro $20/mo, domain $29.99/yr, free-tier +
  anticipated; ~$270/yr run-rate).
- **New `docs/services.md`** — single inventory of every service/account (Active / Decided / Anticipated).
- **Email architecture decided & recorded** (spec §12, cost ledger, `CLAUDE.md`): send transactional
  mail via **Resend from a `send.guasi.tw` subdomain**; keep **iCloud Custom Email on the root** for
  *receiving* only.

**Key technical learnings:**
- `[gotcha]` **Vercel Hobby can't deploy a private repo owned by a GitHub org** — only
  *personal-account* private repos. That (not "commercial use" in the abstract) is why **Pro
  ($20/mo) is required**; the only free alternatives were *make the repo public* or *move it to a
  personal account*.
- `[gotcha]` **Vercel has no native `[skip ci]`.** Skipping is *only* via the **Ignored Build Step**
  (exit `0` = skip, `≥1` = build). It also **moved** in the UI — now under **Settings → Build and
  Deployment** with a Presets / Repository-Scripts / Custom picker, no longer under Git.
- `[insight]` **For skip rules, deny-list beats allow-list.** "Build *unless* only docs changed"
  (`git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md' ':(exclude)docs'`) auto-covers new
  code/config; the "only build if folder X changed" preset would wrongly skip root changes like
  `package.json` / `next.config.ts`.
- `[note]` The Ignored Build Step posts a **transient `pending`** commit status first, then flips to
  "Canceled by Ignored Build Step" (state `success`) — don't check too early. `HEAD^` is available
  (Vercel clones `--depth=10`).
- `[note]` **No official Vercel deploy-status badge**; community ones read GitHub's deployment API,
  which **can't see a private repo** — so used shields.io **`website` up/down** badges (they ping the
  live URL, independent of repo visibility).
- `[insight]` **Email: receiving ≠ sending.** iCloud Custom Email is a personal *mailbox* (receiving;
  no sending API; ToS bans automated/bulk) — never send app mail through it. Best practice: mailbox
  provider on the **root** (receiving) + ESP on a **subdomain** (sending) to isolate DNS + reputation.
  Don't remove iCloud to "use the domain for the app" — that conflates the two jobs and just loses the inbox.
- `[note]` **Don't nuke the GoDaddy zone** to add a web host — `guasi.tw` already runs iCloud email
  (MX/SPF/DKIM/DMARC/apple-domain); only the apex `A` + `www` CNAME changed for Vercel.

**Process learnings:**
- `[insight]` **Decisions live in docs, learnings live in the devlog.** `services.md` (inventory) +
  `operating-costs.md` (ledger) + spec §12 (rationale) hold the *decisions*; the devlog holds the
  *learnings*. Only committed docs carry to the next session — so record decisions in docs
  immediately, and write up learnings at session end.
- `[note]` **Verify vendor facts, don't recall them.** Several assumptions this session were wrong
  until checked (no `[skip ci]`, the IBS UI moved, no Vercel badge, the org-repo Pro gate) — a quick
  search each time corrected them.

## v0.4.0 — Walking skeleton: scaffold, Vercel CI/CD & guasi.tw live (2026-06-15)

**Review:** not yet

**Design docs:**
- Walking skeleton (scaffold + CI/CD + domain): [Spec](superpowers/specs/2026-06-15-walking-skeleton-design.md)

**What was built:**
- **First code in the repo:** a flat **modular-monolith Next.js scaffold** (Next 16 + React 19 +
  TypeScript, App Router) — `app/` only; `lib/` and `prisma/` deferred until product code lands.
  Considered and rejected a workspaces / Turborepo monorepo (only one deployable today, and
  `prisma/` lives in-repo either way).
- A minimal on-brand **hello-world landing** (`我是正身`, `zh-Hant`); `npm run build` green (static `/`).
- **Vercel CI/CD** wired via the GitHub integration — `push main` → production, PR → preview.
  Project **`guasi-app`**.
- **`guasi.tw` bound** — apex `A → 216.198.79.1` + `www` CNAME at **GoDaddy**, SSL auto-issued,
  `www` 308-redirects to apex.
- New **execution spec** (`2026-06-15-walking-skeleton-design.md`) as a per-session tracker
  (north star: `deployment.md` §5); **README** gained a **Deployment & CI/CD** section;
  `deployment.md` §5 + the `todo.md` hello-world item ticked.

**Key technical learnings:**
- `[gotcha]` **`npm audit fix --force` wanted to downgrade Next 16 → 9.3.3** to clear a
  *transitive* `postcss` advisory (GHSA-qx2v-qp2m-jg93). The right fix for a transitive dep is an
  npm **`overrides`** pin (`postcss: ^8.5.15`) — bumps it without touching Next; `npm audit` → 0.
- `[gotcha]` **Vercel now hands out a *new* IP range.** Apex `A → 216.198.79.1` (not the
  long-documented `76.76.21.21`) and a **project-unique** `www` CNAME
  (`…vercel-dns-017.com`, not the generic `cname.vercel-dns.com`). Use exactly what the Domains
  page shows — the generic values still work but are the old path.
- `[insight]` **Don't nuke the GoDaddy zone to add a web host.** `guasi.tw` already ran **iCloud
  Custom Email Domain** (MX + SPF/DKIM/DMARC + `apple-domain` TXT). Only the apex `A` (a GoDaddy
  WebsiteBuilder record) and the `www` CNAME needed changing; deleting the rest would have killed
  email. Edit the two web records, leave NS/SOA/MX/TXT/DKIM alone.
- `[gotcha]` **`create-next-app` refuses a non-empty dir** — `CLAUDE.md`/`todo.md` trip its
  empty-folder check, so the scaffold was hand-rolled. Also the root `tsconfig` must **exclude the
  gitignored `pitch-deck/`** workspace, or its own deps fail the Next typecheck.
- `[note]` **Bootstrap ordering:** importing a repo makes Vercel immediately deploy `main`, so the
  scaffold had to land on `main` *before* the import — else the first production build has nothing
  to build.
- `[note]` Vercel **auto-named the project `guasi-app`** from `package.json` (not the `guasi-web`
  the convention suggested) — cosmetic/internal; the domain is attached separately.

**Process learnings:**
- `[insight]` **The structure question was worth stopping for.** The user paused the scaffold to
  reconsider monorepo-vs-monolith; laying out three concrete options (folder-tree previews +
  trade-offs) surfaced that the stated "I want a monorepo" actually resolved to the flat monolith
  once "the DB schema is in-repo either way" was made explicit.
- `[note]` **A doc-closeout PR doubles as preview-deploy verification** — opening it makes Vercel
  build a preview, exercising the `PR → preview` half of CI/CD that a straight-to-`main` flow never
  triggers.

## v0.3.0-design — Routing, ID provisioning & platform verification (2026-06-15)

**Review:** not yet

**Design docs:**
- Routing, ID provisioning & squatting: [Spec](superpowers/specs/2026-06-15-routing-and-identity-design.md)
- Platform read-mechanics: [`platform-verification.md`](platform-verification.md) (capability matrix + evidence log; not a specs/plans doc)

**What was built:**
- **New routing-and-identity spec** (`superpowers/specs/2026-06-15-routing-and-identity-design.md`): URL route table + state behavior; the slug-location decision (**decided: `/gua/{id}`**); proof-gated ID-provisioning lifecycle (email → internal uuid → first bind → permanent slug → 308 redirect); abandoned-account cleanup; `is_main` vs permanent-slug overlap; the ID model (**decided: handle-derived, all-3-platforms-as-source, immutable**); and squatting/collision protection via proof-gated claiming + platform-priority + transparency.
- **New `docs/platform-verification.md`** — empirical capability matrix for reading **author** + **code-bearing text** across Threads / IG / miin.cc, for both **post** and **bio** methods. Includes copy-paste read recipes, the URL-handle spoof proof, a Vercel render-weight ladder, the unified verification algorithm, and an evidence log of every URL tested.
- **Corrected the parent spec's naive "public web fetch returns the author"** assumption (it returns a JS app-shell) and slimmed the routing spec's §5 to a pointer at the verification doc.
- **Found miin's public JSON API** (the lightest render path, a pure `fetch()`) and **proved headless render works** as the fallback; **moved miin into MVP** — MVP platforms are now **Threads + IG + miin.cc**. All three are live handle sources at launch (raising the weak-platform-squatting concern to MVP scope).
- Updated `CLAUDE.md` docs index with both new docs.

**Key technical learnings:**
- `[insight]` **Meta serves two different pages by User-Agent.** Threads/IG return a JS app-shell + consent gate to a browser UA, but **server-render full OG/AL meta to a crawler UA** (`facebookexternalhit/1.1`). That crawler-SSR is the tokenless way to get **both** author (`og:title`/`og:url`) and content (`og:description`) — no Meta token needed for MVP.
- `[gotcha]` **Never trust the @handle in a pasted post URL.** Meta serves the same post under *any* path handle (HTTP 200) — I pasted `@zuck` and `@notreal999` for someone else's post and Meta still canonicalized `og:title`/`og:url` to the **true author**. Read the author from the platform's authoritative response only; trusting the path enables an identity-takeover.
- `[gotcha]` **Threads migrated to `threads.com`** — `og:url` returns `threads.com`, not `threads.net`. The canonical-host allowlist must accept both.
- `[gotcha]` **IG profile bio is NOT in OG tags** (the IG profile `og:description` is a fixed follower-count template — confirmed on a 1.6k-post account). So bio-verification on IG needs a token/headless; the **post caption**, by contrast, *is* in `og:description`. Use the post method on IG.
- `[gotcha]` **IG crawler-SSR is occasionally throttled** — one isolated fetch returned no OG tags (which briefly led me to a wrong "IG caption unreadable" conclusion). On retry it's reliable (12/12). Mitigation: **retry once on incomplete SSR**.
- `[insight]` **The lightest way to render a SPA on Vercel is to not render it.** miin is a client-rendered Next.js SPA (no SSR author), but sniffing its network calls revealed a **public, unauthenticated JSON API** (`api.miin.cc/web/story/v3/story?storyId=…`, `…/v2/user/page?userId=…`) returning structured author + full untruncated text + bio. A plain `fetch()` beats both OG-scraping and a headless browser.
- `[note]` **miin API text shape:** short posts carry text in `title[]`, long posts fill `content[]` (415-char body returned in full) — scan both; no truncation (unlike OG `og:description`).
- `[insight]` **Anti-squatting and free-choice naming are in tension.** Proof-gated claiming (slug must equal a handle you proved) delegates KOL protection to the platforms that already authenticated them — but it reintroduces cross-platform handle collisions. Free guasi-native names avoid collisions but reopen squatting. Decision deferred.
- `[note]` **Meta public oEmbed is gone** (`instagram_oembed` needs an app token with `oembed_read`); not required given crawler-SSR works tokenless.
- `[note]` **Vercel headless pattern** = `puppeteer-core` + `@sparticuz/chromium` (the full `puppeteer` Chromium is too big for Lambda), ≥1024 MB function, raised/background timeout — heavy and async; fallback only.

**Process learnings:**
- `[insight]` **Empirical testing flipped my conclusions twice** — "IG caption unreadable" → readable-but-throttled, and "miin needs headless" → public JSON API. Verify platform behavior with real fetches against real URLs; reasoning from memory about how Meta/SPAs *should* behave was wrong both times.
- `[insight]` **Splitting an overgrown spec into a focused companion + a dedicated reference doc** kept each concern legible; the routing spec now points at the verification doc instead of duplicating (and drifting from) its mechanics.

## v0.2.0-design — Verification security model & Vercel stack lock-in (2026-06-15 00:29)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- **Verification security model locked** (§6.2/§6.3/§8): the **bound 分身 is the proof post's author**, resolved from platform authority (oEmbed/API or strictly-validated canonical URL) — never user-supplied page content. The **auth code is scoped to one binding request, single-use, and expiring**. Replaced the `auth_codes` table with **`binding_requests`**; narrowed `linked_accounts.status` to `verified | unbound`.
- **Author-match target clarified**: it's the *specific 分身*, never the 正身 identity name or the `@gua.si.tw` tag; **many 分身 per platform** allowed, each its own binding request. Added a "three distinct handles" note to the spec.
- **Manual paste-back set as the MVP primary path** (synchronous, more responsive); tag-based mention auto-capture deferred to Phase 2. Added new threat rows (copy-paste/stolen-code abuse, spoofed post page) + an author-integrity requirement (§6.3).
- **MVP stack locked — all on Vercel** (§12): Next.js + TypeScript; **Neon** serverless Postgres via Prisma; **Auth.js** with **Google OAuth + email magic-link/OTP** (Prisma adapter, verified-email account linking); **Vercel Blob** for snapshots + avatars; async screenshot/archive via a serverless queue calling an **external screenshot API**. GCP kept as a portable escape hatch.
- Updated `CLAUDE.md` (locked decisions + Vercel stack), `todo.md` (hosting + security checked off; auto-capture → Phase 2 section; **added hello-world landing page on Vercel bound to `guasi.tw`** as the first implementation step).
- Made the three `guasi.tw` mentions in the (local, gitignored) pitch deck clickable to `https://guasi.tw`.

**Key technical learnings:**
- `[insight]` **The copy-paste-to-my-wall attack is defeated by two independent gates, not by code secrecy.** (1) The bound account *is* the post author resolved from the platform — you can't make an account you don't control author a post. (2) The code is scoped + single-use + expiring, so a copied post carries someone else's code, useless in any other session.
- `[gotcha]` **Resolve the post author from the platform's authority, never from the pasted page.** If you read the author from user-supplied page content, an attacker pastes a URL to a page *they* control that mimics any author — defeating the whole author-match gate. Accept only canonical platform URLs → oEmbed/API.
- `[insight]` **Manual paste-back is *more* responsive than the "premium" auto-detect.** A mention webhook is lossy + laggy (a poller adds poll-cycle latency) and needs a business account + app review + a live Meta token. Pasting the URL verifies synchronously in seconds and removes the platform dependency. The fancier option was strictly worse here.
- `[insight]` **Don't size hosting on read QPS.** "1000 QPS public querying" is cache-dominated: with cache-on-write (`revalidateTag`) the origin sees near-zero. The real cost sink is the per-verification **snapshot pipeline** (headless browser / screenshot), not reads.
- `[gotcha]` **Serverless + Postgres needs connection pooling.** With Prisma on Vercel: pooled connection string for queries, **direct** URL for migrations — skip it and concurrent functions exhaust the connection limit.
- `[insight]` **Three distinct handles must not be conflated**: `@gua.si.tw` (service tag, not a check), the 正身 identity name (site profile, not a check), and the 分身 handle (the only one the author-match uses).
- `[note]` **Site-login OAuth ≠ identity-verification OAuth.** Google login for `guasi.tw` doesn't touch the §6.1 "no platform OAuth for identity" rule — different OAuth, different purpose, no Meta gatekeeping.
- `[note]` Vercel's on-demand ISR / `revalidateTag` natively implements the "cache public pages, expire from the management side" pattern.
- `[note]` **Lucia was deprecated as a library in 2025** (now a learning resource) — use **Auth.js (NextAuth v5)** instead.

**Process learnings:**
- `[insight]` **Pressure-test stated scale numbers before pricing anything.** The "1000 QPS / 100 QPS" figures were guesses; deriving the realistic load profile (cache-dominated reads, bursty writes, snapshot-bound compute) changed the hosting answer by orders of magnitude and avoided over-engineering.

## v0.1.1-design — Snapshot, ledger, status & naming (2026-06-14 23:11)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- Folded a trusted reviewer's notes ([`first_thought.md`](first_thought.md)'s sibling [`random_thoughts.md`](random_thoughts.md)) and several new decisions into the spec.
- **Proof snapshot at verification time** (§6.4) — capture content + screenshot + third-party archive, so a proof survives the account/post being banned.
- **Append-only public ledger** (§6.6), **unbinding** with reasons (§6.5), **verification timeline** (§6.7).
- **Account status management** (§6.8) — owner marks banned/hacked (self-service) vs unbanned/reclaimed (re-verify).
- **正身 profile** (§4) — avatar, brief description, and a designated **main 分身** (an `is_main` flag on a bound account, not a free-form URL; defaults to the first verified 分身, changeable on 分身管理). Public 驗明正身 page = a Linktree-like profile for a *verified* identity.
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
