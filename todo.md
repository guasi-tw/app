# 我是 (guasi) · TODO

Working list of next steps. See [`docs/superpowers/specs/2026-06-14-identity-backup-design.md`](docs/superpowers/specs/2026-06-14-identity-backup-design.md) for the full design.

- [x] **Decide hosting platform** — ✅ **all on Vercel for MVP** (Neon Postgres + Auth.js
  with Google OAuth + email OTP + Vercel Blob); wire Vercel to `guasi.tw`. (Spec §12)
- [x] **Verification security model** — ✅ locked: bound 分身 = post author resolved from
  platform authority; scoped single-use expiring code per binding request; manual paste-back
  as the MVP primary path. (Spec §6.2/§6.3/§8)
- [x] **Hello-world landing page on Vercel** — ✅ done (v0.4.0): Next 16 scaffold deployed via
  Vercel CI/CD; `https://guasi.tw` live over TLS, `www`→apex. Smoke-tested the Vercel + domain
  wiring. (Spec §12; [walking-skeleton spec](docs/superpowers/specs/2026-06-15-walking-skeleton-design.md))
- [x] **DB skeleton — Neon + Prisma + `/api/health`** — ✅ done (v0.5.0): Neon Postgres via Prisma
  (pooled/direct URLs), `migrate deploy` in the build, trivial `HealthCheck` model + first migration,
  token-gated `/api/health`, per-preview Neon branching, and a post-deploy smoke test (first GitHub
  Action). ([db-skeleton spec](docs/superpowers/specs/2026-06-15-db-skeleton-design.md))
- [ ] **Auth.js (site login) — next milestone.** Passwordless: Google OAuth + email magic-link/OTP
  via the Prisma adapter; Resend on `send.guasi.tw` for transactional mail. (Spec §12)
  - **Plan first (fresh session):** brainstorm → `superpowers:writing-plans` against §12 *before*
    coding — settle (a) how the Auth.js adapter schema (`User`/`Account`/`Session`/`VerificationToken`)
    reconciles with the §8 `users`/正身 model (`display_name`/`avatar_url`/`bio`); (b) magic-link vs
    OTP (or both) + session strategy (DB sessions via the adapter vs JWT); (c) **account-linking** so
    the same email via Google *and* via email resolves to **one 正身**.
  - **Build order — Google OAuth first:** fewest deps (just a Google Cloud OAuth client; no DNS/mail),
    fastest path to a real logged-in session, and it stands up the shared Auth.js core + Prisma
    adapter schema that the email provider then reuses.
  - **Then Resend/email — but start its DNS *now*, in parallel:** create the Resend account + add the
    `send.guasi.tw` SPF/DKIM/verification records at GoDaddy (**subdomain only** — never touch the
    root `guasi.tw` iCloud MX/SPF/DKIM). DNS verification has lag, so kicking it off early means email
    is ready to wire by the time the Google path is built.
- [ ] **Enable Vercel Web Analytics (operator-only)** — turn on Vercel Web Analytics to
  monitor traffic per URL / per `/[handle]` page for *operational* purposes (not a
  user-facing view count). Note: it's **client-side, so it counts CDN-cached views** (server
  logs would undercount); use a custom event (`track('profile_view', { handle })`) if
  per-handle attribution needs to be cleaner. Mind the Hobby vs Pro event caps + retention.
- [ ] **Detailed wireframes for each page** — 建立正身 (register), 註冊分身 (bind),
  驗明正身 (public profile + timeline), 分身管理 (manage), and the home / lookup pages.
- [ ] **Implement the MVP** — after wireframes are settled. (Use the writing-plans skill to
  turn the spec into an implementation plan first.)

## Deferred to Phase 2

- [ ] **Auto-capture validation posts via `@gua.si.tw`** — detect the tagged verification
  posts so users can skip pasting the URL. Deferred on purpose: manual paste-back is more
  responsive and avoids a business-account + app-review + live-token platform dependency.
  (Spec §6.2 / §11)
