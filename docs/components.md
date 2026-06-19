# Components

Inventory of every React component in the app — its file, whether it's a **Server** or
**Client** component (`"use client"`), where it's used, and what it's for. The companion
to [`routes.md`](routes.md): routes.md maps the URL surface, this maps the component surface.

> **Keep this current:** update this file whenever a component is added, removed, moved,
> or changes its server/client nature or its consumers. Like routes.md, it records
> *current state* — the devlog records the *changes*. Pages (`page.tsx`) and layouts
> (`layout.tsx`) live in [`routes.md`](routes.md), not here.

Components are colocated with the routes that own them (Next.js App Router convention):
shared chrome lives at the `app/` root, route-group-shared pieces under `app/(site)/`,
and route-specific pieces alongside their `page.tsx`.

## Global chrome (`app/` root)

The site-wide header/footer and the auth controls inside the header. Wired once in
`app/(site)/layout.tsx` (and re-declared in `not-found.tsx`; see the routes.md chrome model).

| Component | File | Type | Used by | Purpose |
|-----------|------|------|---------|---------|
| `SiteHeader` | `app/SiteHeader.tsx` | Server | `(site)/layout.tsx`, `not-found.tsx` | Global top-bar: top-left icon + **我是** → home; top-right context action (logged out → `HeaderSignIn`; logged in → `AccountMenu`). |
| `SiteFooter` | `app/SiteFooter.tsx` | Server | `(site)/layout.tsx`, `not-found.tsx` | Global footer (`guasi.tw · 關於，我是什麼`); the always-available, low-interruption entry to `/about`. |
| `InAppBrowserBanner` | `app/InAppBrowserBanner.tsx` | Server | `(site)/layout.tsx` (in-app browsers only) | Fixed top warning bar shown when the request comes from an in-app/webview browser (Google OAuth fails there). Static markup; reserves space via `--inapp-banner-h`. |
| `AccountMenu` | `app/AccountMenu.tsx` | Client | `SiteHeader` (logged-in) | Avatar button → menu with 正身頁面 / 切換帳號 / 登出, reachable from every page. |
| `HeaderSignIn` | `app/HeaderSignIn.tsx` | Client | `SiteHeader` (logged-out) | The header's Google sign-in button — **hidden on `/`** (the homepage hero + CTAs already cover login). |
| `GoogleSignInButton` | `app/GoogleSignInButton.tsx` | Server | `HeaderSignIn`, `LandingCta`, `IdentityCard`, `/about`, `/login` | The single, brand-compliant "使用 Google 帳戶登入" button (Google branding guidelines). `block` → full-width CTA; default → inline. |
| `NotFound` | `app/not-found.tsx` | Server | Next.js 404 | Global not-found page; renders chrome explicitly (root layout, not the `(site)` group). |

## Landing / about (`app/(site)/`)

Shared between the homepage (`/`) and `/about` so the pitch can't drift; copy lives in
`landing-content.ts`, styled by `landing.module.css`.

| Component | File | Type | Used by | Purpose |
|-----------|------|------|---------|---------|
| `HowItWorks` | `app/(site)/HowItWorks.tsx` | Server | `/`, `/about` | The 3-step block (建立正身 → 綁定分身 → 驗明正身) + the 正身/分身 gloss. |
| `ExampleCard` | `app/(site)/ExampleCard.tsx` | Server | `/`, `/about` | Mock 驗明正身 card. `withLiveLink` swaps the caption for a 看一個真實的正身 → button (homepage). |
| `LandingCta` | `app/(site)/LandingCta.tsx` | Server | `/` | Homepage CTA that branches on auth state (see `landingCtaModel`). |
| `ProfileForm` | `app/(site)/ProfileForm.tsx` | Client | `/onboarding`, `/settings` | Edit avatar / display name / bio. `variant` = `"onboarding"` \| `"edit"`. |

## Add / binding flow (`app/(site)/add/`)

| Component | File | Type | Used by | Purpose |
|-----------|------|------|---------|---------|
| `AddAccountWizard` | `app/(site)/add/[platform]/AddAccountWizard.tsx` | Client | `/add/{platform}` | Per-platform 分身 binding: verification-post template + copy/paste/post/paste-back walkthrough. |
| `OrdinaryConfirm` / `SlugConfirm` / `RecoverConfirm` | `app/(site)/add/[platform]/confirm/ConfirmForms.tsx` | Client | `/add/{platform}/confirm` | The three confirm-and-commit forms: ordinary bind, first-bind slug minting, and recover (re-verify a flagged 分身). |

## Identity Card — `/gua`, `/r` (`app/(site)/gua/[slug]/`)

The public 驗明正身 page and its owner-only 管理檢視 / 時間軸 tabs.

| Component | File | Type | Used by | Purpose |
|-----------|------|------|---------|---------|
| `IdentityCard` | `app/(site)/gua/[slug]/IdentityCard.tsx` | Client | `/gua/{slug}`, `/r/{shortRef}` | The card shell: tab state (公開 / 管理 / 時間軸), owner view toggle, share + sign-in affordances. |
| `AccountRow` | `app/(site)/gua/[slug]/AccountRow.tsx` | Server | `IdentityCard` | One bound-account row (platform glyph + handle + status); hosts `ManageChips` in 管理檢視. |
| `TimelineList` | `app/(site)/gua/[slug]/TimelineList.tsx` | Server | `IdentityCard` (時間軸 tab) | Renders the append-only `BindingEvent` ledger oldest-first with a synthetic 建立正身 genesis row. |
| `ManageChips` | `app/(site)/gua/[slug]/ManageChips.tsx` | Client | `AccountRow` | Owner controls per account: 設為公開 / 設為主要 / 回報遭盜用 / 回報已被停權, each with a confirm panel. |
| `ShareLink` | `app/(site)/gua/[slug]/ShareLink.tsx` | Client | `IdentityCard` | Copy-to-clipboard share control for the card URL. |
| `PlatformIcon` | `app/(site)/gua/[slug]/PlatformIcon.tsx` | Client | `AccountRow`, `TimelineList`, `/add`, `/add/{platform}` | Brand-identified platform glyph (`PATHS`/`BRAND`/`TILE` registries; separate from the read-`PlatformAdapter`). See product-decisions "Platform icon brand identity". |

## Settings (`app/(site)/settings/`)

| Component | File | Type | Used by | Purpose |
|-----------|------|------|---------|---------|
| `AvatarForm` | `app/(site)/settings/avatar/AvatarForm.tsx` | Client | `/settings/avatar` | Upload/replace avatar (cache-busted on save; rejects SVG — a script vector). |
