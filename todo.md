# 我是 (guasi) · TODO

Working list of next steps. For current product/identity decisions see [`CLAUDE.md`](CLAUDE.md)
("Locked decisions") and [`docs/product-decisions.md`](docs/product-decisions.md). The
`docs/superpowers/specs/*` are historical design notes (allowed to go stale) — not the source of truth.

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
  - **Email login (magic-link + OTP) — DEFERRED to a future milestone.** Maintained design in
    [`docs/email-login-design.md`](docs/email-login-design.md):
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
- [ ] **Smoke-test the Identity Card routing/redirects (v0.13.1, PR #19)** — manual pass on the
  Vercel preview before/after merge. These are auth-state + slug-presence redirects that the unit tests
  mock out; the high-value cases are **browser-only** (real `history.replaceState`, redirect loops).
  Needs your logged-in account (ideally one **with** a slug) + a second browser/incognito for
  non-owner/logged-out. Check:
  - [ ] **公開/管理 toggle URL sync** — on `/gua/{slug}` as owner, 管理檢視 → URL becomes `?view=manage`
    (no reload); 公開檢視 → URL drops to clean `/gua/{slug}`; **Back** button behaves sanely (leaves the
    page, doesn't re-toggle — `replaceState` adds no history entry).
  - [ ] **Deep-link** `/gua/{slug}?view=manage` fresh (owner) → opens on 管理檢視.
  - [ ] **`?view=manage` owner-only** — logged-out/other account on `/gua/{slug}?view=manage` →
    clean `/gua/{slug}`, public view, **no redirect loop**.
  - [ ] **Short link** `/r/{shortRef}` (owner, has slug) → lands on **public** `/gua/{slug}` (not manage).
  - [ ] **Header 我的正身** (owner, has slug) → straight to `/gua/{slug}` (no `/r` flash).
  - [ ] **`/login` while logged in** → bounces to own page (no loop); logged out → form with **使用 Google 繼續**.
  - [ ] **Slug-less owner** (no verified main) — header + `/login` → `/r/{shortRef}` inline management card.
  - Note: preview logins proxy through prod via `AUTH_REDIRECT_PROXY_URL`; a flaky preview *login* is that
    known quirk, not the redirect logic. Optional follow-up: a lightweight automated route-smoke script
    for the logged-out/redirect-only cases.
- [x] **Detailed wireframes for each page** — ✅ done (v0.7.0-design, **approved**): all 9 surfaces +
  data-model deltas in
  [`mvp-wireframes-design.md`](docs/superpowers/specs/2026-06-16-mvp-wireframes-design.md). This is the
  **build doc** for the implementation tasks below.
- [ ] **Build the MVP pages — INCREMENTALLY, one slice at a time** (not one-shot). For each slice: run
  **superpowers:writing-plans** on *just that slice* of the wireframes spec → execute → review → merge,
  then start the next. Recommended order (see the spec's §G surface inventory):
  - [x] **Slice 1 — Foundation + Create Identity onboarding** — ✅ done (v0.8.0). (see §I "Next session"
    in the spec / below). `users` model extension (`slug` nullable, `short_ref` NOT NULL, `bio`,
    `avatar_url`, `updated_at`) + `short_ref` minted in the existing `createUser` wrapper + the
    建立正身 profile-setup UI + the pre-provisioned owner-view shell. Builds on shipped Google auth;
    no binding logic yet.
  - [x] **Slice 2 — Add Account (註冊分身) + binding model** — ✅ done (v0.9.0; UI refined v0.10.0). `binding_requests` (commit-on-confirm,
    §H), `linked_accounts` (per-owner rows, §A.6), `binding_events` ledger, `proof_records`; the
    per-platform wizard; **start with ONE platform** (Threads — has the compose intent + tokenless SSR);
    the success/visibility step; the slug-confirm/provisioning (`/gua/{slug}` minting). The core.
  - [x] **Slice 3 — Identity Card public page (Accounts tab)** — ✅ done (v0.12.0): the Linktree (header + featured
    main + active/flagged rows → live profile click-out); owner-only 公開/管理 toggle (private rows + stubbed
    chips + functional 登出/切換帳號); `listIdentityAccounts` read model; adapter `profileUrl`; Google
    `select_account`; 複製連結 share; 時間軸 placeholder.
  - [ ] **Slice 4 — Timeline tab** — render the append-only `binding_events` ledger (+ `created_at`).
  - [x] **Slice 5 — Manage tab** — ✅ done (v0.14.0), **merged + tagged** (2026-06-18): disclose (one-way),
    set-as-main (forces public), condition flags (banned/hacked), 恢復·重新驗證, profile-edit surface
    (`/settings` + `/settings/avatar`), multi-line bio, `onboardedAt` routing. Two-phase release
    (Release 1 schema + Release 2 features both merged; tagged `v0.14.0`). Built from the approved
    [`slice5-manage-tab-design.md`](docs/superpowers/specs/2026-06-17-slice5-manage-tab-design.md) +
    [plan](docs/superpowers/plans/2026-06-17-slice5-manage-tab.md).
    - [x] **Re-verify of an already-bound account** (deferred from Slice 2, decided 2026-06-16): the
      append-only refresh — add a new immutable `proof_record` + a `re_verified` `binding_event`, bump
      `updated_at`, and (if `banned`/`hacked`) restore `condition → active`; for an already-`active`
      account it's simply "verified again" (fresh proof, no condition change). **Single row — never a
      duplicate** (`(userId, platform, accountId)` unique). ✅ Shipped as `reverifyBinding` (v0.14.0) —
      the same commit path the Manage 恢復·重新驗證 button uses.
    - [x] **Give 編輯個人資料 a real edit surface** (avatar/name/bio). ✅ Shipped (v0.14.0): dedicated
      `/settings` edit page (edit-framed copy `儲存`) + `/settings/avatar`, shared `ProfileForm`,
      `onboardedAt` flag separating brand-new from returning-unprovisioned. *(Original note below.)*
      Slice 1 shortcut: the `/r/{shortRef}`
      "編輯個人資料" link points at **`/onboarding`**, which doubles as the editor (the form pre-fills from
      the current `User` row and `saveProfileAction` is already an `UPDATE`). What's wrong is only the
      *framing*: onboarding copy reads as first-time setup (title `建立你的正身`, button `下一步：設定主要帳號 →`,
      the permanence warning). Replace with an edit-framed surface (`儲存`, no "下一步"). Two decisions to
      settle here: (a) dedicated `/…/edit` page **vs.** a profile section on this Manage tab (today Manage
      is scoped to *bound 分身*, not profile fields); (b) add an `onboardedAt`-style flag so first login
      routes to the wizard while returning users route to their page + this edit surface (Slice 1
      deliberately omitted the flag). The `updateUserProfile` write path is already reusable.
      **Partly addressed (v0.12.0):** a **`/post-login` dispatcher** now routes *provisioned* 正身
      (have a `slug`) straight to `/gua/{slug}` instead of onboarding. Still open: an
      onboarded-but-no-main-yet user (no slug) still lands on onboarding — the `onboardedAt` flag is
      what cleanly separates brand-new from returning-unprovisioned.
    - [ ] **Rethink the "no slug, owner" state on `/r/{shortRef}`** (needs deeper design). Current
      behaviour (shipped during the redirect rework): an owner who has **no slug yet** lands on the
      `IdentityCard` management tab rendered **inline at `/r/{shortRef}`**, locked to 管理檢視 (no public
      toggle, 🔒 尚未公開 banner), with the add button forcing the main binding via `/add`. This was a
      pragmatic reuse of the public card, but the slug-less management surface deserves its own thinking:
      what exactly an owner with zero/some verified-but-unprovisioned accounts should see and do, how it
      relates to onboarding (items above) and the removed §D.5 "promote an existing verified account →
      main" picker (the tested `provisionExistingAccount` lib fn still exists, no UI), whether a
      dedicated route/layout beats reusing `IdentityCard`, and the empty (zero-account) case. Revisit
      alongside Slice 5 (Manage) + the 編輯個人資料 surface decision.
  - [ ] **Later platforms** — IG + miin adapters once the Threads slice proves the `PlatformAdapter` seam.

- [x] **About page (`/about`)** — ✅ done (v0.11.0), **merged + live**: public, mobile-first
  關於 guasi intro page (Traditional Chinese) ending in a Google-login register CTA. guasi-first narrative
  (正身 demoted to a `(tsiànn-sin)` gloss); copy in a typed `content.ts` with accuracy-constraint tests;
  thin Server Component + CSS module — fully additive.
  - [x] **Link to `/about` from the home page** — ✅ done (v0.13.0): a global `<SiteHeader>`/`<SiteFooter>`
    (in the `(site)` route-group layout) links to `/about` from every page (`關於，我是什麼`).
  - [ ] **Swap the static 範例 公開頁 card for a real screenshot/link** — Slice 3 (Identity Card) has
    shipped (v0.12.0), so this is now actionable.

- [ ] **Terminology review: 註冊分身 vs 綁定 ("register" vs "bind")** — the per-platform add **heading** now
  reads `綁定 {Platform} 帳號` (v0.14.1) because at that step the user is literally *binding* an account.
  But `註冊分身` is still the term for the **add-account CTA** (`IdentityCard` manage tab `＋ 註冊分身`) and the
  **/about** step-2 label (has a copy test), and it's defined in `product-pitch.md` as "綁定社群帳號". **Left
  as-is for now** — decide later whether to keep `註冊分身` as the friendly CTA term or unify on `綁定`
  everywhere; needs a copy register/consistency pass across these surfaces (+ CLAUDE.md / brand-and-voice if
  the product term changes). Raised 2026-06-18 (PR #24).

## Deferred to Phase 2

- [ ] **Auto-capture validation posts via `@gua.si.tw`** — detect the tagged verification
  posts so users can skip pasting the URL. Deferred on purpose: manual paste-back is more
  responsive and avoids a business-account + app-review + live-token platform dependency.
  (Spec §6.2 / §11)
- [ ] **Proof snapshots + third-party archive** — capture self-contained evidence (content +
  screenshot) and submit the post URL to an archive, so a banned account's proof survives. MVP links
  to the live post only; the `ProofRecord` snapshot/archive columns are already in place (additive).
- [ ] **Account-takeover hardening (specced, not built)** — an `audit_log` table
  (`user_id, action, target, created_at`) for investigation, and **notify the owner on binding
  changes** as a compromised-login mitigation (from the identity-backup spec §8/§9). Neither is in the
  schema yet.
- [ ] **Self-service unbinding** — unbind-with-reason as a permanent ledger event. No MVP UI; MVP
  trust-lowering is condition flags + 恢復·重新驗證 only. (See CLAUDE.md "Unbinding — deferred".)
