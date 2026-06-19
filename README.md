# 我是 (guasi) · 正身

[![guasi.tw](https://img.shields.io/website?url=https%3A%2F%2Fguasi.tw&up_message=up&up_color=brightgreen&down_message=down&down_color=red&label=guasi.tw)](https://guasi.tw)
[![www.guasi.tw](https://img.shields.io/website?url=https%3A%2F%2Fwww.guasi.tw&up_message=up&up_color=brightgreen&down_message=down&down_color=red&label=www.guasi.tw)](https://www.guasi.tw)
[![Deployed on Vercel](https://img.shields.io/badge/deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com/sans-word-s-projects/guasi-app)

<sup>Site badges ping the live URLs (up/down). Vercel has no official deploy-status badge, so build/deploy status lives in the [Vercel dashboard](https://vercel.com/sans-word-s-projects/guasi-app).</sup>

An identity-backup / alter-account verification service. Lets a person **proactively
verify and cross-link the social accounts they own**, so that when one account is banned,
their surviving verified accounts can vouch for a new one — and anyone can publicly
**驗明正身**: look up which accounts are the same person.

> Tagline: **我是正身.** · Domain: `guasi.tw` · Handle: `@gua.si.tw`

Status: **implementation underway.** Google login, 正身 onboarding, account binding (Threads), the
public Identity Card, and the `/about` page are live. Current state → [`docs/devlog.md`](docs/devlog.md)
(top of the TL;DR table); what's next → [`todo.md`](todo.md).

## Documentation

This README is the **front door**. The authoritative project context, decisions, and conventions
live in the docs below — treat **those** as the source of truth, not this page.

- [`CLAUDE.md`](CLAUDE.md) — **start here.** Project context, locked decisions, conventions, and the
  full doc index with one-line descriptions.
- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview, by actor (繁中).
- [`docs/product-decisions.md`](docs/product-decisions.md) — single source of truth for product/identity
  decisions (slug provisioning, anti-squatting, binding uniqueness, trust & proof, lifecycle).
- [`docs/brand-and-voice.md`](docs/brand-and-voice.md) — naming, language (zh-Hant / Taiwan), voice.
- [`docs/routes.md`](docs/routes.md) · [`docs/components.md`](docs/components.md) — route & component inventories.
- [`docs/platform-verification.md`](docs/platform-verification.md) — how author + code text are read on Threads / IG / miin.cc.
- [`docs/deployment.md`](docs/deployment.md) — deployment model, CI/CD & repo conventions.
- [`docs/services.md`](docs/services.md) · [`docs/operating-costs.md`](docs/operating-costs.md) — external-service inventory & cost ledger.
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings (newest first).

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

App code is a flat Next.js monolith: `app/` (routes + API), `lib/` (auth, binding, identity, db),
`prisma/` (schema + migrations) — see [`docs/deployment.md`](docs/deployment.md) §3.

**Database (Neon + Prisma).** Two connection strings — `DATABASE_URL` (pooled, runtime queries) and
`DATABASE_URL_UNPOOLED` (direct, migrations); see [`.env.example`](.env.example). Locally, point them
at the Neon **`vercel-dev` branch** so work never touches prod. `npm run build` runs
`prisma migrate deploy`, so it needs `DATABASE_URL_UNPOOLED` set.

**Health check.** `GET /api/health` is **token-gated** — send `x-health-token: $HEALTH_CHECK_SECRET`;
it returns `{status:"ok",db:"up",rows:N}` (200) after a real DB read, or 401 without the token.

## Deployment

One Next.js app deployed to **[Vercel](https://vercel.com)** (Hobby) — **Vercel's GitHub integration
*is* the pipeline**: **push / merge to `main` → production** (https://guasi.tw), **open a PR → preview
deploy**. No manual deploy step. The build command (`prisma migrate deploy && next build`) applies
migrations before building, and each preview deploy runs against its own Neon branch. A post-deploy
smoke test ([`scripts/smoke.mjs`](scripts/smoke.mjs)) gates every deploy via a GitHub Action.

**Full model — env vars, Neon branching, repo conventions, one-time operator setup — lives in
[`docs/deployment.md`](docs/deployment.md).**

## Viewing the pitch deck

The slide deck lives in `pitch-deck/` (an [open-slide](https://github.com/1weiho/open-slide)
workspace), **local-only / gitignored**:

```bash
cd pitch-deck && npm install   # first time only
npm run dev                     # → http://localhost:5173/ — open「我是 guasi — 產品概念」, press F to present
```
