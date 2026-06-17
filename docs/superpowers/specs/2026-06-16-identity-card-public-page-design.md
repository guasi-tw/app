# Identity Card — public page (`/gua/{slug}`), 帳號 tab — Slice 3 (v0.12.0)

**Status:** approved (design) · not yet built
**North star:** [`2026-06-16-mvp-wireframes-design.md`](2026-06-16-mvp-wireframes-design.md) §E.1 (帳號 tab), §E.3 (管理), §G surface #7.
This is the **execution spec** for build Slice 3 (the public Linktree). Per-session tracker: checkboxes + session log below.

---

## Context

Slices 1–2 shipped Create Identity + Threads binding (commit-on-confirm), so a provisioned 正身 now
has a `slug` and at least one verified `LinkedAccount`. But `/gua/{slug}` is still a stub that renders
"正身頁施工中（Slice 3）". This slice fills in **surface #7** — the public, Linktree-like Identity Card
(帳號 tab) — turning the data we now collect into the public face of the product and its **growth engine**
(the §6.2 acquisition loop: verification posts link here).

---

## Decisions that REFINE the wireframes spec (§E)

This slice changes a few things from the parent §E. Recorded here so the wireframes spec isn't silently
contradicted:

1. **管理 is not a third tab — it's a mode toggle on the 帳號 view.** Instead of §E's three tabs
   (帳號/時間軸/管理), the owner sees the **same Linktree** with a one-click **公開檢視 ⇄ 管理檢視**
   segmented toggle. The two views feel identical; 管理 just adds inline controls + owner-only rows.
   This folds §E.3 (Manage) into a toggle on §E.1's view. Tabs are now just **帳號 / 時間軸**.
2. **Flagged (hacked/banned) accounts stay public and sink to the bottom.** §E.1 already keeps them
   visible (anti-impersonation warning must remain public — and a KOL can use the page to *warn followers*
   their account was hijacked). Ordering refinement: they render **last**, after active 分身.
3. **OG/social metadata deferred → replaced by a 複製連結 copy button.** Rather than `generateMetadata()`
   rich cards this slice, add a copy-to-clipboard button for `guasi.tw/gua/{slug}` so the owner can share
   the link. (OG cards can return in a later polish pass.)
