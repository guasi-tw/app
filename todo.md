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
- [ ] **Auth.js (site login) — next milestone. Scope: Google OAuth ONLY.** Brainstorm done; design
  spec written: [`authjs-site-login-design`](docs/superpowers/specs/2026-06-15-authjs-site-login-design.md).
  Auth.js v5 + Prisma adapter on Neon, **DB sessions**, `User`=正身 with seeded profile fields,
  Google-only login/logout. Email login is **deferred** (below). (Spec §12)
  - **Next step:** `superpowers:writing-plans` against the design spec (fresh session) → execution
    plan. Open items the plan must close: preview-deploy Google redirect-URI strategy; logout UX;
    the profile-seeding hook for the pinned Auth.js v5 + `@auth/prisma-adapter` versions.
  - **Email login (magic-link + OTP) — DEFERRED to a future milestone.** Full design parked in
    [`email-login-future-feature`](docs/superpowers/specs/2026-06-15-email-login-future-feature.md):
    the opaque-`rid` model (no email in the URL), OTP throttling/lockout-DoS analysis, same-email
    account-linking, and custom DB-session minting. The Google-only MVP is built so email is
    **additive** (no account migration). Pick this up after the Google MVP ships.
  - **Resend/email sending — ✅ DONE ahead of time (2026-06-15), now waiting on the email milestone:**
    account created, `send.guasi.tw` DNS verified (DKIM `resend._domainkey.send`, MX/SPF `send.send`;
    root iCloud records untouched), **API key obtained + a test send succeeded.** Wiring it in
    (`RESEND_API_KEY` in Vercel/local, a `send.guasi.tw` from-address, the email provider) happens at
    the **deferred email milestone**, not the Google MVP.
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
