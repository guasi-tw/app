# Services & Accounts

Single at-a-glance registry of every external service / account **我是 (guasi)** uses or has
committed to. This is the *inventory*; **dollar costs** live in
[`operating-costs.md`](operating-costs.md).

**Status:** `Active` (in use now) · `Decided` (chosen; set up at a later milestone) ·
`Anticipated` (likely, not yet chosen).

## External services & accounts

| Service | Role | Status | Plan / cost | Account / scope | More |
|---|---|---|---|---|---|
| **GitHub** | Code hosting + version control | Active | Free (org) | org `guasi-tw` · repo `guasi-tw/app` (private) | — |
| **Vercel** | App hosting + CI/CD (`push main`→prod, PR→preview) | Active | **Pro $20/mo** (trial from 2026-06-15) | team `sans-word-s-projects` · project `guasi-app` | [deployment.md](deployment.md) |
| **GoDaddy** | Domain registrar + DNS for `guasi.tw` | Active | $29.99/yr (domain) | `guasi.tw` | [deployment.md](deployment.md) §5 |
| **iCloud+ Custom Email Domain** | **Receiving** mail @`guasi.tw` (`hello@`, support) | Active | included in existing iCloud+ | root `guasi.tw` MX/SPF/DKIM | spec §12 |
| **Neon** | Serverless Postgres — app database | Active | Free tier | project (standalone) · default branch `production` · `vercel-dev` (Development env, used for local dev) · Vercel integration (auto preview branches) | spec §12 · [db-skeleton spec](superpowers/specs/2026-06-15-db-skeleton-design.md) |
| **Google Cloud** | Google OAuth provider for **site login** | Decided | Free | OAuth client (TBD) | spec §12 · Auth milestone |
| **Resend** | **Sending** transactional email (magic-link/OTP) | Decided | Free → ~$20/mo | sender `send.guasi.tw` | spec §12 · Auth milestone |
| **Vercel Blob** (or Cloudflare R2) | Object storage — proof snapshots + avatars | Decided | Included / free tier | — | spec §12 |
| **External screenshot API** (Urlbox / ScreenshotOne / Browserless) | Render proof-post screenshots | Anticipated | paid per render | — | spec §6.4 / §12 |
| **Third-party web archive** (Internet Archive / archive.today) | Independent proof archiving | Anticipated | Free | — | spec §6.4 |
| **Async queue** (Vercel Cron/Queue or Upstash QStash) | Run screenshot/archive jobs async | Anticipated | TBD | — | spec §12 |

## Core stack (libraries / frameworks — no separate account)

| Tech | Role |
|---|---|
| **Next.js** (App Router) + **React** + **TypeScript** | Full-stack web app (UI + API) — *scaffolded* |
| **Prisma** | ORM + migrations against Neon |
| **Auth.js (NextAuth v5)** | Passwordless auth — Google OAuth + email magic-link / OTP |

## Domain & handles (assets, not services)

- **`guasi.tw`** — primary domain (registrar GoDaddy), live on Vercel.
- **`@gua.si.tw`** — Instagram handle (also secures Threads).

## Cross-references
- [`operating-costs.md`](operating-costs.md) — dollar costs + run-rate.
- [`deployment.md`](deployment.md) — deploy / CI / DNS model.
- [spec §12](superpowers/specs/2026-06-14-identity-backup-design.md) — locked-stack rationale.
