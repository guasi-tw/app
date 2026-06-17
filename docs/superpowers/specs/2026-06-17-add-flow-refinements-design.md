# Add-Account Flow Refinements — Platform Picker + Primary-Only First Binding

**Status:** design (2026-06-17), approved. A **minor follow-up to Slice 2** (Add Account /
commit-on-confirm binding, merged in #11). **No data-model change** — this is UI / routing +
confirm-step behaviour only.

**Goal:** Smooth first-account registration. After onboarding, send the user to an explicit
**platform picker** instead of the pre-provisioned hub; and make the **first (main) binding** a
clean two-way choice — *accept it as your public 正身* or *cancel* — dropping the public/private
toggle and the keep-as-分身 branch, neither of which fits the main account (which must be public).

## Background

Slice 2 shipped the binding flow, but two rough edges surfaced in manual use:

1. Onboarding's `下一步：設定主要帳號 →` redirects to `/r/{shortRef}` (the hub), which shows an empty
   `主要帳號 · 尚未設定` slot — not the "pick a platform" screen the user expects.
2. The first-binding confirm step (`/add/threads/confirm`, the §D.4 slug-confirm) offers a
   public/private toggle and a *keep-as-分身* option. But the first binding **is** the 正身's main
   account, which is always public — so those choices are noise on this path.

## Decisions (this release)

1. **New platform-picker page `/add`** — generic and reusable (future non-primary binding will reuse
   it). Heading `選擇平台`. Threads active; Instagram + miin.cc shown disabled with `施工中`.
2. **Onboarding lands on the picker** — `saveProfileAction` redirects an un-provisioned user to
   `/add` (a provisioned user editing their profile goes to `/gua/{slug}`).
3. **All "add account" entries route through `/add`** — the `/r/{shortRef}` CTA points at `/add`, not
   `/add/threads`.
4. **First (main) binding is public-only** — remove the public/private toggle from the slug-confirm
   path entirely; the main account is always public.
5. **First binding = accept-as-primary or cancel** — remove the keep-as-分身 option. Cancel commits
   nothing and **hints the user they can delete the verification post** on the platform.
6. **`施工中` is the project's standard "under construction" label** (replaces `建置中`).
7. **Rename** the wizard button `產生驗證貼文範本` → `產生驗證貼文`.

## Sections

### A. `/add` platform picker

- New `app/add/page.tsx`, server component, auth-gated (`getCurrentUser()` → `redirect("/login")`).
- Heading `選擇平台`; a neutral lede (e.g. `選擇要驗證綁定的平台`). **No** primary/non-primary framing
  on the page itself — that context lives upstream (onboarding / `/r`), so the page is reusable.
- A static display list of the three MVP platforms:
  `[{ key: "threads", label: "Threads" }, { key: "instagram", label: "Instagram" }, { key: "miin", label: "miin.cc" }]`.
  A platform is **active** iff `getAdapter(key)` returns an adapter (Slice 2: threads only).
  - **Active** → solid, clickable tile linking to `/add/{key}`.
  - **Inactive** → disabled tile + `施工中` badge, not clickable.
- No data writes; purely navigational.

### B. Onboarding redirect

- `app/onboarding/actions.ts`: `saveProfileAction`'s final redirect changes from
  `redirect(\`/r/${user.shortRef}\`)` to
  `redirect(user.slug ? \`/gua/${user.slug}\` : "/add")`.
- Rationale: an un-provisioned user (no slug) goes to the picker to set their main; a provisioned user
  (re-editing their profile — `/onboarding` doubles as the editor) returns to their public page.
  Previously the redirect was always `/r/{shortRef}`, which itself permanent-redirects to `/gua` once
  a slug exists — so the provisioned end-state is unchanged; only the new-user path moves to `/add`.

### C. `/r/{shortRef}` CTA

- `app/r/[shortRef]/page.tsx`: the `＋ 驗證另一個帳號當主要帳號 →` link's `href` changes
  `/add/threads` → `/add`, so every "add account" entry goes through the picker.

### D. First-binding confirm step (slug-confirm, §D.4)

- `SlugConfirm` (`app/add/[platform]/confirm/ConfirmForms.tsx`) simplifies to **two** outcomes:
  - **接受為主要帳號** (confirm-as-slug) — mint slug, force **public + main**. **Keep** the permanence
    checkbox gate (`我了解此網址無法更改`); the slug + public state are irreversible.
  - **取消** (no commit) — with a hint: `取消後，你可以到 {platform} 刪除剛才發佈的驗證貼文。`
- **Remove** the keep-as-分身 form and **all** visibility radios from `SlugConfirm`.
- `keepAsAccountAction` (`app/add/[platform]/confirm/actions.ts`) is **removed** (now unused).
- `app/add/[platform]/confirm/page.tsx`: stop passing `keepAsAccount` to `SlugConfirm`; the
  not-slug-eligible branch (future miin-only; currently dead since miin 404s) collapses to
  cancel-only. Keep it minimal.
- **Slug-taken edge:** with keep-as-分身 gone, if the handle-derived slug `/gua/{handle}` is already
  taken by someone else, the first binding can only **cancel** (no fallback to bind it as a non-main
  分身). Accepted for MVP — the slug is the proven handle under first-claim-wins, so a clash is rare.
- **Unchanged on purpose:** `OrdinaryConfirm` — the path a *provisioned* user uses to add a
  **non-primary** 分身 (§D.3) — keeps its public/private choice (a secondary 分身 may be private).
  This is the path future non-primary binding reuses. Its cancel action gets the same delete-post
  hint for consistency.

### E. Renames + vocabulary

- `app/gua/[slug]/page.tsx`: `正身頁建置中（Slice 3）` → `正身頁施工中（Slice 3）`.
- `app/add/[platform]/page.tsx`: button `產生驗證貼文範本` → `產生驗證貼文`.
- `施工中` is the standard "under construction" term going forward. (The Manage-tab
  `（即將推出）` "coming soon" copy on the confirm page is a distinct semantic and is **left as-is**.)

### F. Tests / verification

- `app/onboarding/actions.test.ts`: update the two `/r/abc123` expectations to `/add` (the test user
  has no slug); **add** a case where a user *with* a slug redirects to `/gua/{slug}`.
- The `/add` page and the confirm-step UI changes follow the repo's **no-RSC-unit-test** convention
  (the vitest harness is `environment: "node"` with no React renderer) → covered by `npx tsc --noEmit`
  and `npx next build`.
- Type/lint gate is **`npx tsc --noEmit` only** (no ESLint installed; Next 16 removed `next lint`).

## Out of scope

- Non-primary binding **UI/entry** via `/add` (future). The picker is built generic to support it,
  but nothing new wires a provisioned user into a non-primary bind this release.
- IG / miin adapters (still 404 / `施工中`).
- Any data-model change (none).
- Identity Card render (Slice 3) — `/gua/{slug}` keeps its stub (now `施工中`).

## File-change summary

- **New:** `app/add/page.tsx`.
- **Modified:**
  - `app/onboarding/actions.ts` (conditional redirect) + `app/onboarding/actions.test.ts`.
  - `app/r/[shortRef]/page.tsx` (CTA → `/add`).
  - `app/add/[platform]/page.tsx` (button label).
  - `app/add/[platform]/confirm/ConfirmForms.tsx` (`SlugConfirm` simplify; cancel hint on both forms).
  - `app/add/[platform]/confirm/actions.ts` (remove `keepAsAccountAction`).
  - `app/add/[platform]/confirm/page.tsx` (drop keep-as-分身 wiring; pass platform label for the hint).
  - `app/gua/[slug]/page.tsx` (`施工中`).
  - `app/globals.css` (additive: platform-tile + `施工中` badge styles).