4. **`N 個分身` badge counts active public accounts only** — excludes private *and* flagged
   (hacked/banned don't inflate the credibility count, though they remain visible as warning rows).

---

## Scope (this slice)

**In:**
- Replace the `/gua/[slug]/page.tsx` stub with the real Identity Card (帳號 tab) — public view, server-rendered.
- Owner detection + the **公開/管理** client toggle (owner-only); 管理 view renders the full layout with
  **stubbed, no-op** management chips (look final; Slice 5 wires them) and owner-only private rows.
- **Functional 登出 / 切換帳號** controls in the 管理 view (the one exception to the otherwise-stubbed
  manage view) — reuse the existing `signOut` server action.
- **Google account-switch fix:** add `prompt: "select_account"` to the Google provider so logging back in
  reliably shows the account chooser (today it can silently re-pick the same account).
- Functional **row click-out** to the live platform profile (↗) via a new `profileUrl(handle)` on the adapter.
- **複製連結** share button (reuses the `AddAccountWizard` clipboard pattern).
- **時間軸** tab present but rendering a `時間軸施工中（Slice 4）` placeholder.

**Out (later slices):** real management actions (disclose / set-main / status flags / re-verify) → **Slice 5**;
the Timeline ledger render → **Slice 4**; IG/miin adapters → later.

---

## Design detail

### Routing & owner detection
- `app/gua/[slug]/page.tsx` (server): `findUserBySlug(slug)` → `notFound()` if none (already wired,
  `lib/identity/repo.ts`). Get the viewer via `getCurrentUser()` (`lib/identity/session.ts`);
  `isOwner = viewer?.id === user.id`. Only when `isOwner` do we load + pass **private** accounts to the client.

### Data query — `lib/identity/repo.ts` (new fn, e.g. `listIdentityAccounts`)
Load a slug owner's `LinkedAccount` rows for display:
- **Public set** (everyone): `visibility = public` AND `status = verified`.
- **Owner extra**: when owner, also include `visibility = private` rows (rendered only in 管理 view).
- Split/sort for render:
  - **★ 主要**: `isMain = true` (at most one), featured separately on top.
  - **active 其他**: `condition = active`, not main → ordered **`verifiedAt` ascending** (oldest-verified
    first = most credible, §6.7).
  - **flagged**: `condition in (banned, hacked)` → **bottom**, after active, with warning + no click-out.
- `N` (badge) = count of active public accounts (main + active others; excludes private + flagged).

### Platform adapter — `profileUrl(handle)`
- Add `profileUrl(handle: string): string` to the `PlatformAdapter` interface (`lib/binding/platforms/types.ts`).
- Threads impl (`lib/binding/platforms/threads.ts`): `https://www.threads.com/@${handle}`.
- Rows resolve their click-out via `getAdapter(platform).profileUrl(account.handle)`.
  (Only `threads` exists today; the interface keeps IG/miin pluggable.)

### Components (new, under `app/gua/[slug]/`)
- **`IdentityCard.tsx`** (client) — holds the `公開 | 管理` toggle state (owner-only), renders header +
  tab bar + the account list for the current mode. Defaults to **公開檢視**.
- **`AccountRow`** — the B-style pill: platform icon, handle, `驗證於 {date}`, ↗ click-out (active rows);
  flagged variant shows `⚠ 已回報遭盜用 · 此帳號已非本人`, no link.
- **`ShareLink`** — 複製連結 button (clipboard `writeText` of the full URL, copied-state + manual-select
  fallback, mirroring `AddAccountWizard.copy()`).
- **管理 view additions** (stubbed): inline chips (`🔒 已公開（永久）`, `★ 設為主要`, `回報遭盜用 / 停權`,
  `恢復 · 重新驗證 →`) rendered as no-op buttons; private rows (dashed); `＋ 註冊分身` (→ `/add`) and
  `編輯個人資料`(→ onboarding/edit) links. Chips look final but do nothing this slice.
- **管理 view — 登出 / 切換帳號 (functional):** reuse the existing `signOut` server action (as on Home).
  `登出` → `signOut({ redirectTo: "/" })`; `切換帳號` → `signOut({ redirectTo: "/login" })` so the user
  lands on the login button and Google's chooser (now forced by `select_account`) lets them pick another account.

### Auth — Google account switching
- `lib/auth/providers.ts`: wrap the Google provider with `authorization: { params: { prompt: "select_account" } }`
  so every login shows Google's account chooser (today the bare provider can silently re-pick the same account,
  blocking switching). One Google account = one 正身 (`User` keyed by unique `email`); switching = sign out + sign
  in as a different Google account.

### Styling — extend `app/globals.css`
New classes for the Linktree (`.idcard`, `.id-header`, `.id-badge`, `.id-toggle`, `.tabbar`, `.acct-pill`
+ `.main`/`.flag`/`.priv` variants, `.acct-actions`/`.chip`, `.id-foot`). Reuse existing tokens
(`--bg`, `--fg`, `--muted`, `--accent`, `#15151c`/`#2a2a33` surfaces, `0.6rem` radius). Mobile-first,
`max-width: 28rem` like the rest of the app. Dark/gold theme; pill style per approved mockup B.

### Growth footer (viewer-aware)
Shown to everyone, but the destination + copy depend on the viewer:
- **Logged-out** → `建立你的正身 →` to the create/login entry (the §6.2 acquisition loop).
- **Logged-in** → `前往你的正身 →` to **their own** page: `/gua/{slug}` if they've provisioned a slug,
  else `/r/{shortRef}` (pre-provisioned owner view). (Reuses the viewer already loaded via `getCurrentUser()`.)

---

## Build checklist

- [x] `profileUrl(handle)` added to `PlatformAdapter` interface + Threads impl + unit test.
- [x] `listIdentityAccounts` (or equivalent) query in `lib/identity/repo.ts` — visibility filter, owner
      private inclusion, main/active/flagged split + ordering + `N` count. Unit tests (visitor vs owner,
      private hidden, flagged last, oldest-first).
