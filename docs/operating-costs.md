# Operating Costs

Running ledger of operational costs for **我是 (guasi)**. Update whenever a cost starts,
changes, or ends. Amounts in **USD** unless noted.

## Recurring

| Service | What it's for | Cost | Cycle | Since | Notes |
|---|---|---|---|---|---|
| **Vercel Pro** | Hosting + CI/CD for the app | **$20** / member | monthly | 2026-06-15 | **14-day free trial** started 2026-06-15 → first charge ~**2026-06-29**. Solo = 1 member. **Why Pro is required:** Vercel **Hobby can't deploy a private repo owned by a GitHub org** (`guasi-tw/app`) — only *personal-account* private repos. Alternatives were *make the repo public* or *move it to a personal account*; Pro chosen to keep org + privacy. (Hobby is also non-commercial-use.) See `deployment.md` §6. |
| **Domain `guasi.tw`** | Primary website domain | **$29.99** | yearly | (confirm) | Registrar **GoDaddy**. Renews annually — **confirm exact registration/renewal date in GoDaddy** and watch auto-renew. DNS also hosts iCloud Custom Email (no extra cost here). |

## Tooling / development

| Service | What it's for | Cost | Cycle | Since | Notes |
|---|---|---|---|---|---|
| **Claude (Pro → Max)** | AI pair-programming / build assistant for this project | **$82.02** | one-time (upgrade) | 2026-06-16 | Prorated charge to upgrade the existing Claude **Pro** subscription to **Max** for more capacity while building. One-off upgrade cost; the ongoing Max subscription difference is separate. |

## Free tier — no cost yet (watch for overage)

| Service | What it's for | Tier | Starts costing when |
|---|---|---|---|
| **Neon** (Postgres) | App database | Free | Provisioned 2026-06-15 (DB-skeleton milestone). Free tier ≈ 0.5 GB storage + limited compute-hours + ~10 branches; cost starts on storage / compute / branch-count overage. Auto-deletion of obsolete preview branches keeps branch count in check. |
| **Vercel Blob / R2** | Snapshot + avatar images | Included / free | Storage + bandwidth overage (feature work) |

## Anticipated — not yet incurred

- **Transactional email — Resend** [**CONFIGURED + test-sent 2026-06-15**] (Auth.js native provider) for magic-link / OTP, sending from a **`send.guasi.tw`** subdomain (DNS verified). **Free tier covers MVP** (~3k/mo, ~100/day) → **$0 now**; ~**$20/mo** beyond the free limits. Root `guasi.tw` keeps **iCloud Custom Email** for *receiving* only (separate job, no extra cost). See spec §12.
- **External screenshot API** (Urlbox / ScreenshotOne / Browserless) — proof snapshots (spec §6.4). Paid per render.
- **Third-party archive** — proof archiving (spec §6.4); Internet Archive / archive.today are free.

## Current run-rate

- **$20 / mo** (Vercel Pro) **+ $29.99 / yr** (domain) ≈ **$22.50 / mo** · **~$270 / yr**.
- First real charge: **Vercel ~2026-06-29** (trial ends). Set a reminder before then if reconsidering the plan.
- **One-time to date:** **$82.02** (Claude Pro → Max upgrade, 2026-06-16).

## Cross-references
- [`deployment.md`](deployment.md) §6 (Vercel plan) · [`CLAUDE.md`](../CLAUDE.md) (locked stack).
