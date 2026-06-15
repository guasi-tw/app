# Operating Costs

Running ledger of operational costs for **我是 (guasi)**. Update whenever a cost starts,
changes, or ends. Amounts in **USD** unless noted.

## Recurring

| Service | What it's for | Cost | Cycle | Since | Notes |
|---|---|---|---|---|---|
| **Vercel Pro** | Hosting + CI/CD for the app | **$20** / member | monthly | 2026-06-15 | **14-day free trial** started 2026-06-15 → first charge ~**2026-06-29**. Solo = 1 member. Hobby *can* deploy a private repo but is **non-commercial-use only**, so Pro is the right tier for a real product. (See `deployment.md` §6.) |
| **Domain `guasi.tw`** | Primary website domain | **$29.99** | yearly | (confirm) | Registrar **GoDaddy**. Renews annually — **confirm exact registration/renewal date in GoDaddy** and watch auto-renew. DNS also hosts iCloud Custom Email (no extra cost here). |

## Free tier — no cost yet (watch for overage)

| Service | What it's for | Tier | Starts costing when |
|---|---|---|---|
| **Neon** (Postgres) | App database | Free | Scale / storage / compute-hours overage (next milestone) |
| **Vercel Blob / R2** | Snapshot + avatar images | Included / free | Storage + bandwidth overage (feature work) |

## Anticipated — not yet incurred

- **Transactional email** (Resend / Postmark) — Auth.js magic-link / OTP. Free tiers exist; cost scales with volume.
- **External screenshot API** (Urlbox / ScreenshotOne / Browserless) — proof snapshots (spec §6.4). Paid per render.
- **Third-party archive** — proof archiving (spec §6.4); Internet Archive / archive.today are free.

## Current run-rate

- **$20 / mo** (Vercel Pro) **+ $29.99 / yr** (domain) ≈ **$22.50 / mo** · **~$270 / yr**.
- First real charge: **Vercel ~2026-06-29** (trial ends). Set a reminder before then if reconsidering the plan.

## Cross-references
- [`deployment.md`](deployment.md) §6 (Vercel plan) · [`CLAUDE.md`](../CLAUDE.md) (locked stack).
