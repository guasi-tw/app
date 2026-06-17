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
- [x] **Auth.js (site login) — Google OAuth ONLY** — ✅ done (v0.6.0), **live + prod-verified on
  `https://guasi.tw`**: Auth.js v5 + `@auth/prisma-adapter` on Neon, **DB sessions**, `User`=正身 with
  profile columns seeded once from Google via an adapter `createUser` wrapper (also normalizes email),
  `signIn` callback rejecting unverified Google emails, and login/logout in the app shell. Vitest harness
  added (unit + self-skipping DB integration test). Preview OAuth proxies through prod via
  `AUTH_REDIRECT_PROXY_URL`. Email login is **deferred** (below).
  ([plan](docs/superpowers/plans/2026-06-15-authjs-site-login.md) · [spec](docs/superpowers/specs/2026-06-15-authjs-site-login-design.md))
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
- [ ] **Set up ESLint (dev tooling)** — the repo has **no ESLint installed** and the
  `package.json` `"lint": "next lint"` script is dead (Next 16 removed `next lint` — it errors
  with "Invalid project directory … /lint"). Today the only static gate is `npx tsc --noEmit`.
  Add ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next` + TS rules, fix the
  `lint` script, and wire it into the gates (and ideally the GitHub Action). Surfaced during the
  Slice 2 plan review (2026-06-16); until then, plans use `npx tsc --noEmit` as the type/lint gate.
- [ ] **Enable Vercel Web Analytics (operator-only)** — turn on Vercel Web Analytics to
  monitor traffic per URL / per `/[handle]` page for *operational* purposes (not a
  user-facing view count). Note: it's **client-side, so it counts CDN-cached views** (server
  logs would undercount); use a custom event (`track('profile_view', { handle })`) if
  per-handle attribution needs to be cleaner. Mind the Hobby vs Pro event caps + retention.
- [x] **Detailed wireframes for each page** — ✅ done (v0.7.0-design, **approved**): all 9 surfaces +
  data-model deltas in
  [`mvp-wireframes-design.md`](docs/superpowers/specs/2026-06-16-mvp-wireframes-design.md). This is the
  **build doc** for the implementation tasks below.
- [ ] **Build the MVP pages — INCREMENTALLY, one slice at a time** (not one-shot). For each slice: run
  **superpowers:writing-plans** on *just that slice* of the wireframes spec → execute → review → merge,
  then start the next. Recommended order (see the spec's §G surface inventory):
  - [ ] **Slice 1 — Foundation + Create Identity onboarding** ⬅️ **START HERE** (see §I "Next session"
    in the spec / below). `users` model extension (`slug` nullable, `short_ref` NOT NULL, `bio`,
    `avatar_url`, `updated_at`) + `short_ref` minted in the existing `createUser` wrapper + the
    建立正身 profile-setup UI + the pre-provisioned owner-view shell. Builds on shipped Google auth;
    no binding logic yet.
  - [ ] **Slice 2 — Add Account (註冊分身) + binding model** — `binding_requests` (commit-on-confirm,
    §H), `linked_accounts` (per-owner rows, §A.6), `binding_events` ledger, `proof_records`; the
    per-platform wizard; **start with ONE platform** (Threads — has the compose intent + tokenless SSR);
    the success/visibility step; the slug-confirm/provisioning (`/gua/{slug}` minting). The core.
  - [ ] **Slice 3 — Identity Card public page (Accounts tab)** — the Linktree (header + featured main +
    rows → live profile); now there's data to show.
  - [ ] **Slice 4 — Timeline tab** — render the append-only `binding_events` ledger (+ `created_at`).
  - [ ] **Slice 5 — Manage tab** — disclose (one-way), set-as-main (forces public), condition flags
    (banned/hacked), 恢復·重新驗證.
    - [ ] **Re-verify of an already-bound account** (deferred from Slice 2, decided 2026-06-16): the
      append-only refresh — add a new immutable `proof_record` + a `re_verified` `binding_event`, bump
      `updated_at`, and (if `banned`/`hacked`) restore `condition → active`; for an already-`active`
      account it's simply "verified again" (fresh proof, no condition change). **Single row — never a
      duplicate** (`(userId, platform, accountId)` unique). This is the same commit path the Manage
      恢復·重新驗證 button uses. Slice 2 only *notifies* "已綁定" and writes nothing.
    - [ ] **Give 編輯個人資料 a real edit surface** (avatar/name/bio). Slice 1 shortcut: the `/r/{shortRef}`
      "編輯個人資料" link points at **`/onboarding`**, which doubles as the editor (the form pre-fills from
      the current `User` row and `saveProfileAction` is already an `UPDATE`). What's wrong is only the
      *framing*: onboarding copy reads as first-time setup (title `建立你的正身`, button `下一步：設定主要帳號 →`,
      the permanence warning). Replace with an edit-framed surface (`儲存`, no "下一步"). Two decisions to
      settle here: (a) dedicated `/…/edit` page **vs.** a profile section on this Manage tab (today Manage
      is scoped to *bound 分身*, not profile fields); (b) add an `onboardedAt`-style flag so first login
      routes to the wizard while returning users route to their page + this edit surface (Slice 1
      deliberately omitted the flag). The `updateUserProfile` write path is already reusable.
  - [ ] **Later platforms** — IG + miin adapters once the Threads slice proves the `PlatformAdapter` seam.

## Deferred to Phase 2

- [ ] **Auto-capture validation posts via `@gua.si.tw`** — detect the tagged verification
  posts so users can skip pasting the URL. Deferred on purpose: manual paste-back is more
  responsive and avoids a business-account + app-review + live-token platform dependency.
  (Spec §6.2 / §11)
