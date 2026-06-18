# Routes & Pages

Inventory of every Next.js App Router route in the app, what it's for, whether it
requires login, and whether it renders the global site chrome (header + footer).

> **Keep this current:** update this file whenever a route is added, removed, moved
> between route groups, or changes its auth/chrome behaviour. It's the single map of
> the URL surface — the devlog records *changes*, this records *current state*.

## Chrome model (header + footer)

The global `<SiteHeader>` (top-left icon + **我是** → home; top-right context action)
and `<SiteFooter>` (`guasi.tw · 關於，我是什麼`) live in **one** place: the layout of the
**`app/(site)/`** route group (`app/(site)/layout.tsx`). Any page placed under
`(site)/` inherits them automatically — no per-page wiring.

- **Has chrome** → the page lives under `app/(site)/`. (Currently *all* user-facing
  pages, including the public Identity Card `/gua` + `/r`, live here.)
- **No chrome** → the page lives outside `(site)/` (currently only redirect-only /
  API routes).
- **`not-found.tsx`** is the one exception: Next renders the global 404 under the
  *root* layout (not a route group), so it includes `<SiteHeader>`/`<SiteFooter>`
  explicitly.

Route groups (`(site)`, `(auth)`) are organisational only — the parentheses are
stripped from the URL.

## Page routes

| URL | File | Auth | Chrome | Purpose |
|-----|------|------|--------|---------|
| `/` | `app/(site)/page.tsx` | public | yes | Home / wordmark. Logged in → link to 我的正身; logged out → login CTA. |
| `/about` | `app/(site)/about/page.tsx` | public | yes | 關於 guasi marketing page. Copy in `content.ts`, styled by `about.module.css`. |
| `/login` | `app/(site)/login/page.tsx` | public | yes | Google OAuth sign-in → `/post-login`. **Already logged in → redirected to their own 正身** (`ownerHomePath`). The header 登入/免費註冊 buttons now start Google **directly** (skip this page); `/login` remains the fallback for protected-route redirects and the future multi-method (email) picker. |
| `/onboarding` | `app/(site)/onboarding/page.tsx` | required | yes | Set avatar / display name / bio for the 正身. |
| `/add` | `app/(site)/add/page.tsx` | required | yes | Platform picker driven off `PLATFORM_CATALOG` (Threads + Instagram + miin.cc active). Slug-ineligible platforms (miin.cc) are **hidden entirely** for a slug-less user — their first bind must mint a slug. |
| `/add/{platform}` | `app/(site)/add/[platform]/page.tsx` | required | yes | Per-platform 分身 binding: produce the verification post template + wizard. Unknown platform → 404. `?recover={accountId}` scopes the flow to **re-verify** an existing flagged 分身 (§C.4) rather than bind a new one. |
| `/add/{platform}/confirm` | `app/(site)/add/[platform]/confirm/page.tsx` | required | yes | Confirm + commit the binding (incl. slug minting on the main account). With `?recover={accountId}`: same-account guard, then a re-verify that refreshes the proof (恢復·重新驗證). |
| `/settings` | `app/(site)/settings/page.tsx` | required | yes | 編輯個人資料 — edit display name + (multi-line) bio; link out to change avatar. |
| `/settings/avatar` | `app/(site)/settings/avatar/page.tsx` | required | yes | 更換頭像 — upload/replace avatar (cache-busted on save). |
| `/post-login` | `app/(auth)/post-login/page.tsx` | required | n/a (redirect) | Auth dispatcher: provisioned 正身 (has slug) → `/gua/{slug}`; slug-less but already-onboarded → `/r/{shortRef}`; genuine first-timer → `/onboarding`. No UI. |
| `/gua/{slug}` | `app/(site)/gua/[slug]/page.tsx` | public | yes | Public Identity Card (驗明正身). Everyone lands on the public card; the owner can toggle to 管理檢視 (the toggle keeps the URL in sync — `?view=manage` ⇄ clean path). `?view=manage` is honored on load for the owner only; a non-owner/logged-out visitor is redirected to the clean `/gua/{slug}`. The **時間軸 tab is live** (Slice 4, v0.15.0): the append-only `BindingEvent` ledger, oldest-first, with a synthetic 建立正身 genesis row. (Also has its own `id-header`/`id-foot` chrome.) |
| `/r/{shortRef}` | `app/(site)/r/[shortRef]/page.tsx` | public | yes | Short link → redirects to `/gua/{slug}` for everyone (owner included); slug-less owner renders the card inline. |
| `*` (404) | `app/not-found.tsx` | public | yes (explicit) | Global not-found. Renders chrome explicitly (root layout, not the `(site)` group). |

## API routes

| URL | File | Purpose |
|-----|------|---------|
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | Auth.js (NextAuth) handler — Google OAuth, session. |
| `/api/health` | `app/api/health/route.ts` | Token-gated health check (DB reachability). |
| `/api/health/imaging` | `app/api/health/imaging/route.ts` | Token-gated imaging (sharp / blob) health check. |

## Shared components (app root)

- `app/SiteHeader.tsx` — global top-bar (used by `(site)/layout.tsx` and `not-found.tsx`).
- `app/SiteFooter.tsx` — global footer (same).
- `app/layout.tsx` — root layout (`<html>`/`<body>`, fonts, metadata, favicon + OG).