- [x] `app/gua/[slug]/page.tsx` rewritten: lookup → 404, owner detection, data load, render `IdentityCard`.
- [x] `IdentityCard.tsx` + `AccountRow` + `ShareLink` components (公開 default; 管理 toggle owner-only).
- [x] 管理 view stubbed chips + private rows + ＋註冊分身 / 編輯個人資料 (no-op / navigation only; 編輯個人資料 disabled).
- [x] 管理 view **functional** 登出 / 切換帳號 controls (reuse `signOut`; 切換帳號 → redirect to `/login`).
- [x] Google provider `prompt: "select_account"` in `lib/auth/providers.ts` + a test asserting the param.
- [x] 時間軸 tab → `時間軸施工中（Slice 4）` placeholder.
- [x] `globals.css` Linktree styles.
- [ ] Manual verify on preview (see below).
- [x] Devlog v0.12.0 entry + todo.md Slice 3 checked (tag v0.12.0 after squash-merge to `main`).

---

## Verification

- **Unit (vitest):** `profileUrl` formatting; `listIdentityAccounts` for (a) anonymous visitor — only public
  verified, private hidden; (b) owner — private included; (c) ordering: main featured, active oldest-first,
  flagged last; (d) `N` excludes flagged + private.
- **Manual (preview deploy):**
  1. Visit `/gua/{slug}` logged-out → header, badge `N 個分身`, ★主要 + active rows, flagged at bottom with
     warning, private NOT shown, 時間軸 placeholder, 複製連結 copies the URL.
  2. Row ↗ opens `threads.com/@handle` in a new tab; flagged row is not clickable.
  3. Visit own `/gua/{slug}` logged-in → 公開/管理 toggle appears, defaults to 公開; switching to 管理 shows
     private rows + stubbed chips + ＋註冊分身 / 編輯個人資料; chips are no-ops.
  4. Non-owner logged-in user sees no toggle / no manage view.
  5. Growth footer: logged-out → `建立你的正身 →` to create/login; logged-in → `前往你的正身 →` to own
     `/gua/{slug}` (or `/r/{shortRef}` if no slug yet).
  6. 管理 view: `登出` returns to Home logged-out; `切換帳號` → `/login` → Google chooser appears (the
     `select_account` prompt) → signing in as a different Google account lands in that account's 正身.
- **Build gate:** `prisma migrate deploy && next build` clean (no schema change expected — this slice is read-only
  over existing models); existing smoke + imaging gates stay green.

---

## Session log

### 2026-06-17 — Slice 3 implemented (v0.12.0)

Executed the [implementation plan](../plans/2026-06-17-identity-card-public-page.md) task-by-task (TDD where it applied). Shipped:

- **Task 1** — `profileUrl(handle)` on `PlatformAdapter` + Threads impl (`https://www.threads.com/@{handle}`); 2 unit tests appended to `threads.test.ts`.
- **Task 2** — `listIdentityAccounts` read model in `lib/identity/repo.ts` (+ `IdentityAccounts` type); DB-gated test (`repo.identity-accounts.db.test.ts`) covering visitor-vs-owner, private hidden, flagged-last/oldest-first, badge count, and flagged-main demotion. 3 cases green against the live DB.
- **Task 3** — Google `prompt: "select_account"` in `lib/auth/providers.ts` + test.
- **Task 4** — Linktree styles appended to `globals.css` (reusing existing tokens).
- **Tasks 5–9** — `types.ts` (`AccountView`/`AccountGroups`), `actions.ts` (`signOutAction`/`switchAccountAction`), `AccountRow.tsx`, `ShareLink.tsx`, `IdentityCard.tsx`, and the rewritten `page.tsx` (lookup→404, owner detection, server-side row formatting + adapter URL resolution).

**Gates:** `npx tsc --noEmit` clean; `next build` clean (`/gua/[slug]` dynamic); full suite **97 passed**.

**Plan deviation (1):** the plan's `providers.test.ts` asserted `providers[0].authorization.params.prompt`, but next-auth v5 normalizes the provider config under `providers[0].options` — the test now reads `options.authorization.params.prompt`. Implementation code unchanged from the plan. **`編輯個人資料`** rendered as a disabled stub (edit route not built yet) — as flagged in the plan's self-review.

**Manual verify on preview:** _pending_ — to be walked through after the PR opens a preview deploy.

_(append per working session)_
