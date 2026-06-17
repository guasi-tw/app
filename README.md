# 我是 (guasi) · 正身

[![guasi.tw](https://img.shields.io/website?url=https%3A%2F%2Fguasi.tw&up_message=up&up_color=brightgreen&down_message=down&down_color=red&label=guasi.tw)](https://guasi.tw)
[![www.guasi.tw](https://img.shields.io/website?url=https%3A%2F%2Fwww.guasi.tw&up_message=up&up_color=brightgreen&down_message=down&down_color=red&label=www.guasi.tw)](https://www.guasi.tw)
[![Deployed on Vercel](https://img.shields.io/badge/deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com/sans-word-s-projects/guasi-app)

<sup>Site badges ping the live URLs (up/down). Vercel has no official deploy-status badge, and the GitHub-deployment ones can't read this **private** repo — so build/deploy status lives in the [Vercel dashboard](https://vercel.com/sans-word-s-projects/guasi-app).</sup>

An identity-backup / alter-account verification service. Lets a person **proactively
verify and cross-link the social accounts they own**, so that when one account is banned,
their surviving verified accounts can vouch for a new one — and anyone can publicly
**驗明正身**: look up which accounts are the same person.

> Tagline: **我是正身.** · Domain: `guasi.tw` · Handle: `@gua.si.tw`

Status: **implementation underway.** Google login, 正身 onboarding, account binding (Threads), the
public Identity Card, and the `/about` page are live. Current state → [`docs/devlog.md`](docs/devlog.md)
(top of the TL;DR table); what's next → [`todo.md`](todo.md).

## Docs

- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview (Traditional Chinese).
- [`docs/product-decisions.md`](docs/product-decisions.md) — current product/identity decisions (slug provisioning, anti-squatting, binding uniqueness, routing).
- [`docs/routes.md`](docs/routes.md) — inventory of every route (URL, auth, chrome, purpose).
- [`docs/platform-verification.md`](docs/platform-verification.md) — how author + code text are read on Threads / IG / miin.cc.
- [`docs/deployment.md`](docs/deployment.md) — deployment model, CI/CD & repo conventions.
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings (newest first).
- [`CLAUDE.md`](CLAUDE.md) — project context and locked decisions.
- [`todo.md`](todo.md) — working list of next steps.

> `docs/superpowers/specs/*` and `docs/superpowers/plans/*` are historical design notes from each
> milestone — kept for the record, **not** maintained as the source of truth.

## Local development

```bash
npm install                # also runs `prisma generate` (postinstall)
cp .env.example .env       # then fill in — point DATABASE_URL* at the Neon `vercel-dev` branch
npm run dev                # dev server → http://localhost:3000
npm run build              # `prisma migrate deploy && next build` (same build Vercel runs)
npm start                  # serve the production build locally
```

App code is a flat Next.js monolith: `app/` (routes + API), `lib/db/` (Prisma client),
`prisma/` (schema + migrations) — see [`docs/deployment.md`](docs/deployment.md) §3.

**Database (Neon + Prisma).** Two connection strings — `DATABASE_URL` (pooled, runtime
queries) and `DATABASE_URL_UNPOOLED` (direct, migrations); see [`.env.example`](.env.example).
Locally, point them at the Neon **`vercel-dev` branch** so work never touches prod. `npm run build`
runs `prisma migrate deploy`, so it needs `DATABASE_URL_UNPOOLED` set.

**Health check.** `GET /api/health` is **token-gated** — send `x-health-token: $HEALTH_CHECK_SECRET`;
it returns `{status:"ok",db:"up",rows:N}` (200) after a real DB read (`rows` = `HealthCheck` count,
which differs per Neon branch), or 401 without the token.

## Deployment & CI/CD

This repo deploys as **one Next.js app to [Vercel](https://vercel.com)**. There is no
separate CI service for deploys — **Vercel's GitHub integration *is* the pipeline**:

| You do this | Vercel does this |
|---|---|
| **Push / merge to `main`** | **Production** deploy → https://guasi.tw |
| **Open or push a PR / branch** | **Preview** deploy with its own URL (posted on the PR) |

So **to ship, merge to `main`**; **to get a preview, open a PR**. No manual deploy command.
Because `npm run build` runs the exact build Vercel runs, build and typecheck errors surface
locally before you push.

**Migrations run in the build.** The build command is `prisma migrate deploy && next build`,
so every deploy applies pending migrations (using the direct URL) before building. Each **preview**
deploy runs against its **own Neon branch** (auto-created by the Neon–Vercel integration), so
previews never mutate production data.

**Post-deploy smoke test (first GitHub Action).** [`.github/workflows/smoke.yml`](.github/workflows/smoke.yml)
runs [`scripts/smoke.mjs`](scripts/smoke.mjs) on every Vercel deploy (`deployment_status`): it pokes
`/api/health` (200 with token, 401 without) and — for production — `guasi.tw` + `www.guasi.tw` (200).
A red check signals a broken deploy; on PRs it gates the preview before merge.

**One-time setup (operator).** The `guasi-tw/app` repo is imported into the Vercel project
**`guasi-app`** with the Vercel GitHub app installed on the `guasi-tw` org; production domain
`guasi.tw` is attached to that project. Done once — afterwards the git flow above is all that's
needed.

**Environment variables** are set per environment (production / preview / development) in the
Vercel dashboard: `DATABASE_URL` + `DATABASE_URL_UNPOOLED` (injected by the Neon integration) and
`HEALTH_CHECK_SECRET` (gates `/api/health`; also a GitHub Actions secret for the smoke test). Auth
/ storage vars arrive with later milestones (`deployment.md` §2).

**Manual deploy (optional, rarely needed):** `npx vercel` for a one-off preview, `npx vercel --prod`
to push production — but the git flow above is the norm.

## Viewing the pitch deck

The slide deck lives in `pitch-deck/` (an [open-slide](https://github.com/1weiho/open-slide)
workspace). It is **local-only / not version-controlled** (gitignored).

```bash
cd pitch-deck
npm install      # first time only
npm run dev
```

Then open <http://localhost:5173/>, click **「我是 guasi — 產品概念」**, and press **`F`**
for fullscreen present mode (`→`/`←` to navigate). Stop the server with `Ctrl + C`.

To export a shareable static build instead: `npm run build` (from `pitch-deck/`).
