# Deployment, CI/CD & Repo Conventions

**Status:** infra shipped, in active feature development. The scaffold, Vercel CI/CD with [`guasi.tw`](https://guasi.tw) live (SSL), Neon + Prisma migrations, and Google login are all in place; current state lives in [`devlog.md`](devlog.md) (TL;DR table) and [`../todo.md`](../todo.md). This doc is the north-star infra plan; the stack is locked (Next.js + TypeScript on Vercel · Neon Postgres via Prisma · Auth.js · Vercel Blob).

> **Legend:** **[DECIDED]** · **[REC]** recommendation, final call is the operator's · **[OPEN]** TBD.

---

## 1. Deployment model — one app, two managed services **[DECIDED]**

**You deploy exactly one thing: the Next.js app, to Vercel.** Neon and Vercel Blob are **managed services you provision**, not deployments shipped from the repo.

| Thing | How it "deploys" | In the repo? |
|---|---|---|
| **Next.js app** (UI + API routes + server actions + cron/background fns) | Vercel, on `git push` | ✅ the only deployable |
| **Neon** (serverless Postgres) | provisioned in Neon / via Vercel's Neon integration → connection string in env vars | ❌ only the **Prisma schema + migrations** live in the repo |
| **Vercel Blob** (avatars) | created in Vercel dashboard → token in env vars | ❌ |

**There is no separate "deployment" for the DB or blob storage** — they're external services connected by env vars. The *only* repo→DB action is **running migrations** (`prisma migrate deploy`), wired into the pipeline (§2).

`[gotcha]` Prisma on serverless: **pooled** Neon connection string for queries, **direct** (non-pooled) URL for migrations. Mixing them up exhausts connections or breaks migrations.

### Locked stack (MVP) — all on Vercel

The full MVP stack (this is the canonical list; CLAUDE.md carries only the one-liner):

- **App:** Next.js + TypeScript on **Vercel**.
- **DB:** **Neon** (serverless Postgres) via **Prisma** — pooled URL for queries, direct URL for migrations (above).
- **Auth:** **Auth.js** with the Prisma adapter — **Google OAuth** for MVP; email magic-link/OTP is **deferred** (design in [`email-login-design.md`](email-login-design.md)).
- **Transactional email:** **Resend**, sending from a **`send.guasi.tw`** subdomain. The root **`guasi.tw`** zone runs **iCloud Custom Email for *receiving* only** — a separate job, never used to send. (Don't touch the iCloud MX/SPF/DKIM/DMARC records when changing web hosting.) Service inventory in [`services.md`](services.md).
- **Images** (avatars): **Vercel Blob** / R2.
- **Escape hatch:** **GCP** (Cloud Run + Cloud SQL) remains a portable future fallback — not used for MVP.

---

## 2. CI/CD **[DECIDED]**

**Vercel's GitHub integration *is* the CD** — no GitHub Actions needed for deploying:
- **Push to `main` → production deploy.**
- **PR / branch push → preview deployment** (own URL).
- **Migrations:** run `prisma migrate deploy` as a release step (build command for MVP; promote to a dedicated step later so concurrent builds don't race). Use the **direct** Neon URL.
- **GitHub Actions:** add later, only for what Vercel doesn't do — tests / typecheck / lint on PRs once a test suite exists. (Vercel's build already typechecks the Next build.)
- **Skip docs-only redeploys [DECIDED 2026-06-15 · REVERTED 2026-06-16]:** Briefly used Vercel's **Ignored Build Step** (Settings → Git, *dashboard-only* — no `vercel.json` equivalent), set to
  ```
  git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md' ':(exclude)docs'
  ```
  so a commit touching only `*.md` / `docs/` wouldn't burn a production deploy (exit **0 skips**, **≥1 builds**; Vercel's `git clone --depth=10` makes `HEAD^` available). **Reverted 2026-06-16** — the Ignored Build Step field is cleared, so **every push to a tracked branch builds again** (docs-only commits included), each getting a real deploy + the post-deploy smoke test. If reintroduced later, mind the original caveat: it keys off file type, so revisit if markdown ever becomes a build input (e.g. MDX rendered by the app).

**Env vars** (set per environment — production / preview / development in Vercel): Neon pooled + direct URLs, Auth.js secret + Google OAuth creds, Vercel Blob token. Vercel's Neon/Blob integrations can auto-inject several of these.

`[gotcha]` **Preview deploys hit prod DB by default.** Use **Neon database branching** so each preview gets a branched DB — wire this early or previews mutate production data.

---

## 3. Repo structure — modular monolith now, Turborepo later **[DECIDED]**

**MVP = a modular monolith: one Next.js app, one Vercel project, one repo**, with clean internal module boundaries. Do **not** split deployments yet — Next.js already co-deploys UI, API, and cron/background functions as one project.

```
guasi-app/
  app/                  # Next.js routes (UI + API)
  lib/
    auth/               # Auth.js (Google): providers, callbacks, Prisma adapter
    binding/            # verification + binding core (auth-code, templates, repo)
      platforms/        # PlatformAdapter: threads / instagram / miin  ← pluggable seam
    identity/           # 正身 profile, session, slug/shortRef, avatar (Blob wrapper)
    db/                 # Prisma client
  prisma/               # schema + migrations
```

**Escape hatch — when a second deployable is genuinely needed** (a heavy always-on worker, or a separate marketing site): adopt **Turborepo** (Vercel-native, so it's the standard for Vercel monorepos):

```
guasi-app/
  apps/
    web/                # Next.js app          → Vercel project A
    worker/             # heavy headless-render fallback → Vercel project B (or other host)
  packages/
    core/  db/  adapters/   # shared internal packages
```

Vercel deploys **multiple projects from one monorepo** by pointing each project at a different **Root Directory** (`apps/web`, `apps/worker`) — that's "separate deployments, one mono-repo, shared code." **Trigger to split:** a job that needs its own memory/timeout profile or that shouldn't share the web function's resources (e.g. the miin/IG **headless-render fallback** — `@sparticuz/chromium`, ≥1 GB, long timeout; see platform-verification.md §5). Until then, a heavy function can stay in the monolith with **per-function config in `vercel.json`**.

**Why not start with the monorepo:** don't pay the Turborepo tax before a second deployable exists. Keep `lib/*` boundaries clean so promoting them to `packages/*` later is a mechanical refactor, not a rewrite.

---

## 4. Repo & naming conventions **[DECIDED — org created]**

**GitHub org: [`guasi-tw`](https://github.com/guasi-tw)** ✅ created. The bare `guasi` user/org namespace was already taken (org and user names share one global namespace), so the org is `guasi-tw`. This is **dev-facing only** and does not affect the public brand (`guasi.tw`, `@gua.si.tw`, pitch decks).

> An **org is a container for repos**, not an alternative to one — the org reserves the `github.com/guasi-tw` namespace. (`guasi-tw/app` is **public** as of 2026-06-19; future repos can be public or private per their nature.)

**Convention — brand reserved at the *namespace* level, repos/packages named by *function*:**

| Layer | Decision | Why |
|---|---|---|
| **GitHub org** | **`guasi-tw`** — created (`github.com/guasi-tw`) | reserves the namespace, future-proofs collaborators, separates from personal account; GitHub Free orgs = unlimited private repos + collaborators |
| **Repo name** | **`guasi-tw/app`** for the product monorepo (**public** since 2026-06-19); `guasi-tw/site` for a separate marketing site later | the brand is implied by the org — **not `guasi-web`** (stutter). `app` names the *container*, so it survives a Turborepo split where `web` becomes the inner `apps/web` (§3); `web` alone would be too narrow |
| **npm scope** (Turborepo pkgs) | **`@guasi/*`** — `@guasi/core`, `@guasi/db`, `@guasi/adapters` | internal/unpublished, so the clean scope is fine even though the GH org is `guasi-tw`; verify on npm only if you ever publish |
| **Vercel project** | **`guasi-app`** (auto-derived from `package.json`; internal name) | the production domain `guasi.tw` is attached separately, so the project name is internal-only. (`guasi-web` was the earlier suggestion; Vercel named it `guasi-app` from the package name on import.) |
| **Brand** (`guasi` / 正身, `guasi.tw`, `@gua.si.tw`) | unchanged — public domain, social, pitch | naming repos/orgs doesn't touch any of this |

**Done:** the repo **`guasi-tw/app`** was created, wired as the remote, `main` pushed, and imported into Vercel (Vercel GitHub app installed on the `guasi-tw` org). The repo is **public** as of 2026-06-19.

---

## 5. First milestone — minimal end-to-end scaffold

The "walking skeleton" that proves the whole pipeline before any feature work (aligns with the todo: *hello-world landing page on Vercel bound to `guasi.tw`*). **Current status:**

- [x] **GitHub org `guasi-tw` created** (`github.com/guasi-tw`).
- [x] Repo **`guasi-tw/app`** created → remote added → `main` pushed. (**Public** since 2026-06-19.)
- [x] **Next.js hello-world scaffolded** (flat monolith, Next 16; build green) — see [`superpowers/specs/2026-06-15-walking-skeleton-design.md`](superpowers/specs/2026-06-15-walking-skeleton-design.md).
- [x] Imported to Vercel project (`guasi-app`); **production domain `guasi.tw`** attached, SSL issued, `www` 308-redirects to apex. `push main → prod` + `PR → preview` verified.
- [x] Neon DB provisioned; **one trivial Prisma model + migration** via `prisma migrate deploy` (direct URL) in the pipeline. *(v0.5.0 — `HealthCheck` model; see [`superpowers/specs/2026-06-15-db-skeleton-design.md`](superpowers/specs/2026-06-15-db-skeleton-design.md).)*
- [x] **Preview deploy** (branch) + **prod deploy** (main) both verified, with **Neon branching** for the preview DB (auto per-preview branch via the Neon–Vercel integration).
- [x] `/api/health` route hitting the DB — proves app→Neon end-to-end (token-gated; prod smoke 4/4).

Outcome: CI/CD, migrations, env-var wiring, and domain binding all verified on an empty app — so the first real feature deploys with zero infra unknowns.

---

## 6. Open / TBD

- [x] **Vercel plan:** on **Hobby (free)** since 2026-06-19. Was briefly on **Pro** ($20/mo trial from 2026-06-15) because Hobby can't deploy a **private repo owned by a GitHub org**; resolved by **making `guasi-tw/app` public**, which Hobby deploys at no cost. Costs in [`operating-costs.md`](operating-costs.md).
- [ ] **Migration step placement** — build command (MVP) vs dedicated release job (scale).
- [x] **GitHub namespace** — org **`guasi-tw`** created (bare `guasi` was taken).

## Cross-references
- Parent spec §12 (locked stack) · `platform-verification.md` §5 (headless-render weight, the candidate for a separate deployable) · `todo.md` (hello-world first step).
