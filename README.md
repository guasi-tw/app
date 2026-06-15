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

Status: **early scaffold** — a Next.js walking skeleton (the hello-world landing page);
product features not yet implemented. See the docs below.

## Docs

- [`docs/product-pitch.md`](docs/product-pitch.md) — non-technical product overview (Traditional Chinese).
- [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](docs/superpowers/specs/2026-06-14-identity-backup-design.md) — full product + architecture spec (source of truth).
- [`docs/deployment.md`](docs/deployment.md) — deployment model, CI/CD & repo conventions (the principle this scaffold executes).
- [`docs/superpowers/specs/2026-06-15-walking-skeleton-design.md`](docs/superpowers/specs/2026-06-15-walking-skeleton-design.md) — the current milestone: scaffold + Vercel CI/CD + domain.
- [`docs/devlog.md`](docs/devlog.md) — running log of decisions and learnings.
- [`CLAUDE.md`](CLAUDE.md) — project context and locked decisions.
- [`todo.md`](todo.md) — working list of next steps.

## Local development

```bash
npm install
npm run dev      # dev server → http://localhost:3000
npm run build    # production build (same build Vercel runs — typecheck included)
npm start        # serve the production build locally
```

App code is a flat Next.js monolith: `app/` (routes), with `lib/` and `prisma/` arriving
as product code lands (see [`docs/deployment.md`](docs/deployment.md) §3).

## Deployment & CI/CD

This repo deploys as **one Next.js app to [Vercel](https://vercel.com)**. There is no
separate CI service for deploys — **Vercel's GitHub integration *is* the pipeline**:

| You do this | Vercel does this |
|---|---|
| **Push / merge to `main`** | **Production** deploy → https://guasi.tw |
| **Open or push a PR / branch** | **Preview** deploy with its own URL (posted on the PR) |

So **to ship, merge to `main`**; **to get a preview, open a PR**. No manual deploy command,
no GitHub Actions for deployment (those get added later only for tests/lint on PRs —
`deployment.md` §2). Because `npm run build` runs the exact build Vercel runs, build and
typecheck errors surface locally before you push.

**One-time setup (operator).** The `guasi-tw/app` repo is imported into the Vercel project
**`guasi-web`** with the Vercel GitHub app installed on the `guasi-tw` org; production domain
`guasi.tw` is attached to that project. Done once — afterwards the git flow above is all that's
needed.

**Environment variables** are set per environment (production / preview / development) in the
Vercel dashboard. None are required for the current hello-world; database / auth / storage vars
arrive with later milestones (`deployment.md` §2).

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
