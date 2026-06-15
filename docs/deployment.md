# Deployment, CI/CD & Repo Conventions

**Status:** decisions / planning (2026-06-15). **GitHub org [`guasi-tw`](https://github.com/guasi-tw) created**; repo + Vercel + Neon still pending — see the §5 scaffold checklist for current state. Stack is locked in the parent spec §12 (Next.js + TypeScript on Vercel · Neon Postgres via Prisma · Auth.js · Vercel Blob).

> **Legend:** **[DECIDED]** · **[REC]** recommendation, final call is the operator's · **[OPEN]** TBD.

---

## 1. Deployment model — one app, two managed services **[DECIDED]**

**You deploy exactly one thing: the Next.js app, to Vercel.** Neon and Vercel Blob are **managed services you provision**, not deployments shipped from the repo.

| Thing | How it "deploys" | In the repo? |
|---|---|---|
| **Next.js app** (UI + API routes + server actions + cron/background fns) | Vercel, on `git push` | ✅ the only deployable |
| **Neon** (serverless Postgres) | provisioned in Neon / via Vercel's Neon integration → connection string in env vars | ❌ only the **Prisma schema + migrations** live in the repo |
| **Vercel Blob** (snapshots + avatars) | created in Vercel dashboard → token in env vars | ❌ |

**There is no separate "deployment" for the DB or blob storage** — they're external services connected by env vars. The *only* repo→DB action is **running migrations** (`prisma migrate deploy`), wired into the pipeline (§2).

`[gotcha]` Prisma on serverless: **pooled** Neon connection string for queries, **direct** (non-pooled) URL for migrations. Mixing them up exhausts connections or breaks migrations.

---

## 2. CI/CD **[DECIDED]**

**Vercel's GitHub integration *is* the CD** — no GitHub Actions needed for deploying:
- **Push to `main` → production deploy.**
- **PR / branch push → preview deployment** (own URL).
- **Migrations:** run `prisma migrate deploy` as a release step (build command for MVP; promote to a dedicated step later so concurrent builds don't race). Use the **direct** Neon URL.
- **GitHub Actions:** add later, only for what Vercel doesn't do — tests / typecheck / lint on PRs once a test suite exists. (Vercel's build already typechecks the Next build.)

**Env vars** (set per environment — production / preview / development in Vercel): Neon pooled + direct URLs, Auth.js secret + Google OAuth creds, Vercel Blob token, external screenshot-API key. Vercel's Neon/Blob integrations can auto-inject several of these.

`[gotcha]` **Preview deploys hit prod DB by default.** Use **Neon database branching** so each preview gets a branched DB — wire this early or previews mutate production data.

---

## 3. Repo structure — modular monolith now, Turborepo later **[DECIDED]**

**MVP = a modular monolith: one Next.js app, one Vercel project, one repo**, with clean internal module boundaries. Do **not** split deployments yet — Next.js already co-deploys UI, API, and cron/background functions as one project.

```
guasi-app/
  app/                  # Next.js routes (UI + API)
  lib/
    adapters/           # PlatformAdapter: threads / instagram / miin  ← pluggable seam
    verification/       # author-match + auth-code core (platform-agnostic)
    db/                 # Prisma client + repositories
    storage/            # Blob wrapper
  prisma/               # schema + migrations
```

**Escape hatch — when a second deployable is genuinely needed** (a heavy always-on worker, or a separate marketing site): adopt **Turborepo** (Vercel-native, so it's the standard for Vercel monorepos):

```
guasi-app/
  apps/
    web/                # Next.js app          → Vercel project A
    worker/             # heavy screenshot/archive jobs → Vercel project B (or other host)
  packages/
    core/  db/  adapters/   # shared internal packages
```

Vercel deploys **multiple projects from one monorepo** by pointing each project at a different **Root Directory** (`apps/web`, `apps/worker`) — that's "separate deployments, one mono-repo, shared code." **Trigger to split:** a job that needs its own memory/timeout profile or that shouldn't share the web function's resources (e.g. the miin/IG **headless-render fallback** — `@sparticuz/chromium`, ≥1 GB, long timeout; see platform-verification.md §5). Until then, a heavy function can stay in the monolith with **per-function config in `vercel.json`**.

**Why not start with the monorepo:** don't pay the Turborepo tax before a second deployable exists. Keep `lib/*` boundaries clean so promoting them to `packages/*` later is a mechanical refactor, not a rewrite.

---

## 4. Repo & naming conventions **[DECIDED — org created]**

**GitHub org: [`guasi-tw`](https://github.com/guasi-tw)** ✅ created. The bare `guasi` user/org namespace was already taken (org and user names share one global namespace), so the org is `guasi-tw`. This is **dev-facing only** and does not affect the public brand (`guasi.tw`, `@gua.si.tw`, pitch decks).

> An **org is a container for repos**, not an alternative to one — the org reserves the `github.com/guasi-tw` namespace; the **code repos inside stay private**.

**Convention — brand reserved at the *namespace* level, repos/packages named by *function*:**

| Layer | Decision | Why |
|---|---|---|
| **GitHub org** | **`guasi-tw`** — created (`github.com/guasi-tw`) | reserves the namespace, future-proofs collaborators, separates from personal account; GitHub Free orgs = unlimited private repos + collaborators |
| **Repo name** | **`guasi-tw/app`** for the product monorepo (private); `guasi-tw/site` for the public marketing site later (can be public) | the brand is implied by the org — **not `guasi-web`** (stutter). `app` names the *container*, so it survives a Turborepo split where `web` becomes the inner `apps/web` (§3); `web` alone would be too narrow |
| **npm scope** (Turborepo pkgs) | **`@guasi/*`** — `@guasi/core`, `@guasi/db`, `@guasi/adapters` | internal/unpublished, so the clean scope is fine even though the GH org is `guasi-tw`; verify on npm only if you ever publish |
| **Vercel project** | **`guasi-web`** (internal name; Vercel team may be `guasi-tw`) | the production domain `guasi.tw` is attached separately, so the project name is internal-only |
| **Brand** (`guasi` / 正身, `guasi.tw`, `@gua.si.tw`) | unchanged — public domain, social, pitch | naming repos/orgs doesn't touch any of this |

**Next:** create the private repo **`guasi-tw/app`**, add it as the remote to this local repo, push `main`, then import it into Vercel (install the Vercel GitHub app on the `guasi-tw` org).

---

## 5. First milestone — minimal end-to-end scaffold

The "walking skeleton" that proves the whole pipeline before any feature work (aligns with the todo: *hello-world landing page on Vercel bound to `guasi.tw`*). **Current status:**

- [x] **GitHub org `guasi-tw` created** (`github.com/guasi-tw`).
- [ ] Private repo **`guasi-tw/app`** created → add as remote to this local repo → push `main`.
- [ ] Next.js hello-world → Vercel project (`guasi-web`), **production domain `guasi.tw`** attached.
- [ ] Neon DB provisioned; **one trivial Prisma model + migration** via `prisma migrate deploy` (direct URL) in the pipeline.
- [ ] **Preview deploy** (branch) + **prod deploy** (main) both verified, with **Neon branching** for the preview DB.
- [ ] (Optional) `/api/health` route hitting the DB — proves app→Neon end-to-end.

Outcome: CI/CD, migrations, env-var wiring, and domain binding all verified on an empty app — so the first real feature deploys with zero infra unknowns.

---

## 6. Open / TBD

- [ ] **Vercel plan:** Hobby is non-commercial → move to **Pro** before commercial launch (not blocking the scaffold).
- [ ] **Async-job mechanism** for the screenshot/archive pipeline (Vercel Cron vs Vercel Queue vs external queue) — decide when building §6.4 snapshots.
- [ ] **External screenshot-API vendor** (Urlbox / ScreenshotOne / Browserless) — parent spec §12.
- [ ] **Migration step placement** — build command (MVP) vs dedicated release job (scale).
- [x] **GitHub namespace** — org **`guasi-tw`** created (bare `guasi` was taken).

## Cross-references
- Parent spec §12 (locked stack) · `platform-verification.md` §5 (headless-render weight, the candidate for a separate deployable) · `todo.md` (hello-world first step).
