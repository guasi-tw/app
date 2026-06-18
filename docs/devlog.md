# Devlog

Running log of decisions and learnings for 正身 (tsiànn-sin). Newest entries first.

### Learning tags

| Tag | Meaning |
|-----|---------|
| `[note]` | Useful context, well-documented — good to have written down but you'd find it in the docs |
| `[insight]` | Non-obvious; meaningfully changes how you design or debug something |
| `[gotcha]` | A specific trap that bit you; high risk of biting you again — bookmark this |

## TL;DR

| Version | Summary |
|---------|---------|
| [v0.17.0](#v0170--manage-view-ux-refinements-2026-06-18) | **Manage-view UX refinements** (`/gua/{slug}` IdentityCard). (1) **編輯個人資料** moved into the header **directly under the bio** (manage view), and (2) **＋註冊分身** moved to the **top of the 帳號 list, above the main account** — both out of the old bottom link stack (which now holds just 登出/切換帳號). (3) Switching **公開 ⇄ 管理** always **returns to the 帳號 tab** (`selectMode` resets `tab`). (4) The public/manage control is now an **on/off switch** (`管理模式`, `role="switch"`) instead of a two-button segmented control that read like tabs. (5) Private rows in the **manage-view timeline** get a **subtle gray wash** (owner-only), alongside the existing hollow dot + `👁 私密` tag. CSS-only `.id-switch`/`.id-add-account`/`.tl-item.priv`; 176 tests (unchanged). |
| [v0.16.1](#v0161--clearer-dead-request-message--regenerate-button-2026-06-18) | **Dead-request wizard UX.** When a binding request can't be used, the paste-back step now tells the user *why* accurately and gives a real regenerate button. (1) Split the one-size `驗證碼已過期` into **`驗證碼已過期`** (genuinely expired — pending past its 30-min TTL) vs **`這個驗證請求已失效`** (already `resolved`/`verified`/`cancelled`) in `submitProofUrlAction`. (2) In that state the wizard **replaces the paste form** with the plain (non-clickable) reason + a **`重新產生貼文範本` primary button** that posts to `createRequestAction` (skips the dead request, mints a fresh code + rid) — replacing the earlier inline link. Removed the dead `.linklike` CSS. (3) **Reverted the code TTL 30 → 5 min** — with regeneration now one click, a tight window costs little. 176 tests (unchanged). |
| [v0.16.0](#v0160--miincc-adapter-live-2026-06-18) | **miin.cc adapter live (2nd active platform).** New self-contained **`miinAdapter`** (mirrors `threads.ts`, Approach A — no shared fetch abstraction yet) reads via miin's public **`api.miin.cc` JSON API** — one `fetch` + `JSON.parse`, no scraping (the lightest read path of the three MVP platforms). `parsePostUrl` is a **host-exact** security gate (`hostname === "miin.cc"`, https-only, numeric `/story/{id}`) that **constructs** the `api.miin.cc` fetch URL from the validated id (never a user host). `resolvePost` reads the **authoritative author** from the nested shape `story.data.author.data.username` (per `platform-verification.md` §3.3, confirmed against a live capture of story 7651906), scans the code over concatenated `title[]`+`content[]` text segments, and returns a query-free canonical URL; `displayName` = `nickname` nulled when it equals the username (miin defaults nickname→username, mirroring Threads' bare-handle semantics). **Classified failure taxonomy** (`network`/`auth_required`/`rate_limited`/`http_error`/`shape_mismatch`) logs one structured, **code-free** greppable line then throws. New static **`PLATFORM_CATALOG` + `pickablePlatforms(hasSlug)`** carry per-platform `slugEligible` even for adapter-less 施工中 platforms, so the **`/add` picker hides slug-ineligible platforms (miin) during onboarding** — a slug-less user's first bind must mint a slug. Wizard/confirm wiring already generic (compose-button guards on `composeIntentUrl`, which miin omits). Also hardened `slug.db.test.ts` to self-heal a leaked fixture row. Icon glyph deferred (renders via the brand-registry fallback). Plus add-flow polish (per-platform paste placeholder, return-to-manage, expired-code regenerate, 5→30 min TTL, stale-rid redirect guard). 176 tests. [Spec](superpowers/specs/2026-06-18-miin-adapter-design.md) · [Plan](superpowers/plans/2026-06-18-miin-adapter.md). |
| [v0.15.1](#v0151--about-platform-independence--shareable-public-profile-2026-06-18) | **About page — platform-independence + shareable public profile.** Two `/about` copy themes. **(1) Platform independence** surfaced as a first-class differentiator (previously buried in one defensive trust bullet): new emphasized **平台中立 · 不綁任何一家平台** section (gold-styled, after the platform strip) reframes 「更多陸續支援」 as a consequence of the architecture — guasi needs no platform API/authorization; verification rides on **the user's own public post**, so any platform with public posts is supportable and the banning platform can't gate your 正身. Tightened trust bullet `不靠平台授權` → **`不靠平台授權，只靠公開貼文`**. **(2) Shareable public profile:** reframed the 驗明正身的公開頁 section around the **`guasi.tw/gua/{slug}` link as the user's own cross-platform profile** — drop it into any platform's bio/post and followers click through to confirm which scattered accounts are really you (replaces the not-yet-built "輸入帳號" lookup framing). Copy-only (typed `content.ts` + `page.tsx`; one small `.cardCaption` style); +2 accuracy tests (152 tests). |
| [v0.15.0](#v0150--slice-4-timeline-tab-live-2026-06-18) | **Slice 4: Timeline tab live.** The 時間軸 tab now renders the append-only `BindingEvent` ledger on `/gua/{slug}` + `/r/{shortRef}` — replacing the 施工中 placeholder. New read model **`listTimelineEvents`** joins `BindingEvent → LinkedAccount → ProofRecord` **in JS** (no Prisma relations between them) and applies the **per-account *current*-visibility leak filter** — an event is public iff its account is `public` right now; a still-private account is fully withheld, a disclosed account shows its whole history at once (resolves the v0.14.0-design Slice-4 leak gotcha). Owner 管理檢視 gets everything (`includePrivate = isOwner`, private rows dimmed + tagged 👁 私密). **All event types public; oldest-first** (overrides §E.2 newest-first) with a synthetic **建立正身** genesis row (`onboardedAt ?? createdAt`); gold `查看貼文 ↗` proof link on `bound`/`re_verified`; red danger wash + `⚠` on `本人回報遭盜用 / 本人回報已被停權`. **No cache, no schema change, no migration.** Thin `buildTimeline` view-builder (mirrors `buildAccountGroups`) → dumb `TimelineList` (reuses brand `PlatformIcon`). 150 tests (6 new DB-backed + 1 page-prop test). [Spec](superpowers/specs/2026-06-18-timeline-tab-design.md) · [Plan](superpowers/plans/2026-06-18-timeline-tab.md). |
| [v0.15.0-design](#v0150-design--slice-4-timeline-tab-design-2026-06-18) | **Slice 4 (Timeline tab) design.** Render the append-only `BindingEvent` ledger on `/gua/{slug}` + `/r/{shortRef}`. **Leak defense = per-account current-visibility filter** (a still-private account's events are fully withheld; a disclosed account shows its whole history at once, incl. the while-private `bound`) — resolves the v0.14.0-design Slice-4 gotcha; owner 管理檢視 sees all (`includePrivate = isOwner`). **All event types public**; **oldest-first / top-down** (overrides §E.2 newest-first) with a synthetic **建立正身** genesis row (`onboardedAt ?? createdAt`); proof `查看貼文 ↗` on `bound`/`re_verified`; condition flags read `本人回報遭盜用 / 本人回報已被停權`. **No cache, no schema change** — `listTimelineEvents` joins a handful of indexed rows in JS. Visual design baked in (rail + dots, account-line hero, **red danger** for banned/hacked, dimmed 私密 owner rows) + reference mockup. PlatformIcon brand coloring (decision 6) was split out + shipped as `v0.14.1`. No timeline code yet → next is writing-plans. [Spec](superpowers/specs/2026-06-18-timeline-tab-design.md). |
| [v0.14.1](#v0141--platform-brand-icons--add-flow-icons-2026-06-18) | **Platform brand icons + add-flow icons.** `PlatformIcon` gains a per-platform `BRAND` registry — **Instagram renders in its brand gradient**, **Threads stays monochrome** (`currentColor`), future platforms register their own — so platforms are distinguishable at a glance. Icons now show on the **`/add` picker tiles** (active + 施工中) and the **`/add/{platform}` headings** (reworded to **`綁定 {icon} {Platform} 帳號`** — binding, not 註冊分身); since the component is shared, the **Accounts tab** is colorized too. New **"Platform icon brand identity"** rule in `product-decisions.md` + CLAUDE.md so future platforms inherit it. `useId()`-derived gradient ids (colons stripped) avoid duplicate-id collisions; `PlatformIcon` is now a client component. 143 tests (unchanged). |
| [v0.14.0](#v0140--slice-5-manage-tab--profile-edit-2026-06-17) | **Slice 5: Manage tab + profile edit (shipped).** Two-phase release. **Release 1 (schema):** `User.onboardedAt` (backfilled to `createdAt`) + two unused `BindingEventType` values (`disclosed` / `set_main`) — behaviour-inert, shipped ahead so prod's DB is forward-compatible. **Release 2 (features):** un-stubbed the four owner controls on the `/gua/{slug}` 管理 tab via an **inline-expand confirm** `ManageChips` client component — **disclose** (private→public, one-way), **set-as-main** (re-point ★ only; old main stays public; new main forced public), **two condition flags** (回報遭盜用→`hacked` / 回報已被停權→`banned`), and a **scoped 恢復·重新驗證** that threads `?recover={accountId}` through the Add flow with a **same-account guard**. New repo fns `discloseBinding` / `setMainBinding` / `reportCondition` / `reverifyBinding` (DB-tested); `commitBinding` now writes `set_main`; removed dead `provisionExistingAccount` / `listProvisionCandidates`. **Profile edit surface:** new `/settings` (name + multi-line bio) and `/settings/avatar` (cache-busted), a shared `ProfileForm` with **live counters + disabled-save**. **Bio → 200 chars / 8 lines** (`pre-line` render). **`onboardedAt` routing** so a slug-less-but-onboarded returning user lands on `/r/{shortRef}`, not the wizard. 143 tests. |
| [v0.14.0-design](#v0140-design--slice-5-manage-tab-design-2026-06-17) | **Slice 5 (Manage tab) design — approved.** Brainstormed the four owner controls + edit surface for the `/gua/{slug}` 管理 tab (today stubbed). Decisions: **inline-expand confirm** (one pattern for all permanent actions); **disclose** (private→public, one-way) and **set-as-main** (re-point ★ only — slug never changes, old main stays public, forces new main public) now **emit timeline ledger events** (`disclosed` / `set_main`, incl. on the provisioning commit); **two distinct condition flags** (遭盜用/停權, no quick undo); **恢復·重新驗證** = append-only re-proof that must resolve to the **same** account (the commit path Slice 2 deferred). **編輯個人資料** → a **dedicated edit page** (reuses `saveProfileAction`) with avatar one click further (separate page); **char counters + disabled save**; **bio → 200 chars, multi-line ≤ 8 lines** (`white-space: pre-line`). Added **`User.onboardedAt`** so `/post-login` stops dumping returning-but-unprovisioned users into the wizard. Proved (in code) a **slug-less owner can only ever have zero accounts** → single empty `/r` state, and `provisionExistingAccount`/`listProvisionCandidates` are dead code (remove). Migration = `onboardedAt` + 2 enum values. Spec: [`slice5-manage-tab-design.md`](superpowers/specs/2026-06-17-slice5-manage-tab-design.md). No code shipped. |
| [v0.13.1](#v0131--identity-card-view-url-sync-2026-06-17) | **Identity Card view ⇄ URL consistency.** Routing tweaks so the URL always matches the view: (1) `/r/{shortRef}` now sends the **owner to the public card** (`/gua/{slug}`), not the manage tab — they toggle from there. (2) The owner's **公開/管理 toggle keeps the URL in sync** via `history.replaceState` (管理檢視 → `?view=manage`, 公開檢視 → clean path), no navigation/refetch. (3) Visiting `/gua/{slug}?view=manage` as a **non-owner or logged-out** visitor now **server-redirects to the clean `/gua/{slug}`** (you can't manage a page you don't own). (4) The header **我的正身** button links **straight to `/gua/{slug}` when the slug exists** (falls back to `/r/{shortRef}` for slug-less owners) — skips the `/r` redirect hop + its duplicate queries at zero extra cost (the slug is already on the header's session row). (5) Visiting **`/login` while already logged in now redirects to your own 正身** (same `slug ? /gua : /r` branch) instead of showing a "log in again" button. Extracted the shared branch to **`ownerHomePath()`** (header + `/login`). 120 tests. |
| [v0.13.0](#v0130--site-identity-favicon-og-image--global-site-chrome-2026-06-17) | **Site identity + global chrome.** Added the **favicon** (`app/icon.svg` + `icon.png`/`apple-icon.png` from the gold 我 coin) and a **1200×630 OG share card** (`opengraph-image.png` → also `twitter:image`), wired root `metadataBase` + `openGraph`/`twitter`. Copy: dropped ambiguous **主動** (actor clarity — *you* verify) and led the hero with the brand **我是** (not the tagline 我是正身); added a **`support@guasi.tw`** contact line on `/about`. Introduced a **global `<SiteHeader>` + `<SiteFooter>`** via a single **`(site)` route-group layout** — moved home/about/add/onboarding/login/gua/r into `(site)/` so all inherit chrome with no per-page wiring (public card + `/r` now chromed too). New **`docs/routes.md`** route inventory; CLAUDE.md brand/terminology + copy-clarity conventions. **Docs governance (same PR):** new maintained docs (`routes.md`, `product-decisions.md`, `brand-and-voice.md`, migrated `email-login-design.md`), a two-tier "maintained vs historical-specs" rule, de-referenced the specs from CLAUDE.md/README, and **corrected stale Locked decisions** (snapshot/unbind/uniqueness/login) flagged by a salvage audit. 114 tests. |
| [v0.12.3](#v0123--about-page-alignment--guarantee-2026-06-17) | **About-page mock realigned to the live card + guarantee.** Reworked the `/about` 驗明正身 example card to mirror the real `/gua/{slug}` UI: added the `3 個分身` badge, 帳號/時間軸 tab bar, handle-first rows with a `★ 主要` tag on the main account and a `平台 · 驗證於 {date}` meta line + `↗` click-out — replacing the old platform-on-top / `✔ 已驗證` layout. Carried in the new same-owner **guarantee** line (`✓ …由本人公開貼文驗證。`) above the rows. Content-only (typed `content.ts` + CSS module); +1 accuracy test (12 total). |
| [v0.12.2](#v0122--public-card-trust-hint-2026-06-17) | **Public Identity Card trust hint.** Added a one-line callout above the account list on the public `/gua/{slug}` 帳號 tab — `✓ 以下帳號皆經 guasi 確認屬於同一人，由本人公開貼文驗證。` — making the page's guarantee explicit to visitors. Public view only (hidden in 管理檢視). New `.id-hint` style (muted callout, accent left-border). Copy-only; no logic change. |
| [v0.12.1](#v0121--short-ref-routing-fix-public-slug-owners-land-on-the-management-tab-2026-06-17-0240) | **`/r/{shortRef}` routing fix + slug-less owner management tab.** The private short-link gated on login **before** the public-slug check, so a logged-out visitor to a public identity's short-link was bounced to `/login` → index instead of the public card. Reordered so the slug redirect wins for everyone. New behaviour: unknown ref → `/`; **has slug + owner → `/gua/{slug}?view=manage`** (lands on 管理檢視); has slug + anyone else → `/gua/{slug}`; no slug + logged-out/non-owner → `/`; **no slug + owner → the `IdentityCard` management tab rendered inline at `/r/{shortRef}`**, locked to 管理檢視 (no public toggle, 🔒 尚未公開 banner, add button → `/add` which is already main-only for slug-less users). `IdentityCard` gains `initialManage`/`lockManage` props + nullable `publicUrl`; `/gua/{slug}` honors `?view=manage` (owner-only); extracted shared **`buildAccountGroups()`**. Removed the orphaned §D.5 `provisionExistingAction` (promote-existing-account picker gone; tested lib fn kept). 113 tests (13 new). |
| [v0.12.0](#v0120--identity-card-public-page-slice-3-2026-06-17-0031) | **Slice 3: Identity Card public page (`/gua/{slug}`).** Replaced the stub with the real server-rendered Linktree: header (avatar/name/bio) + `N 個分身` badge + 帳號/時間軸 tabs + account rows (featured ★主要 → active oldest-first → flagged last), each active row a ↗ click-out to the live platform profile. **Owner-only 公開 ⇄ 管理 toggle** (segmented control, not a 3rd tab) reveals private rows + stubbed manage chips + ＋註冊分身; **functional 登出 / 切換帳號**. New read model **`listIdentityAccounts`** (visibility filter, main/active/flagged split, oldest-first, badge count excludes private+flagged), adapter **`profileUrl(handle)`**, Google **`prompt: "select_account"`** (fixes 切換帳號), **複製連結** share button, 時間軸 placeholder (Slice 4). Server formats rows + resolves URLs so the client card is a dumb view. Post-verify fixes (same PR): explicit `★ 主要` tag on the main row, owner footer no longer self-links, and a **`/post-login` dispatcher** that routes returning (provisioned) users to `/gua/{slug}` instead of forcing onboarding. 100 tests. |
| [v0.11.0](#v0110--about-page-about-guasi-intro--register-cta-2026-06-16-2211) | **About page (`/about`).** New public, mobile-first 關於 guasi page (Traditional Chinese), **purely additive** (one route, no edits to existing files). **guasi-first** narrative: universal hook「這真的是我」→ **guasi（我是）** → 正身 demoted to a `(tsiànn-sin)` gloss; two **範例** anchors (verification post + 公開頁 card), platform strip (Threads · Instagram · miin.cc · 更多陸續支援), Google-login CTA → `/login`. Copy extracted to a typed `content.ts` with **accuracy-constraint tests** (Google-only, **no** Email/snapshot claims, 6-digit code); thin static **Server Component + CSS module** (`globals.css` untouched). 48 tests. Built in an isolated worktree → PR (not yet merged). |
| [v0.10.0](#v0100--add-flow-refinements-add-platform-picker--primary-only-first-binding-2026-06-16-2153) | **Add-flow refinements (UI/routing).** New **`/add` platform picker** (Threads live; IG/miin disabled `施工中` — state derived from the adapter registry). Onboarding now routes a new 正身 to `/add` (provisioned → `/gua/{slug}`); all add-account entries go through `/add`. **First (main) binding simplified to accept-as-primary or cancel** — dropped the public/private toggle + keep-as-分身 (the main account is always public), cancel hints to delete the verification post; `OrdinaryConfirm` (non-primary 分身) keeps its visibility choice. Copy: `產生驗證貼文`, `施工中`. 80 tests. |
| [v0.9.0](#v090--slice-2-add-account--commit-on-confirm-binding-2026-06-16-2039) | **Slice 2: Add Account (註冊分身) + commit-on-confirm binding.** 4 Prisma models (`BindingRequest`/`LinkedAccount`/`ProofRecord`/`BindingEvent`) + the binding lib: scoped single-use auth code, growth-engine post template, **`PlatformAdapter` seam + Threads adapter** (tokenless crawler-UA SSR, author from `og:title` authority, spoof-defended, query-free canonical proof URL), and the **commit-on-confirm** repo (durable artifacts written in one transaction at confirm; per-owner uniqueness, NOT global; slug minted first-claim-wins). The `/add/threads` wizard (copy/compose → paste-back → resolve), the confirm step, and the `/r/{shortRef}` provisioning picker. 79 tests (incl. live-DB). |
| [v0.8.1](#v081--avatar-sharplibvips-runtime-fix--imaging-smoke-gate-2026-06-16-1005) | **Avatar sharp/libvips production fix + imaging smoke gate.** Avatar upload 500'd on Vercel with `ERR_DLOPEN_FAILED: libvips-cpp.so` — root cause was a **file-tracing gap**: libvips ships in the *separate* `@img/sharp-libvips-linux-x64` package, which Next's tracer can't follow from sharp's runtime-resolved `require`, so the 18MB `.so` installed but never reached the function bundle. Fixed with **`outputFileTracingIncludes`** for `@img/**` (bundler-agnostic — Turbopack & Webpack both failed without it; `serverExternalPackages` alone insufficient). Also: **lazy `import("sharp")`** (bio-only saves no longer load the native module), stopped **swallowing** the avatar error, new token-gated **`/api/health/imaging`** probe + **smoke check** (observational gate; hard branch-protection needs paid GitHub). Plus the **`AUTH_REDIRECT_PROXY_URL`-on-prod** doc fix (preview-login `InvalidCheck: pkceCodeVerifier`). |
| [v0.8.0](#v080--slice-1-foundation--create-identity-2026-06-16-0308) | **Slice 1: Foundation + Create Identity (first feature code).** `User`(正身) gains **`slug`** (citext, CI, unique, nullable — minted later), **`shortRef`** (NOT NULL, unique base62), **`updatedAt`**, via a backfill-safe migration; the Auth.js `createUser` wrapper now **mints a `shortRef`** per 正身 (retry on collision). New `lib/identity/*`: base62 generator, plain-text **profile sanitization** (name/bio caps), **avatar pipeline** (sharp re-decode→WebP 512² + Vercel Blob, provisioned), repo + `getCurrentUser` + `session.user.id`. UI: **建立正身 onboarding** (avatar/name/bio), owner-gated **`/r/{shortRef}`** pre-provisioned shell, **`/gua/{slug}`** resolver shell + generic 404. No binding/verification yet (Slice 2). 35 tests green. |
| [v0.7.0-design](#v070-design--mvp-wireframes--page-flows-2026-06-16) | **MVP wireframes & page flows (design, approved).** All 9 surfaces (Home, Create Identity, Add Account per-platform wizard, Identity Card = Accounts/Timeline/Manage, pre-provisioned state). Decisions that **change** parent specs: snapshots **dropped** → link to live post; slug minted at main-account designation (**IG/Threads-only** source); **no self-service unbind**; **no binding-uniqueness lock** (per-owner `linked_accounts` rows); `/r/{short_ref}` collision-proof short-link; `binding_requests` **commit-on-confirm**. To be built **incrementally** (Slice 1 = Foundation + Create Identity). No code shipped. |
| [v0.6.0](#v060--authjs-site-login-google-oauth-2026-06-15-2053) | **Site login (Google).** Auth.js v5 + `@auth/prisma-adapter` on Neon, **DB sessions**; `User`=正身 with profile columns seeded once from Google via an adapter `createUser` wrapper (also normalizes email); `signIn` rejects unverified Google emails; login/logout in the shell. New **Vitest** harness (unit + self-skipping DB integration). Gotchas: next-auth v5 peer range stops at Next 15 → `.npmrc legacy-peer-deps`; Next 16 renamed `middleware.ts`→`proxy.ts` (built neither). Preview OAuth proxies through prod via `AUTH_REDIRECT_PROXY_URL`. |
| [v0.5.0](#v050--db-skeleton-neon--prisma--token-gated-apihealth-2026-06-15-1502) | **DB skeleton.** Neon Postgres + Prisma wired in; `prisma migrate deploy` in the build; trivial `HealthCheck` model + first migration; **token-gated `/api/health`** (401 before any DB call); per-preview **Neon branching**; repo's **first GitHub Action** (post-deploy smoke test). Gotchas: preview deploys sit behind **Vercel SSO** (need automation-bypass); `prisma@latest`=7.x → pinned 6.x for clean audit. |
| [v0.4.1](#v041--post-launch-ops--decisions-2026-06-15-1229) | Post-launch ops + decisions: Vercel **Ignored Build Step** (skip docs-only deploys, verified live), README **live-status badges**, started the **cost ledger** + **services inventory**, and **locked the email architecture** (Resend on `send.guasi.tw`; iCloud for receiving). Gotcha: Vercel Hobby can't deploy an **org-owned private repo** → Pro. |
| [v0.4.0](#v040--walking-skeleton-scaffold-vercel-cicd--guasitw-live-2026-06-15) | **First code.** Flat modular-monolith Next.js scaffold (Next 16 + React 19 + TS) + hello-world landing; **Vercel CI/CD** wired (`push main`→prod, PR→preview); **`guasi.tw` live** (GoDaddy DNS → Vercel, SSL, `www`→apex). postcss advisory cleared via `overrides`. |
| [v0.3.0-design](#v030-design--routing-id-provisioning--platform-verification-2026-06-15) | Designed URL routing + proof-gated ID provisioning & squatting protection; **empirically verified** platform read-mechanics (Threads/IG crawler-UA SSR; miin's public JSON API) and the URL-handle spoof defense; created [`platform-verification.md`](platform-verification.md); slimmed the routing spec's §5 to a pointer. |
| [v0.2.0-design](#v020-design--verification-security-model--vercel-stack-lock-in-2026-06-15-0029) | Locked the verification security model (bound 分身 = post author from platform authority; scoped single-use code; manual paste-back primary) and the full MVP stack (all on Vercel: Neon + Auth.js + Google OAuth/email OTP + Vercel Blob). |
| [v0.1.1-design](#v011-design--snapshot-ledger-status--naming-2026-06-14-2311) | Deepened the design: proof snapshots, append-only ledger, unbinding, timeline, account status management, verification-post growth loop; finalized naming/domain (我是/正身, `guasi.tw`). |
| [v0.1.0-design](#v010-design--design--pitch-2026-06-14-2054) | Brainstormed the idea into a product + architecture spec, a non-technical pitch, and project context; git initialized. No code yet. |

---

## v0.17.0 — manage-view UX refinements (2026-06-18)
**Review:** not yet
**What was built:** (all in `app/(site)/gua/[slug]/IdentityCard.tsx` + `globals.css`)
- **編輯個人資料** relocated into the `id-header` **directly under the bio** (shown in manage view), as a compact `btn-secondary sm` — out of the bottom link stack.
- **＋註冊分身** relocated to the **top of the 帳號 list, above the main account** (full-width dashed `.id-add-account` CTA). Keeps the slug-less label `＋ 驗證主要帳號`.
- **Mode switch returns to 帳號 tab:** `selectMode` now calls `setTab("accounts")`, so toggling 公開⇄管理 never leaves you stranded on the 時間軸 tab.
- **On/off switch** replaces the two-button toggle: `管理模式` label + a `role="switch"` track/knob (`.id-switch`/`.switch`). Off = 公開檢視, on = 管理模式 — reads as a toggle, not tabs.
- **Private timeline rows** (manage view) get a **subtle gray background** (`.tl-item.priv` → `rgba(255,255,255,0.045)` + radius + padding), reinforcing the owner-only signal beyond the hollow dot + `👁 私密` tag.
- Bottom `id-manage-links` now holds only 登出 / 切換帳號.
- 176 tests (unchanged); `tsc --noEmit` clean.

**Process learnings:**
- `[note]` Removing the `公開檢視`/`管理檢視` button labels broke no test — the `/gua` page tests assert props, not rendered chrome, so view-chrome copy can change freely.

## v0.16.1 — clearer dead-request message + regenerate button (2026-06-18)
**Review:** not yet
**What was built:**
- **Split the dead-request message** in `submitProofUrlAction` (`app/(site)/add/[platform]/actions.ts`): the old single `驗證碼已過期` covered five states; now **genuinely-expired** (pending past its TTL, or the rare `expired` status) → `驗證碼已過期`, while **already-used/cancelled** (`resolved`/`verified`/`cancelled`) → `這個驗證請求已失效`.
- **Wizard swaps the paste form for a regenerate button** when the request is dead (`state.expired`): the reason is now **plain (non-clickable) text** + a **`重新產生貼文範本` primary button** posting to `createRequestAction` (skips the dead request, mints a fresh code + rid, reveals the new template via `?rid=`). Replaces the earlier inline `.linklike` link; removed the now-dead CSS.
- **Code TTL 30 → 5 min** (`BINDING_CODE_TTL_MINUTES`): reverted the v0.16.0 bump. With one-click regeneration now frictionless, a tight live-code window costs the user little, so we keep the shorter security window.
- 176 tests (unchanged); `tsc --noEmit` clean.

**Key technical learnings:**
- `[note]` The `expired` flag on `SubmitState` now means "request no longer usable" (expired *or* used/cancelled), not strictly time-expired — it drives the form↔button swap, while the `error` string carries the accurate reason.
- `[insight]` In normal UX the dead-request branch is rarely hit, because the GET-page guard (`findLiveRequest` → redirect, shipped v0.16.0) strips a dead `rid` before the wizard renders. It still fires on a race (the request flips state in another tab between page-load and submit) — which is exactly the case this clearer message + in-place regenerate button serves.

## v0.16.0 — miin.cc adapter live (2026-06-18)
**Review:** not yet
**Design docs:**
- miin.cc adapter: [Spec](superpowers/specs/2026-06-18-miin-adapter-design.md) [Plan](superpowers/plans/2026-06-18-miin-adapter.md)

**What was built:**
- **`lib/binding/platforms/miin.ts`** — self-contained `miinAdapter` mirroring `threads.ts` (Approach A; no shared fetch abstraction — rule-of-three deferred until IG ships). Reads via miin's public `api.miin.cc` JSON API (one `fetch` + `JSON.parse`, no scraping).
  - `parsePostUrl`: **host-exact** gate — `hostname === "miin.cc"` (rejects look-alikes `miin.cc.evil.com`/`notmiin.cc`, subdomains `www.miin.cc`), https-only, numeric `/story/{id}`. Builds the `api.miin.cc` fetch URL **from the validated id**, never a user-supplied host.
  - `resolvePost`: authoritative author from the nested shape `story.data.author.data.username`; code scanned over concatenated `title[]`+`content[]` `.text` segments; query-free canonical URL; `displayName` = author `nickname`, nulled when it equals the username (miin defaults nickname→username — matches Threads' bare-handle null).
  - **Failure taxonomy:** `network`/`auth_required` (401/403)/`rate_limited` (429)/`http_error`/`shape_mismatch`, each logging one structured, **code-free** greppable line then throwing (no adapter-level retry).
- **Registered** `miin: miinAdapter` in the platform registry (the one-line activation switch).
- **`lib/binding/platforms/catalog.ts`** — static `PLATFORM_CATALOG` (incl. adapter-less 施工中 IG) + `pickablePlatforms(hasSlug)` pure filter. Carries `slugEligible` even without an adapter so the picker can hide slug-ineligible platforms during onboarding; a consistency test guards catalog `slugEligible` against each registered adapter.
- **`/add` picker** now driven off the catalog: a slug-less (onboarding) user sees only slug-eligible platforms — **miin is hidden entirely** (not shown-disabled), because their first bind becomes the main 分身 and must mint a slug. Provisioned users see all.
- Verified the generic wizard/confirm wiring covers miin with **zero miin-specific code** (compose button guards on `composeIntentUrl`, which miin omits; confirm routes the slug-ineligible-without-slug branch to cancel-only). Fixed a stale comment that the activation made inaccurate.
- Hardened `slug.db.test.ts`: added a `beforeAll` that clears the fixed fixture (by email/slug/shortRef) so a row leaked by an interrupted prior run can't wedge later runs on the `email` unique constraint.
- **Wizard polish (all platforms):** the paste-input placeholder is now **per-platform** via a new `PlatformAdapter.postUrlPlaceholder` field (miin shows `https://miin.cc/story/…`, Threads `https://www.threads.com/@你的帳號/post/…`) — previously hardcoded to a Threads URL on every platform's page.
- **Return-to-manage (all platforms):** after a bind **confirm / cancel / recover**, owners now land on their **management tab** (`/gua/{slug}?view=manage`) instead of the public card — extracted a `manageHref` helper in the confirm actions; slug-less owners keep landing on `/r/{shortRef}` (which already renders the manage view inline).
- **Expired-code UX:** when a code expires, the wizard renders **重新產生貼文範本 as a clickable regenerate action** (a form posting to `createRequestAction`, which skips the expired request and mints a fresh code) instead of dead instructional text — `SubmitState` gains an `expired` flag to drive it.
- **Code TTL 5 → 30 min** (`BINDING_CODE_TTL_MINUTES`): a binding's security is author-match + scope + single-use, not a tight expiry, so the window only needs to outlast a realistic (possibly interrupted) compose→post→paste-back session. 5 min was too tight in practice.
- **Stale-rid hardening (all platforms):** visiting `/add/{platform}?rid=<x>` where the request is non-existent / another user's / wrong-platform / expired / resolved / verified / cancelled now **redirects to a clean `/add/{platform}`** (preserving `?recover=`) instead of silently rendering the produce-template screen with the dead token in the URL. Extracted as **`loadWizardRequest()`** — `/add/[platform]` is one dynamic route, so this single rule covers Threads + miin + future platforms. Every not-live case lands identically (no rid-status enumeration oracle); the confirm page already had the analogous redirect. The gate itself is a DB query — **`findLiveRequest(id, userId, platform)`** puts `{ owned, this platform, pending, expiresAt > now }` in the `WHERE`, so the guard just null-checks (`findRequestById` is left unchanged — the submit action + confirm flow still need the row regardless of status). 176 tests.
- 176 tests (29 new across `miin.test.ts` + `catalog.test.ts`, +1 `findLiveRequest` DB test); `tsc --noEmit` clean.

**Key technical learnings:**
- `[gotcha]` The brainstorm §3.2 sketched the miin JSON as **flat** (`author.username`, string `title`/`content`); the real shape is **nested** (`story.data.author.data.username`; `title`/`content` are **arrays of `{text}` segments**). The brainstorm's own header named `platform-verification.md` §3.3 as the source of truth — trust the read-mechanics doc + a live capture over the brainstorm's convenience sketch. A short post carries its text in `title` with `content: []`, so the shape guard keys on the **author username** (the load-bearing field), tolerating empty title/content rather than treating them as `shape_mismatch`.
- `[insight]` miin's API returns the **full untruncated body** (a 415-char post came back whole), so the Threads/IG "place the code early before truncation" concern does **not** apply here — the code can sit anywhere in the post.
- `[insight]` `failResolve(...): never` lets TypeScript narrow `resp`/`body`/`username` as definitely-assigned after each guard — the classified-throw helper doubles as a type guard, so no extra casts are needed in the happy path.
- `[note]` `accountId = handle.trim().toLowerCase()` (spec said `.toLowerCase()`; the `.trim()` is needed so a casing/whitespace variant of the same handle normalizes to the same id — the §3.4 recovery same-account guard depends on it).
- `[gotcha]` A DB test with **fixed** unique fixture values is brittle: an interrupted run leaks the row and every later run fails on the unique constraint. Clean the fixture **before** create (idempotent setup), not only in `afterAll`. The leak landed in the **dev** DB because the suite only runs locally — Vercel's build is `prisma migrate deploy && next build` (no vitest), and the sole CI is a post-deploy smoke test, so tests never run in preview/prod.

**Process learnings:**
- `[note]` Activating a platform makes previously-unreachable code paths live — a `// currently dead — miin 404s` comment in the confirm page became inaccurate the moment the adapter registered. Grep for "dead"/"404"/"not yet"/"Slice 2" comments referencing the thing you just enabled.

## v0.15.1 — About: platform-independence + shareable public profile (2026-06-18)
**Review:** not yet
**What was built:**
- **Platform-independence section.** New emphasized **平台中立 · 不綁任何一家平台** block on `/about`, placed right after the「目前支援」platform strip (gold-styled, reusing the existing `.gold`/`.kicker`/`.h2`/`.body` classes). Reframes 「更多陸續支援」 from a roadmap promise into a *consequence of the architecture*: guasi belongs to no platform and needs no platform API/authorization; verification rides on the user's own public post, so any platform with public posts is supportable, and the platform that bans you can't gate your 正身.
- Tightened the existing trust bullet `不靠平台授權` → **`不靠平台授權，只靠公開貼文`**, leading with the public-post mechanic so the new section and the trust list reinforce rather than repeat.
- **Shareable public-profile framing.** Reworked the 驗明正身的公開頁 section to lead with the **`guasi.tw/gua/{slug}` link as the user's own cross-platform identity profile**, not a handle lookup: new `sectionDesc` ("每個正身都有專屬的公開連結…這就是你對外的公開檔案") + a `shareCaption` under the example card ("把這個連結放進各平台的個人簡介或貼文，粉絲一點就能確認…真的都是你本人"). New `.cardCaption` style.
- +2 accuracy-constraint tests (platform-independence copy; shareable-link copy). 152 tests.
- Copy-only: `content.ts` (new `independence` block, reworded trust item, reworked `exampleProfile` desc + `shareCaption`), `page.tsx` (two sections), `about.module.css` (one `.cardCaption`), `content.test.ts`. No logic or schema changes.

**Key technical learnings:**
- `[insight]` Both edits made *already-true* product facts legible rather than changing the product. Platform independence existed only as a defensive OAuth footnote; the `/gua/{slug}` page existed but was described as a handle *lookup* ("輸入帳號") — which isn't built and is still an open question — when the shipped, valuable mechanic is the **shareable link** the owner posts across platforms. Leading with what's built (share the link) is both clearer and more accurate.
- `[note]` Built in an isolated worktree (`about-platform-independent`, off `main`) to stay clear of the parallel Slice 4 timeline session working in the main tree.

---

## v0.15.0 — Slice 4: Timeline tab live (2026-06-18)
**Review:** not yet

**Design docs:**
- Timeline tab (時間軸): [Spec](superpowers/specs/2026-06-18-timeline-tab-design.md) [Plan](superpowers/plans/2026-06-18-timeline-tab.md)

**What was built:**
- **`listTimelineEvents(userId, { includePrivate })`** read model (`lib/identity/timeline.ts`) — joins
  `BindingEvent → LinkedAccount → ProofRecord` **in application code** (no Prisma relations exist between
  them): 3 indexed reads (user + accounts in parallel, then events oldest-first) + a batched proof-URL
  fetch. Applies the **per-account current-visibility leak filter** and prepends the synthetic **建立正身**
  genesis row (`onboardedAt ?? createdAt`). 6 DB-backed tests (visibility, owner `isPrivate` flag,
  disclosure-history, proof-attach, order, orphan-event skip).
- **`buildTimeline(userId, isOwner)`** view-builder (`app/(site)/gua/[slug]/timeline.ts`) — mirrors
  `buildAccountGroups`: maps entries → plain serialisable `TimelineView[]` (pre-formatted `YYYY-MM-DD`
  date + `adapter.label`), proof link only on `bound`/`re_verified`.
- **`TimelineList`** dumb presentational component — vertical rail + dots, per-kind `KIND_LABEL` (繁中),
  reuses the brand `PlatformIcon` (v0.14.1). Client-side mode filter (公開檢視 hides private; 管理檢視
  shows all, private dimmed + 👁 私密 tag).
- Wired both card pages (`/gua/{slug}`, `/r/{shortRef}`) to build + pass `timeline` via `Promise.all`;
  `IdentityCard` gains a `timeline` prop and renders `<TimelineList>` in place of the 施工中 placeholder.
- CSS: new `--danger` token + `.timeline` / `.tl-*` / `.dot` block (gold genesis/proof, red flag wash,
  hollow-ring dimmed private rows).

**Key technical learnings:**
- `[insight]` **Leak defense is *current*-visibility, not point-in-time.** An event surfaces publicly iff
  its account is `public` right now — so a disclosed account reveals its entire history (incl. the
  while-private `bound`) at once, and a still-private account is fully withheld. This resolves the
  v0.14.0-design Slice-4 gotcha (a naive per-event flag would leak that a private account exists).
- `[note]` **No Prisma relation between `BindingEvent` and `LinkedAccount`/`ProofRecord`** — the join is a
  JS `Map` keyed `platform:accountId` plus a batched `findMany({ id: { in } })` for proof URLs. A handful
  of indexed rows; no cache needed (`@@index([userId, createdAt])` already exists).
- `[note]` `KIND_LABEL: Record<TimelineView["kind"], string>` makes a missing event-type label a **compile
  error** — `tsc` guards copy coverage across all 7 `BindingEventType` values + genesis.
- `[gotcha]` The DB suite **self-skips when `DATABASE_URL` is unset**; run it with the var explicitly
  (`DATABASE_URL=… npx vitest run`) or a green-but-skipped suite masquerades as verified.

**Process learnings:**
- `[note]` **Docs single-source-of-truth pass (same PR).** Consolidated the product/identity decisions out
  of CLAUDE.md "Locked decisions" into their canonical homes (most into `product-decisions.md` new sections;
  full stack into `deployment.md` "Locked stack (MVP)"; Name/brand already in `brand-and-voice.md`), leaving
  crisp one-liner pointers + a governance note ("honor these during development; update the canonical doc
  first to avoid drift"). Principle: each decision lives in **one** place; CLAUDE.md points, never restates.
---

## v0.15.0-design — Slice 4 (Timeline tab) design (2026-06-18)

**Review:** not yet

**Design docs:**
- Timeline tab: [Spec](superpowers/specs/2026-06-18-timeline-tab-design.md)

**What was decided:**
- **Leak defense = per-account current visibility.** The public Timeline shows an event **iff its account is public right now**; a still-private account's events are fully withheld, and a later-disclosed account surfaces its whole history at once (incl. the `bound` that happened while private). Mirrors the Accounts tab; owner 管理檢視 sees everything (`includePrivate = isOwner`), the client hides `isPrivate` entries in 公開檢視. This resolves the v0.14.0-design Slice-4 leak gotcha.
- **All event types surface publicly** (the visibility filter alone is the defense — no per-type gating); **oldest-first / top-down** (overrides §E.2's `[DECIDED] newest-first`) with a synthetic **建立正身** genesis row from `onboardedAt ?? createdAt`; **proof link (`查看貼文 ↗`) on `bound` / `re_verified` only**; condition flags read `本人回報遭盜用 / 本人回報已被停權` (owner-reported, distinct from proof-backed `重新驗證`).
- **No cache / no schema change** — `listTimelineEvents(userId, {includePrivate})` joins ~dozens of indexed rows in JS (events + accounts + batched proof records); a materialized DB column was rejected as premature (platform cache is the path *if* profiling ever shows a need).
- **Visual design baked into the spec** (vertical rail + dots; the account line is the hero; **red danger treatment** for banned/hacked; dimmed `👁 私密` owner rows) with a committed reference mockup.

**Process learnings:**
- `[note]` PlatformIcon brand coloring (spec decision 6) was split out of the timeline work and **shipped first as `v0.14.1`** (brand-distinguishable icons + add-flow icons); the timeline build just consumes the component. A design session and a shippable side-quest can legitimately diverge in version numbers.
- `[note]` No timeline code shipped this session — the next step is **superpowers:writing-plans** against the spec, in a fresh session.

---

## v0.14.1 — Platform brand icons + add-flow icons (2026-06-18)

**Review:** not yet

**What was built:**
- `PlatformIcon` upgraded from a single monochrome glyph to a **per-platform brand treatment** via a `BRAND` registry — **Instagram → its brand gradient**, **Threads → monochrome** (`currentColor`), future platforms register their own color/gradient. Added `size` + `className` props.
- **Icons across the add flow:** the `/add` platform picker tiles (active + 施工中) and the `/add/{platform}` headings now show the platform glyph — a shared `PlatformHeading` puts it on **every** branch (incl. the live-request step, which the first pass missed). Because `PlatformIcon` is shared, the **Accounts tab** picks up the brand colors too.
- **Copy:** the per-platform add heading now reads **`綁定 {icon} {Platform} 帳號`** (recovery: `重新驗證 …`) — at that step the user is *binding* a platform account, so "綁定 … 帳號" is more accurate than the old `註冊分身 ·`. The `註冊分身` product term stays where it belongs (the manage-tab CTA, the /about steps). Heading icon scales with the responsive wordmark via `width: 1em`.
- **Docs (so future platforms inherit the rule):** new **"Platform icon brand identity"** section in [`product-decisions.md`](product-decisions.md), a CLAUDE.md Locked-decisions one-liner, and the adapter-registry comment — adding a platform now means registering its glyph (+ brand color if colorful).

**Key technical learnings:**
- `[gotcha]` An SVG gradient needs a unique `id`; the same static id across many `PlatformIcon` instances on one page yields **duplicate ids** (invalid — `url(#id)` resolves to the first match). Fixed with a per-instance `useId()`-derived id — and **strip the colons** `useId()` emits, since `:` is invalid inside a CSS `url(#…)` reference. This forces `PlatformIcon` to a client component.
- `[insight]` Icon/brand presentation is kept **independent of the read-`PlatformAdapter`**, so the 施工中 (not-yet-built) platform tiles still show their brand mark — adapters gate *reading*, not *display*.

---

## v0.14.0 — Slice 5: Manage tab + profile edit (2026-06-17)

**Review:** not yet

**Design docs:**
- Slice 5 Manage tab: [Spec](superpowers/specs/2026-06-17-slice5-manage-tab-design.md) [Plan](superpowers/plans/2026-06-17-slice5-manage-tab.md)

**What was built:**
- Release 1 (schema, merged separately): `User.onboardedAt` (backfilled to `createdAt`) + `disclosed`/`set_main` `BindingEventType` values — additive + behaviour-inert, shipped ahead of the feature code so prod's DB is forward-compatible (§M two-phase release).
- Manage tab (`/gua/{slug}` 管理檢視): inline-expand confirm `ManageChips` client component — disclose (private→public, one-way), set-as-main (re-point ★; forces new main public, old main keeps ★-less public row), two condition flags (遭盜用/停權); flagged rows collapse to a single 恢復·重新驗證 pill.
- Flagged-main nudge: when the designated main is flagged, the featured slot goes empty (the ex-main keeps its latent `isMain`, so it sits in the flagged bucket). A `mainFlagged` flag from `buildAccountGroups` drives an owner-only 管理檢視 banner prompting recover-or-re-pick. Recovery silently restores it as main (latent `isMain` untouched); promoting another active account transfers ★. The slug is permanent throughout.
- Scoped re-verify: `?recover={accountId}` threaded through `/add/{platform}` → wizard → `/add/{platform}/confirm`, with a same-account guard ("這則貼文不是這個帳號發的") before `reverifyBinding` refreshes the proof. The add page is recovery-aware (heading 重新驗證, lede names the target `@handle` resolved from the accountId, button 產生重新驗證貼文); a `recover` target that isn't one of the caller's own bindings ("找不到要恢復的帳號") or is already active ("@handle 目前狀態正常，不需要恢復") is refused up front rather than dead-ending at the commit guard.
- Repo: new `discloseBinding`, `setMainBinding`, `reportCondition`, `reverifyBinding` (all DB-tested); `commitBinding` now writes a `set_main` event on the main bind; removed dead `provisionExistingAccount` / `listProvisionCandidates` / `ProvisionResult` (§G).
- Manage server actions `discloseAction` / `setMainAction` / `reportConditionAction` with `revalidatePath` of both owner pages.
- Profile edit surface: new `/settings` (display name + multi-line bio) and `/settings/avatar` (separate page, cache-busted on save); shared `ProfileForm` (replaces `OnboardingForm`) with live char counters + disabled-save measured the same way the server validates.
- Multi-line bio: 160 → 200 chars, ≤ 8 lines, `sanitizeBio` collapses 3+ newlines → blank-line separator; `.id-bio` renders `white-space: pre-line`.
- `onboardedAt` post-login routing: slug-less-but-onboarded returning user → `/r/{shortRef}`; genuine first-timer → `/onboarding`; stamped once on first onboarding completion. `saveProfileAction`'s post-save redirect follows the same logic — a slug-less owner editing via `/settings` returns to their `/r` card (not the `/add` picker, which is reserved for first-time onboarding). `/settings` save **and** back-link both land on `?view=manage` (the management view they came from).
- Copy/terminology (review follow-ups): flagged rows show condition-specific warnings (盜用 → `已回報遭盜用 · 此帳號已非本人`; 停權 → `已回報遭停權`) via a new `condition` on `AccountView`; the flag confirms read `公開註明…` (not `標記`); the flagged-main banner reads `已被停用`; HTML-input validation errors say `HTML 標籤`.

**Key technical learnings:**
- `[insight]` Two-phase schema-first release keeps migrations from racing feature merges on Neon preview branches — the enum values + column land and deploy before any code references them.
- `[gotcha]` Postgres rejects using a new enum value in the same transaction that adds it — adding the values in a feature-inert Release 1 (where they're only *added*, never *used*) sidesteps it entirely.
- `[insight]` Inline-confirm panels gated on their chip's applicability (`isPrivate && panel === "disclose"`, `variant !== "main" && panel === "main"`) auto-collapse after `revalidatePath` moves the row to a new bucket — no manual state-sync between server and client.
- `[gotcha]` `findLinkedAccount` takes `Platform`, not `string`; a server action reading `platform` from `FormData` must cast `platform as Platform` (the matching `confirm/page.tsx` call happens to type-narrow, so it compiled without the cast — easy to miss).
- `[note]` Avatar Blob uses a stable per-user key, so a `?v={Date.now()}` suffix on the stored URL is required to bust the `<img>` cache on re-upload (applied to both onboarding + settings).

---

## v0.14.0-design — Slice 5 (Manage tab) design (2026-06-17)

**Review:** not yet

**Design docs:**
- Slice 5 — Manage tab: [Spec](superpowers/specs/2026-06-17-slice5-manage-tab-design.md)

**What was built:** (design only — no code shipped)
- Brainstormed (with the visual companion) the **分身管理 tab** on `/gua/{slug}` — un-stubbing the four owner controls in `AccountRow.ManageChips`, plus the profile-edit surface, the slug-less owner state, and the deferred re-verify commit.
- **Confirm pattern:** one **inline-expand** confirm reused by all permanent actions (no modal/route).
- **Disclose** (private→public, one-way) and **set-as-main** (re-point ★ only; slug never changes; old main stays public; new main forced public) now **write timeline ledger events** — two new `BindingEventType` values `disclosed` / `set_main` (and `set_main` is added to the Slice 2 provisioning commit so the first main is recorded too).
- **Condition flags:** two distinct pills (回報遭盜用 → `hacked` / 回報已被停權 → `banned`); no quick undo (locked §6.8). **恢復·重新驗證:** append-only re-proof that must resolve to the **same** `(platform, accountId)`; new `reverifyBinding` repo fn — the path Slice 2 only notified.
- **編輯個人資料:** a **dedicated edit page** (reuses `saveProfileAction`), avatar isolated one click further on its own page; live **char counters + disabled 儲存** (same `.length` the server validates with).
- **Bio:** 160 → **200 chars, multi-line ≤ 8 lines** (`sanitizeBio` collapses 3+ newlines → 2; render `white-space: pre-line`; field → `<textarea>`). Display name stays 50, single-line.
- **`User.onboardedAt`** added so `/post-login` routes returning-but-unprovisioned users to `/r/{shortRef}` instead of the onboarding wizard.

**Key technical learnings:**
- `[insight]` **A slug-less owner can never hold a non-main binding** — verified in `add/[platform]/confirm/page.tsx`: a `!user.slug` user only reaches `SlugConfirm` (accept-as-primary-or-cancel); the non-main commit (`confirmOrdinaryAction`) is gated behind `user.slug`. So the first bind is always the public main + mints the slug. Consequence: the slug-less `/r` state is **zero-account only**, set-as-main is **re-point only** (never provisions), and `provisionExistingAccount` / `listProvisionCandidates` are provably **dead code** (remove).
- `[gotcha]` The public **Timeline** (Slice 4) must filter to **currently-public accounts** — `bound`/`disclosed`/`set_main` events exist for private bindings too, so an unfiltered render would leak private accounts. Recorded as a Slice 4 constraint.
- `[note]` Migration is tiny: one nullable column + two additive enum values — every other field Slice 5 needs already shipped with Slice 2.
- `[insight]` `/gua/{slug}` is **already dynamically rendered** because `page.tsx` reads the session cookie (`getCurrentUser` → `auth()`) on every request — so it always reflects live DB state for every viewer (no Full Route / CDN cache). But mutating server actions still need **`revalidatePath`** to clear the **client-side Router Cache**, or the owner who just acted sees the pre-mutation render. (Spec §L.)

**Process learnings:**
- `[note]` First session using the brainstorming **visual companion** (browser mockups) — recorded the opt-in in CLAUDE.md. Worked well for comparing confirm patterns / edit-surface placement / state flows; conceptual decisions stayed in the terminal.
- `[insight]` **Two-phase release** (spec §M): ship the additive schema delta (nullable column + 2 unused enum values) to prod **first, as its own PR**, then build features against the already-migrated DB. Because previews branch Neon from prod, a schema-first release means every feature preview inherits the columns — no migration racing feature merges, and a compatible prod DB throughout testing. Generalizes beyond Slice 5.

---

## v0.13.1 — Identity Card view ⇄ URL sync (2026-06-17)

**Review:** not yet

**What was built:**
- **`/r/{shortRef}` → public card for everyone.** Previously a logged-in owner with a slug was redirected to `/gua/{slug}?view=manage` (the management tab); now the owner lands on the **public card** like everyone else (`/gua/{slug}`) and toggles to 管理檢視 from there. Non-owner/logged-out behaviour (permanent redirect to the public card; slug-less owner card rendered inline) is unchanged.
- **Owner toggle keeps the URL honest.** The `IdentityCard` 公開檢視/管理檢視 toggle is client-state, so the URL used to drift from the visible view (e.g. switching to 公開 while the URL still said `?view=manage`). Added a `selectMode()` helper that updates the URL with **`window.history.replaceState`** — 管理檢視 → `…?view=manage`, 公開檢視 → clean path — without a router navigation (no server refetch, no back-button clutter). `?view=manage` is still honored on initial load for deep-links.
- **`?view=manage` is owner-only at the server.** Visiting `/gua/{slug}?view=manage` as a non-owner or logged-out visitor now **`redirect()`s to the clean `/gua/{slug}`** (a non-owner has nothing to manage), so the URL can never advertise a manage view the viewer can't have. Owners are unaffected.
- **Header `我的正身` skips the redirect hop.** The button linked to `/r/{shortRef}`, which (for the common case — an owner who already has a slug) does a DB lookup then **redirects** to `/gua/{slug}`, doubling the queries + adding an HTTP round-trip. It now links **straight to `/gua/{slug}` when `user.slug` exists**, falling back to `/r/{shortRef}` only for slug-less owners (whose public page doesn't exist yet — `/r` renders the management card inline). **Zero extra cost:** `getCurrentUser()` already returns the full row, so `user.slug` is in hand at render time.
- **`/login` while already logged in → redirect to your own 正身.** The login page was static — a signed-in visitor saw a "使用 Google 登入" button (a confusing re-login dead-end). It now `getCurrentUser()`-guards and redirects to the same destination as the header (`ownerHomePath`); logout/切換帳號 stay in the management view, so no logout button is added here.
- **Extracted `ownerHomePath(user)`** (`lib/identity/urls.ts`) — the single `slug ? /gua/{slug} : /r/{shortRef}` rule, now shared by the header and `/login` so they can't drift. Deliberately **not** reused by `/post-login`, which keeps sending brand-new (profile-less) users to `/onboarding` for first-run setup.
- **`/login` button copy → `使用 Google 繼續`** (was `使用 Google 登入`). With OAuth-only auth there's no separate signup vs login flow, so the neutral "Continue with Google" framing is more honest for first-timers (who are also signing up). The header's **two-button** `登入` (ghost) + `免費註冊` (filled CTA) was a **deliberate keep** — not redundant: it's the standard conversion pattern (quiet returning-user link + loud growth CTA), even though both go to the same `/login`.
- Tests updated for the two new redirects (`/gua/[slug]` mock gains `redirect`; `/r/[shortRef]` owner case now expects the clean URL); new `ownerHomePath` unit tests + `/login` redirect tests. 120 tests (+5).

**Key technical learnings:**
- `[insight]` For a view toggle that's purely **client state**, sync the URL with `window.history.replaceState(null, "", url)` rather than `router.replace()` — `replaceState` updates the address bar with **no navigation**, so no server component refetch and no history entry, while `router.replace` would re-run the page (which only seeds the initial state anyway).
- `[gotcha]` When a Server Component starts calling `redirect()`, any **test that mocks `next/navigation`** must add `redirect` to the mock — the existing `/gua/[slug]` mock only exported `notFound`, so the new guard threw "redirect is not a function" until the mock was extended.
- `[note]` Use a **temporary** `redirect()` (not `permanentRedirect`) for the owner-only `?view=manage` strip: the outcome depends on **who** is viewing, so it must never be cached as a permanent 308.
- `[insight]` `shortRef` (NOT NULL from creation) vs `slug` (nullable, minted at main-account verification) is *why* `/r/{shortRef}` is the always-safe "my 正身" link — but when the caller **already holds the user row** (the header does), prefer `slug ? /gua/{slug} : /r/{shortRef}`: it skips `/r`'s redirect-then-refetch for verified owners at no extra query cost.

---

## v0.13.0 — site identity: favicon, OG image + global site chrome (2026-06-17)

**Review:** not yet

> _A meaningful session despite a deliberately **presentation-only** feature (favicon, OG card,
> consistent header/footer) — no business/data logic changed, but it polishes the site from POC toward
> "real product." The session's real weight was the **documentation clean-up**: correcting stale
> Locked decisions, the two-tier maintained-vs-historical model, the salvage migration, and a
> fresh-eyes consistency review now make it safe to **trust what a new session loads into context** —
> the foundation everything after depends on._

**What was built:**
- **Favicon** from the gold 我 coin avatar (`guasi-avatar.svg`): `app/icon.svg` (primary), `app/icon.png` 32² (raster fallback), `app/apple-icon.png` 180² (opaque) — via Next's file-convention icons.
- **Social share card** — `app/opengraph-image.png`, a 1200×630 branded card (coin + **我是正身** + `驗證並串連你擁有的社群帳號` + `guasi.tw`). Next's `opengraph-image` convention auto-emits **both** `og:image` and `twitter:image`. Rendered **locally with sharp and committed as a static asset** (not generated at runtime).
- **Root metadata** (`app/layout.tsx`): `metadataBase` (= `SITE_ORIGIN`) so crawler image URLs resolve absolute; `openGraph` + `twitter` (`summary_large_image`); `siteName: "我是"`.
- **Copy fixes (actor clarity + brand):** dropped ambiguous **主動** from the hero + meta description (it misread as *the site* verifying; now plainly *you* verify — `驗證並串連你擁有的社群帳號`), and led the homepage hero with the **brand 我是** instead of the tagline 我是正身. Swept the repo; left genuine 主動方/主動登記 and historical plan snapshots untouched.
- **`/about` contact line** — `有任何問題或建議，歡迎來信：support@guasi.tw` (mailto), above the footer; copy in the typed `content.ts`.
- **Global site chrome** — `<SiteHeader>` (top-left 我 icon + **我是** → home; top-right context action: 登入/免費註冊 logged-out, 我的正身 logged-in) and `<SiteFooter>` (`guasi.tw · 關於，我是什麼` → `/about`, the pun). Both live in **one** place: `app/(site)/layout.tsx`, and render as matched **fixed, full-width translucent-blur bars** (header `border-bottom`, footer flush-to-bottom `border-top`) so content scrolls cleanly under them. The About page's own in-flow footer was dropped as redundant (contact line — `support@guasi.tw` — kept there).
- **Route-group refactor** — created the `(site)` group and moved home, `about`, `add`, `onboarding`, `login`, **`gua`, `r`** into it so every user-facing page inherits the chrome with no per-page wiring. Left outside: `post-login` (redirect), `api`. `not-found.tsx` keeps explicit chrome (it renders under the *root* layout, not a group). Removed the now-duplicate `我是什麼？` link from the card's `id-foot`.
- **Docs & conventions governance (same PR):**
  - New maintained docs: **[`routes.md`](routes.md)** (route inventory + `(site)` chrome model),
    **[`product-decisions.md`](product-decisions.md)** (slug provisioning / anti-squatting / binding
    uniqueness / 404 rules — migrated from the routing + wireframes specs), **[`brand-and-voice.md`](brand-and-voice.md)**
    (naming / language / voice / marketing, incl. the welcomed-puns voice), and
    **[`email-login-design.md`](email-login-design.md)** (`git mv`'d out of `superpowers/specs/`,
    re-headed as the maintained deferred-feature design).
  - **Two-tier docs rule** added to CLAUDE.md: maintained `docs/*.md` are kept current; the
    `docs/superpowers/*` specs/plans are historical (allowed to stale, not source of truth).
    De-referenced all spec links from CLAUDE.md + README.
  - **Corrected stale CLAUDE.md "Locked decisions"** that contradicted shipped code: proof-snapshot
    (deferred; MVP links to live post), unbinding (no self-service in MVP), binding uniqueness
    (per-正身, not global), site login (Google only; email deferred).
  - New CLAUDE.md sections: **Who's working on this**, **Devlog format**, **"Raise a PR"/"ship it"**
    (the agent preps + opens the PR and **stops** — the user reviews the preview and squash-merges
    manually; **tagging is a separate explicit step** that pulls `main` first; refresh the devlog if
    the PR gains commits after opening), and **GitHub upload safety** (3 adopted from `sans_cube`'s
    conventions).

**Key technical learnings:**
- `[insight]` **Route groups are the idiomatic "shared chrome for a subset" mechanism.** A page **cannot** opt out of a parent layout's chrome via a flag/prop — the child can't suppress parent UI; faking it (pathname-sniffing, context, CSS-hide) is an anti-pattern. The healthy control is *file location*; for multiple chrome combos, a `<SiteChrome header footer>` component configured **per route-group layout** (never per page).
- `[gotcha]` The global **`not-found.tsx` renders under the ROOT layout, not a route group**, so it does *not* inherit `(site)` chrome — it needs `<SiteHeader>`/`<SiteFooter>` rendered explicitly.
- `[gotcha]` **Moving route directories leaves Next's generated `.next/types/validator.ts` pointing at old paths** → phantom `TS2307` errors from `tsc`. Clear `.next/types` (regenerated on build/dev); the source is fine.
- `[insight]` **OG images: render PNG locally, commit it.** Social crawlers don't render SVG, and CJK glyphs need a font present at render time — Vercel's Linux build has no guaranteed CJK fallback, so generating at runtime risks tofu. Rendering on macOS (PingFang/STHeiti) and committing the PNG sidesteps it.
- `[gotcha]` An accuracy test serialized the whole About content blob and asserted `not.toMatch(/email/i)` to forbid an email-*login* claim — adding a `email:` **contact key** tripped it. Narrowed the test to exclude the contact block (intent = login methods, not a support address).
- `[note]` `next lint` was **removed in Next 16** and `next build` no longer runs ESLint — `tsc` + `vitest` are the gates. (`<img>` for the static SVG icon carries an inline eslint-disable regardless.)

**Process learnings:**
- `[insight]` The brand/tagline/concept distinction (我是 / 我是正身 / 正身) was buried in a dense CLAUDE.md "Name:" bullet — dense enough that it produced a wrong `siteName: "我是正身"`. Promoting it to a scannable convention (+ a memory) is the fix; bury-in-prose ≠ in-context.
- `[insight]` **Before retiring "design specs" as authoritative, run a fresh-context salvage audit.** A subagent cross-checked every spec against the maintained docs + code and found three CLAUDE.md "Locked decisions" that had silently gone *wrong* (snapshot/unbind/uniqueness) plus design that lived *only* in specs (slug/anti-squatting). The maintained-vs-historical split only works if you migrate the still-current bits first — de-referencing without auditing would have lost real decisions and frozen contradictions in place.

## v0.12.3 — about-page alignment + guarantee (2026-06-17)

**Review:** not yet

**What was built:**
- Realigned the `/about` 驗明正身 example card to match the live `/gua/{slug}` Identity Card so the marketing mock reflects what visitors actually see:
  - Added the `3 個分身` badge to the card header and a 帳號 / 時間軸 tab bar.
  - Rebuilt account rows to be **handle-first** (`@meimei` + `★ 主要` tag on the main account) with a `平台 · 驗證於 {date}` meta line and a `↗` click-out glyph — replacing the old platform-label-on-top / `✔ 已驗證 · 2026/05` layout. Row chrome (pill background, border) now matches the real `.acct-pill`.
- Carried the **same-owner guarantee** (`✓ 以下帳號皆經 guasi 確認屬於同一人，由本人公開貼文驗證。`) into the mock, above the rows — mirroring the v0.12.2 hint on the live page.
- Content-only: typed `content.ts` (new `count` / `tabs` / `guarantee` fields, `AboutAccount.main`) + `about.module.css`. Added one accuracy-constraint test locking the guarantee copy (12 tests, was 11). `tsc --noEmit` clean.

---

## v0.12.2 — public card trust hint (2026-06-17)

**Review:** not yet

**What was built:**
- Added a trust hint to the public Identity Card (`/gua/{slug}`) 帳號 tab, above the account list: `✓ 以下帳號皆經 guasi 確認屬於同一人，由本人公開貼文驗證。` — surfaces the page's core guarantee (same owner, verified by the owner's public post) to visitors.
- Shown in **公開檢視 only** (`!manage`), since it's a visitor-facing trust signal; hidden in 管理檢視.
- New `.id-hint` CSS class (muted callout with an accent left-border, matching `.banner`). Copy-only change — no logic, no new tests.

---

## v0.12.1 — short-ref routing fix: public-slug owners land on the management tab (2026-06-17 02:40)

**Review:** not yet (tests + `tsc --noEmit` green; manually verified on the Vercel preview)

**What was built:**
- **Reordered `/r/{shortRef}` resolution so the public-slug redirect wins before the login gate.** The bug: the page called `redirect("/login")` for any logged-out viewer *before* looking up the owner or checking for a slug, so a logged-out visitor to a public identity's short-link never reached the `/gua/{slug}` redirect — they bounced to login → index.
- **New routing table for `/r/{shortRef}`:**
  - unknown short-ref → `/` (main page)
  - has slug + **owner** → `/gua/{slug}?view=manage` (public page, opened on the **管理檢視** tab)
  - has slug + anyone else (logged-out or non-owner) → `/gua/{slug}` (public view)
  - no slug + logged-out / logged-in non-owner → `/`
  - no slug + **owner** → the `IdentityCard` **management tab rendered inline** at `/r/{shortRef}`, locked to 管理檢視 (no 公開/管理 toggle, 🔒 尚未公開 banner), with the add button forcing the main binding via `/add`.
- **`IdentityCard` props** — added `initialManage` (start on 管理檢視) and `lockManage` (force manage + hide the toggle + show the 尚未公開 banner + swap ＋註冊分身 → ＋驗證主要帳號); `publicUrl` is now nullable (no `ShareLink` when there's nothing public yet).
- **`/gua/{slug}`** — honors `?view=manage` (owner-only) → `initialManage`; the toggle is still client state so it only sets the *initial* tab.
- **`buildAccountGroups()`** — extracted the `toView` + main/active/flagged/private bucketing into `app/gua/[slug]/accounts.ts`, shared by both `/gua/{slug}` and the inline `/r/{shortRef}` render (no duplication).
- **Removed** the orphaned §D.5 `provisionExistingAction` route action — the "promote an already-verified account to main" picker no longer has a surface; the tested lib fn `provisionExistingAccount` stays for a possible later redesign (tracked in `todo.md`).
- **Tests** — 13 new across both routers (full suite 113). Server-component routers tested by mocking deps + the (client) `IdentityCard`, asserting `redirect`/`permanentRedirect` calls and the props handed to the card.

**Key technical learnings:**
- `[gotcha]` **Guard ordering in a Server Component is the whole behaviour** — an early `redirect()` short-circuits everything after it (it throws), so a login gate placed above a public-resource check silently makes that resource private. Resolve the resource and do the public redirect *first*, then gate the private branches.
- `[insight]` **A slug-less owner has no `/gua/{slug}` to land on, so the "management tab" is reused inline at `/r/{shortRef}`** via `lockManage` rather than built as a second UI. Same component, two mount points; the public/manage toggle is hidden because there's no public view to switch to yet.
- `[note]` **Testing Server Components in the node env (no jsdom/RTL):** mock the client child component so it isn't invoked — JSX still produces a React element whose `.props` you can assert on — and make `redirect`/`permanentRedirect` throw so control flow matches production (code after a redirect must not run).

**Process learnings:**
- `[note]` **The slug-less-owner management surface shipped as a pragmatic reuse, not a designed surface** — what an owner with zero/some unprovisioned accounts should see (and its relationship to onboarding + the removed §D.5 picker) is deferred to a `todo.md` item, to revisit alongside Slice 5 (Manage).

## v0.12.0 — Identity Card public page (Slice 3) (2026-06-17 00:31)

**Review:** complete (fresh-context code review + manual preview verification)

**Design docs:**
- Identity Card public page: [Spec](superpowers/specs/2026-06-16-identity-card-public-page-design.md) [Plan](superpowers/plans/2026-06-17-identity-card-public-page.md)

**What was built:**
- **Real `/gua/{slug}` Identity Card** — replaces the Slice 1 stub with a server-rendered, mobile-first Linktree: header (avatar/name/bio) + `N 個分身` badge + 帳號/時間軸 tab bar + an account list rendered as pills.
- **Account list ordering** — featured **★主要** main on top, then **active** 分身 oldest-verified-first (most credible, §6.7), then **flagged** (banned/hacked) last as dashed warning rows (`⚠ 已回報遭盜用 · 此帳號已非本人`, no click-out). Each active row is a ↗ click-out to its **live platform profile** (`https://www.threads.com/@{handle}`).
- **Owner-only 公開 ⇄ 管理 toggle** — a segmented control (NOT a third tab); 公開檢視 is the default. 管理檢視 additionally shows **private** rows (dashed) + **stubbed** manage chips (設為公開/設為主要/回報·恢復, all disabled this slice) + ＋註冊分身 (→ `/add`) + a disabled 編輯個人資料, and **functional 登出 / 切換帳號**.
- **`listIdentityAccounts` read model** (`lib/identity/repo.ts`) — visibility filter (owner-only private inclusion), main/active/flagged bucketing, oldest-first ordering, and a badge `count` that excludes private + flagged.
- **Adapter `profileUrl(handle)`** on `PlatformAdapter` + Threads impl; **Google `prompt: "select_account"`** so 切換帳號 reliably shows the account chooser; **複製連結** share button (clipboard + manual-select fallback); 時間軸 tab → `時間軸施工中（Slice 4）` placeholder.

**Post-verification fixes (same PR, after manual preview check):**
- **Platform shown on each row** — every account pill now displays its **platform name** (`Threads`) + a monochrome **brand glyph** (`PlatformIcon.tsx`). Glyph paths are from [Simple Icons](https://simpleicons.org) (**CC0/public-domain**), rendered via `currentColor` and `aria-hidden` (the text label is the accessible name) — nominative use to identify the platform, no endorsement implied. Threads + Instagram bundled; unknown platforms degrade to label-only.
- **Explicit `★ 主要` tag** on the featured main row — the gold-border styling alone wasn't obvious, especially when a 正身 has only one binding (the lone account didn't read as "main"). Shown in both public + manage views; the handle keeps ellipsis truncation while the tag stays fixed-width.
- **Growth footer no longer self-links for the owner** — the owner was shown `前往你的正身 →` pointing at the page they were already on. Now hidden when `isOwner` (logged-in non-owner still sees it; logged-out sees 建立你的正身).
- **Login routing fix** — `/login` hard-coded `redirectTo: "/onboarding"`, forcing *every* login (new or returning) through onboarding. Added a **`/post-login` dispatcher** that branches on `user.slug` (the codebase's "provisioned" signal): provisioned 正身 → `/gua/{slug}`, new/unprovisioned → `/onboarding`. (3 dispatcher tests.)

**Key technical learnings:**
- `[insight]` **The server formats every row (date string + adapter-resolved profile URL) and hands a plain `AccountView[]` to the client card, which stays a dumb view.** Keeps platform/URL logic + Prisma types server-side; the `"use client"` `IdentityCard` only owns toggle/tab UI state and ships no adapter code to the browser.
- `[note]` **Flagged-main demotion rule** lives entirely in `listIdentityAccounts`: a `isMain` account that is banned/hacked is dropped from `main` (→ `null`), sinks into `flagged`, and is excluded from the badge count — the render layer never special-cases it.
- `[gotcha]` **`prompt: "select_account"` is required for 切換帳號 to work** — without it Google can silently re-pick the last account, so sign-out→sign-in lands back in the same 正身. Also: **next-auth v5 stores the provider's `authorization` config under `providers[0].options`, not at the top level** — the provider-config test must assert `options.authorization.params.prompt`, not `authorization.params.prompt`.
- `[insight]` **A static `redirectTo` can't make a state-dependent post-login decision** — the 正身's state (slug/provisioned?) isn't known when the sign-in button renders. The fix is a thin server **dispatcher route** that reads the session *after* it exists and redirects. `user.slug` is the de-facto "provisioned" flag across the app (`saveProfileAction`, `/r/{shortRef}`, and now `/post-login` all branch on it); a true `onboardedAt` flag (todo) would additionally separate brand-new from onboarded-but-no-main-yet users.

## v0.11.0 — About page (/about): guasi intro + register CTA (2026-06-16 22:11)

**Review:** not yet

**Design docs:**
- About page (關於 guasi): [Spec](superpowers/specs/2026-06-16-about-page-design.md) [Plan](superpowers/plans/2026-06-16-about-page.md)

**What was built:**
- **New public `/about` page** (關於 guasi) — mobile-first, single-column, Traditional Chinese; **purely additive** (one new route under `app/about/`, no edits to existing app files).
- **guasi-first narrative:** opens on the universal hook「帳號被封了，你要怎麼說『這真的是我』？」→ reveals **guasi（我是）** as the answer (the brand is the recall anchor) → demotes **正身** to a one-line romanization gloss `(tsiànn-sin)`, not a culture lesson. Two concrete **範例** anchors bracket the 3-step flow: a verification post (step-2 output) and a 驗明正身 公開頁 card (step-3 output); plus a supported-platforms strip (Threads · Instagram · miin.cc · 更多陸續支援) and a Google-login CTA → `/login`.
- **Architecture:** copy lives in a typed `app/about/content.ts` (TDD'd); `page.tsx` is a thin **static Server Component** styled by a co-located **CSS module** (`globals.css` untouched). 11 new content-contract tests (48 total green); `next build` makes `/about` a static route.

**Key technical learnings:**
- `[insight]` **TDD a static marketing page by testing its content *contract*, not its render.** Extracting copy into a typed `content.ts` let the repo's node-only Vitest assert the accuracy constraints (CTA→`/login`, exact platform list, **no** Email/snapshot claims, 正身 romanization-only) — guarding copy against future drift without adding jsdom/testing-library (which the repo deliberately avoids).
- `[gotcha]` **First-draft marketing copy drifted from the real build in three places** — it claimed stored screenshots ("封了還能查"), Email login, and an alpha auth code `ABCDEF`. Reality: `ProofRecord` is **link-only** (snapshot columns nullable, §A.1), site login is **Google-only**, and the code is **6 digits** (`lib/binding/code.ts`). Each was verified against schema/code before shipping; the content test now pins all three.
- `[note]` **CSS Module for isolation** — using `app/about/about.module.css` instead of editing shared `globals.css` keeps the page conflict-free against parallel in-flight branches.
- `[note]` Built in an **isolated git worktree** (`~/Source/github/guasi-tw/about`, branch off `main`) so it ran fully parallel to the slice work without ever touching that worktree.

**Process learnings:**
- `[note]` **Visual brainstorming companion** drove the key design calls (guasi-first over 正身-first; the 合院/house metaphor was explored then rejected as an extra hop). Ran brainstorm → spec → plan → subagent-driven implementation in one session (per request); two-stage review per task caught a copy/test contradiction (本尊 used narratively in the hook vs. as a definitional gloss) and three a11y gaps (CTA heading level, decorative ✔/avatar `aria-hidden`).

## v0.10.0 — Add-flow refinements: /add platform picker + primary-only first binding (2026-06-16 21:53)

**Review:** not yet

**Design docs:**
- Add-flow refinements: [Spec](superpowers/specs/2026-06-17-add-flow-refinements-design.md) [Plan](superpowers/plans/2026-06-17-add-flow-refinements.md)

**What was built:**
- **`/add` platform picker** (new server page) — generic + reusable. **Threads** active → `/add/threads`; **Instagram** + **miin.cc** disabled with a `施工中` badge. Active/disabled is **derived from the adapter registry** (`getAdapter`), so adding an adapter lights its tile automatically.
- **Onboarding redirect is now conditional** — a new 正身 (no slug) lands on `/add`; a provisioned user re-editing their profile returns to `/gua/{slug}`.
- **All add-account entries route through `/add`** (both `/r/{shortRef}` CTAs, not `/add/threads` directly).
- **First (main) binding simplified to accept-as-primary or cancel** — the main account is always public, so the slug-confirm step **dropped the public/private toggle and the keep-as-分身 option**; the only outcomes are 接受為主要帳號 (mint slug, public, main; permanence-gated) or 取消 (which now **hints to delete the verification post**). `keepAsAccountAction` removed. `OrdinaryConfirm` (provisioned user adding a *non-primary* 分身) is unchanged — it keeps its public/private choice.
- **Copy:** `產生驗證貼文範本` → `產生驗證貼文`; `/gua` stub `建置中` → `施工中`.
- 80 tests; built via brainstorm → spec → plan → subagent-driven implementation.

**Key technical learnings:**
- `[gotcha]` **"Reset Neon branch from production" reverts the branch's schema + `_prisma_migrations` to prod.** If the feature's migration isn't merged to `main` yet, the reset **strips it**, and the next request throws `AdapterError` (it bit a preview login during testing). After such a reset you must **re-run `prisma migrate deploy`** (or redeploy — the build does it) against the branch. For repeated re-testing, prefer **targeted row-deletes** (schema-safe) over branch-reset-from-prod; once the feature is merged + the prod deploy applies the migration, reset-from-prod is safe again.
- `[insight]` **Deriving the picker's active state from the adapter registry** (not a hardcoded list/flag) means the IG/miin tiles light up the moment their adapter ships — one source of truth.
- `[note]` **`施工中`** is now the project's standard "under construction" label (replaces `建置中`); distinct from `（即將推出）` "coming soon" for upcoming features.

**Process learnings:**
- `[note]` Ran the full **brainstorm → spec → plan → subagent-driven** cycle for a small change in one session (overriding the usual per-phase handoff, by request). Two-stage review still applied per task and caught a latent empty-slug copy bug in the now-dead not-slug-eligible branch.

## v0.9.0 — Slice 2: Add Account + commit-on-confirm binding (2026-06-16 20:39)

**Review:** not yet

**Design docs:**
- Add Account (註冊分身) + binding model: [Spec](superpowers/specs/2026-06-16-mvp-wireframes-design.md) [Plan](superpowers/plans/2026-06-16-slice2-add-account-binding.md)

**What was built:**
- **4 Prisma models + 6 enums + migration** — the **commit-on-confirm** binding model: `BindingRequest` holds pending state; `LinkedAccount` + `ProofRecord` + a `bound` `BindingEvent` (+ `User.slug` for a provisioning bind) are written only at the terminal confirm. Per-owner uniqueness `@@unique([userId, platform, accountId])` — **not** global. Snapshot columns exist but stay nullable (no snapshots this slice).
- **`lib/binding/`** — scoped single-use **6-digit auth code** + namespaced matcher; the **verification-post template** (the growth engine: `@gua.si.tw` + profile link + code); **slug** derive (proven-handle-only) + availability; the **`PlatformAdapter` seam** + **Threads adapter** (tokenless **crawler-UA SSR**, author from **`og:title` authority** — never user page content; a spoofed path handle canonicalizes to the true author; **query-free canonical** proof URL); the **commit-on-confirm repo** (transactional commit + provisioning).
- **Add Account wizard** `/add/threads` — copy/compose the template → publish → **paste the post URL back** → resolve via platform authority + match the code. **Confirm step:** ordinary bind / slug-confirm provisioning (mints `/gua/{slug}`) / already-bound notify.
- **`/r/{shortRef}`** pre-provisioned **setup picker** + provision-an-existing-account.
- 79 tests (incl. live-DB suites); built task-by-task with **subagent-driven development** (spec + code-quality review per task).

**Key technical learnings:**
- `[gotcha]` **Threads omits `og:description` when the post contains a link** — so the auth code is scanned from the **SSR'd body**, not `og:description`. The author still comes from `og:title` (authority), so scanning the body for the scoped code is safe.
- `[gotcha]` **Editing a Threads post mints a NEW shortcode**; the old URL `302`s to `/?error=invalid_post`. The stored proof URL can therefore go stale if the user edits/deletes the post — accepted (a dead proof link is OK; no snapshots, §A.1).
- `[insight]` **Fail closed on the redirect host guard** — after following redirects, a missing/unparseable final URL is treated as **off-platform** and throws (a security-review hardening over the first draft, which skipped the guard when `resp.url` was empty). Real undici always populates `resp.url`, so this only fired in mocks — but the one trust-not-verify branch is gone.
- `[insight]` **commit-on-confirm in one transaction**: the slug-mint, `isMain` clear, `LinkedAccount`/`ProofRecord`/`bound`-event create, and request-`verified` flip all roll back together; a `P2002` on the `User.slug` unique index → `slug_taken` (first-claim-wins, proven by a rollback test).
- `[note]` **Re-validating an already-bound account is on-screen NOTIFY only** this slice (no write); the append-only `re_verified` refresh is deferred to Slice 5.

**Process learnings:**
- `[insight]` **Two-stage subagent review (spec compliance, then code quality) per task** caught issues a single pass wouldn't: an unescaped code interpolated into a regex, the fail-open host guard, a missing `proofPostUrl` transaction guard + an uncovered `not_resolvable` path, and a silent clipboard failure. Cheap to fix at the seam, expensive later.

## v0.8.1 — Avatar sharp/libvips runtime fix + imaging smoke gate (2026-06-16 10:05)

**Review:** not yet

**What was built:**
- **Root-caused & fixed the production avatar crash** (`ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file`). The libvips native lib ships in a *separate* package (`@img/sharp-libvips-linux-x64`); a clean linux install **does** fetch it (verified by simulating Vercel's `npm ci --os=linux --cpu=x64` from the lockfile → 18MB `.so` present), but Next's file-tracing can't follow sharp's runtime-resolved `require` into that sibling package, so the `.so` was missing from the serverless function bundle. Fix: **`outputFileTracingIncludes: { "**": ["node_modules/@img/**/*", "node_modules/sharp/**/*"] }`** in `next.config.ts`, plus `serverExternalPackages: ["sharp"]`.
- **Lazy `import("sharp")`** in `lib/identity/avatar.ts` (was a top-level import) — a bio-only profile save no longer loads the native module at all; sharp is loaded only when an avatar is actually processed.
- **Stopped swallowing the avatar error** in `app/onboarding/actions.ts` — non-`AvatarError` failures are now `console.error`'d (the original silent catch is why nothing showed in `vercel logs`).
- **`/api/health/imaging`** — new token-gated probe (reuses `HEALTH_CHECK_SECRET`) that runs the *real* `processAvatar()` on a 1×1 PNG, so it exercises sharp's native load on the deployed runtime. Returns `{imaging:"up"}` / 500 with the error.
- **Smoke gate:** `scripts/smoke.mjs` now asserts `/api/health/imaging` → 200 on preview **and** prod. Runs on every deploy via the existing `deployment_status` workflow → a sharp/native regression shows red on the PR (observational; a hard merge-block needs paid GitHub for this private repo).
- **Tests:** `lib/identity/avatar.test.ts` source-level guard (sharp must only be dynamically imported); `app/onboarding/actions.test.ts` behavioural (bio-only save completes; avatar upload degrades gracefully when sharp can't load).
- **Auth doc fix** (`.env.example` + login plan + devlog): `AUTH_REDIRECT_PROXY_URL` must be set on **Production** too, not only Preview — else preview login fails with `InvalidCheck: pkceCodeVerifier could not be parsed` (logged by *prod* during a *preview* login).

**Key technical learnings:**
- `[gotcha]` **sharp's libvips `.so` lives in a separate platform package** (`@img/sharp-libvips-linux-x64`), and Next's `@vercel/nft` tracing can't follow sharp's dynamic runtime resolution into it — so the binary installs at build time but never ships in the function. The fix is **`outputFileTracingIncludes`** for `@img/**`; **bundler-agnostic** (both Turbopack and `--webpack` failed without it, both work with it), and `serverExternalPackages` alone is *not* enough.
- `[insight]` **A tiny, auth-free, token-gated health probe that runs the *real* native code path** turned a multi-minute browser+login verification loop into a ~40s `vercel curl`. It falsified two wrong hypotheses (the `--webpack` build; a macOS-lockfile/install gap) with evidence before the real fix landed — and doubles as the smoke gate.
- `[gotcha]` **An eager top-level `import sharp`** loads the native module on *every* server action that shares that module file — including code paths that never call sharp (a bio-only save) — and crashes there. Lazy-import native deps. Vitest **can't** catch a regression here (its module mocks are lazy, so an unused eager import never triggers them) → guard it with a **source-level test** instead.
- `[gotcha]` **Swallowing an unexpected error into a generic user message with no `console.error`** makes production failures invisible in `vercel logs`. Always log the underlying exception.
- `[gotcha]` **`AUTH_REDIRECT_PROXY_URL` must be set on the PRODUCTION (stable) env too**, not just Preview — "if the variable is not set in the stable environment, the proxy functionality will not be enabled" (Auth.js). Without it, the prod callback handles the preview login locally, the preview's PKCE cookie isn't present, and it fails with `InvalidCheck: pkceCodeVerifier could not be parsed`. `AUTH_SECRET` must also be **identical** across prod + preview (the proxy verifies the OAuth `state` with it).
- `[note]` **GitHub branch protection / rulesets require a paid plan (Pro/Team) for *private* repos** — can't hard-block merges on Free. The smoke gate is observational until/unless upgraded.
- `[note]` **`vercel env pull` returns empty for *Sensitive* env vars**; **`vercel curl`** authenticates through Vercel Deployment Protection, so it's the way to hit a protected preview's API from the CLI.

**Process learnings:**
- `[insight]` **Verify the fix on the real runtime before declaring victory.** The `--webpack` change *looked* like the documented fix for a known Turbopack+sharp bug, but the imaging probe proved it still returned `imaging:"down"` on linux — only the file-tracing fix actually worked. Systematic, one-hypothesis-at-a-time debugging with a fast runtime signal beat plausible-but-wrong fixes.

## v0.8.0 — Slice 1: Foundation + Create Identity (2026-06-16 03:08)

**Review:** not yet

**Design docs:**
- Slice 1 — Foundation + Create Identity: [Spec](superpowers/specs/2026-06-16-mvp-wireframes-design.md) [Plan](superpowers/plans/2026-06-16-slice1-foundation-create-identity.md)

**What was built:**
- **`User`(正身) model delta** (§H.2): `slug` (citext, case-insensitive, `@unique`, nullable — *not* minted until main-account designation in Slice 2), `shortRef` (NOT NULL, `@unique`, base62 token), `updatedAt`. citext enabled via Prisma `postgresqlExtensions` preview + `extensions = [citext]`. Backfill-safe migration (nullable add → backfill existing rows → `SET NOT NULL` → unique indexes).
- **`shortRef` minted in the Auth.js `createUser` wrapper** — every 正身 gets a `/r/{shortRef}` token at creation, with regenerate-and-retry **only** on a `shortRef` unique violation (other P2002s, e.g. email, rethrow immediately).
- **`lib/identity/*` domain layer** (Vitest-TDD'd): base62 `generateShortRef` (unbiased `randomInt`); `sanitizeDisplayName`/`sanitizeBio` (strip control chars, reject HTML, length caps, 繁中 errors); `processAvatar` (MIME gate + sharp re-decode → WebP 512² cover, strips EXIF, rejects SVG/non-images) + `storeAvatar` (Vercel Blob, `VERCEL_ENV`-prefixed stable key); `repo.ts` (`findUserById/ByShortRef/BySlug`, `updateUserProfile`); `getCurrentUser()`.
- **`session.user.id`** surfaced via the database-session `session` callback (+ `types/next-auth.d.ts` augmentation).
- **UI:** 建立正身 **onboarding** (server page auth-gate + `useActionState` client form + `saveProfileAction`); owner-gated **`/r/{shortRef}`** pre-provisioned shell (banner + empty main-account slot stub; 404s to non-owners; permanent-redirects to `/gua/{slug}` once a slug exists); **`/gua/{slug}`** resolver shell (CI lookup, always 404s this slice) + generic **404** (no register CTA, §1.3); login `redirectTo: /onboarding`; Home links to `/r/{shortRef}` when signed in.
- **Vercel Blob provisioned** for avatars (services.md `Decided`→`Provisioned`); added `sharp` + `@vercel/blob`.

**Key technical learnings:**
- `[gotcha]` Adding a **NOT NULL column to a populated table** needs a 3-step migration (nullable add → backfill → `SET NOT NULL`). Prisma's `migrate dev --create-only` is **interactive** and aborts in a non-interactive shell — hand-author the migration folder + SQL and apply with `migrate deploy`.
- `[insight]` **sharp re-decoding the bytes is the real avatar gate**; the declared MIME is only a first filter. A spoofed content-type (SVG renamed `.png`) is caught by sharp's detected-format check, and re-encoding to WebP strips EXIF/any embedded payload.
- `[gotcha]` **`tsc --noEmit` typechecks test files** (tsconfig `include: ["**/*.ts"]`) but `next build` does **not**. The adapter's `insert` param had to carry `shortRef` and return `Awaitable` (the PrismaAdapter signature), not a bare `Promise`, to satisfy strict-function-type contravariance against both the real `base.createUser` and the test mock — a failure only `tsc` surfaced, not Vitest or the build.
- `[note]` **citext** stores the value case-preserving while making `@unique`/lookup case-insensitive natively — no `lower()` indexes or normalized columns needed.
- `[insight]` Under the **database** session strategy, `session.user.id` comes from the callback's `user` arg (the adapter row), not a JWT — so it's wired in the `session` callback, not `jwt`.

**Process learnings:**
- `[gotcha]` Control-char regexes and one test string literal in the plan doc had their **control characters flattened to spaces** when rendered/copied. Reconstructed them with explicit `\u` escapes (and a real control char where the test's intent required one) — a plan that embeds raw control bytes can't be copied verbatim; encode them.
- `[note]` Blob stores were **already provisioned** in `.env.local` (`BLOB_READ_WRITE_TOKEN` + `BLOB_STORE_ID`) ahead of this session, so Task 1's external Vercel-dashboard step was a no-op. Browser-based manual verification (Google login → avatar upload end-to-end, incognito 404 check) is still pending and left for the user.

## v0.7.0-design — MVP wireframes & page flows (2026-06-16)

**Review:** complete — a fresh-context consistency review (general-purpose subagent) mid-session caught a
dropped `§B` heading + a `§D.3`/`§H` "delete-binding vs commit-on-confirm" contradiction (both fixed);
then user-reviewed and **approved**.

**Design docs:**
- MVP wireframes & page flows: [Spec](superpowers/specs/2026-06-16-mvp-wireframes-design.md)

**What was built:** (design only — no code shipped)
- Wireframed all **9 MVP surfaces** against the spec §6 flows (used the brainstorming **visual
  companion**): Home (search box = placeholder, feature deferred), Create Identity onboarding, Add Account
  per-platform wizard, Identity Card (Accounts / Timeline / Manage tabs), and the pre-provisioned state.
- Settled English page names: Home / Create Identity / Add Account / **Identity Card** (驗明正身) /
  **Manage** (分身管理).
- Recorded a build sequence + **Slice-1 scope** for incremental implementation (spec §I).

**Key technical learnings:**
- `[insight]` **Removing the pre-declared handle forces commit-on-confirm.** Without a declared handle,
  the user first sees the *resolved* author at the success step → must be able to reject it. To let
  "wrong account" cancel without reversing an append-only `bound` event, the durable artifacts
  (`linked_account`, ledger event, slug) are written **only at the terminal confirm**; before that only
  the `binding_requests` row exists (`pending`/`resolved`) and simply expires if abandoned.
- `[insight]` **The first verification post is a short-URL design.** The slug can't exist at first-post
  time (derived from the not-yet-resolved author), so the post carries `/r/{short_ref}` — a short opaque
  token minted at account creation that 308-redirects to the slug once provisioned. Putting it on its
  **own `/r/` path** (not `/gua/`) makes refs and handle-derived slugs **collision-proof by construction**
  (a same-namespace short ref could squat a real handle someone later proves).
- `[insight]` **Slug minting = a deliberate "set 主要帳號" action, not silent on first bind** — resolves
  the routing-spec open slug-setup-UX question; confirm-as-slug forces the main account public (it's the
  public face).
- `[insight]` **Dropping the uniqueness lock → per-owner `linked_accounts` rows.** The same
  `(platform, account_id)` can be bound by multiple 正身 (each proves ownership); uniqueness moves to
  `(user_id, platform, account_id)`. Viewers disambiguate competing claims via the timeline
  (recency/condition); this also mooted the parent "sold → release lock" concern.
- `[gotcha]` **`updated_at` is for the future search feature, not the timeline.** The timeline must come
  from the append-only `binding_events` ledger — a single mutable `updated_at` can't represent a
  multi-event history (banned → recovered → banned).
- `[note]` **Decisions that change parent specs** (spec §A): proof snapshots **dropped** for MVP (link to
  live post; dead link acceptable) — reverses the §6.4 + CLAUDE.md locked decision; **IG/Threads-only**
  slug source (miin stays a binding platform but defers as a slug source — closes weak-platform
  squatting); **no self-service unbind** (bindings permanent; only status changes). All kept additive for
  Phase 2.
- `[note]` **Per-platform publish affordance:** Threads has a prefilled web compose intent (one-click
  post); IG can't prefill a feed caption + needs an image (copy-paste); miin copy-paste. The
  `PlatformAdapter` declares it — confirm the Threads intent empirically before build.

**Process learnings:**
- `[insight]` **Editing a long spec across many turns drifts.** A late insert silently swallowed the §B
  heading; the fresh-context reviewer caught it where the main loop (primed to think it's fine) didn't —
  the review-protocol payoff in miniature. Lesson: re-read structural anchors after big inserts.
- `[note]` Decided to build the MVP **incrementally** (one page/slice at a time, each its own
  writing-plans → execute → review → merge) rather than one-shot. Visual mockups persist under
  `.superpowers/brainstorm/` (gitignored).

## v0.6.0 — Auth.js site login (Google OAuth) (2026-06-15 20:53)

**Review:** complete — fresh-context code review (no critical/important issues) + **production login round-trip verified on `https://guasi.tw`** (seeded 正身 row confirmed in the prod Neon branch; login→logout→re-login all clean).

**Design docs:**
- Auth.js site login (Google MVP): [Spec](superpowers/specs/2026-06-15-authjs-site-login-design.md) [Plan](superpowers/plans/2026-06-15-authjs-site-login.md)

**What was built:**
- **Auth.js v5 (`next-auth@5.0.0-beta.31`) + `@auth/prisma-adapter`** wired into the App Router with
  **database sessions** (`session.strategy: "database"`) — server-side revocation, the foundation for
  §6.8 hacked-account flows. Route handler at `app/api/auth/[...nextauth]/route.ts`; `lib/auth/*` opens
  the auth seam (`adapter.ts`, `callbacks.ts`, `providers.ts`, `index.ts`).
- **Google is the only login method** (`providers.ts`); email magic-link/OTP stays deferred and additive.
- **`User` IS the 正身** — schema extended with app-owned `displayName`/`avatarUrl`/`bio`/`createdAt`
  alongside the Auth.js-managed columns; one migration adds `User`/`Account`/`Session`/`VerificationToken`,
  `HealthCheck` untouched.
- **Adapter `createUser` wrapper** folds email normalization + one-time profile seeding into the single
  `User` insert (seeds `displayName`/`avatarUrl` from the Google profile as editable defaults).
- **`signIn` callback rejects unverified Google emails**; non-Google providers pass through.
- **Login page** (`/login`, server-action Google button) + **app-shell login/logout** (`/` reads
  `auth()`, shows 已登入：<name> + 登出, or a 登入 link).
- **New Vitest harness** — pure-function unit tests (normalize/seed/signIn guard) run in `node` with no
  DB; one DB integration test exercises the real wrapped adapter against the Neon `vercel-dev` branch and
  **self-skips** when `DATABASE_URL` is unset, so `npm test` is green everywhere. 10 tests pass.
- **Post-merge fixes from smoke-testing:** un-nested the logout `<form>` from a `<p>` (invalid HTML →
  hydration error); added `suppressHydrationWarning` to `<body>` (browser extensions mutate it); locked
  **Traditional Chinese (zh-Hant)** as a project-wide convention in `CLAUDE.md`. Home/login headings set
  to 我是首頁 / 我是登入頁.

**Key technical learnings:**
- `[gotcha]` **next-auth v5 (`@beta`) declares a peer range of `next: ^14 || ^15`** — a plain
  `npm install` aborts with `ERESOLVE` against Next 16. Fix: `.npmrc` `legacy-peer-deps=true`, committed
  so Vercel's build install honors it too.
- `[gotcha]` **Next 16 renamed `middleware.ts` → `proxy.ts`** (old name still works). We built **neither** —
  route protection is out of scope for site login.
- `[insight]` **Seeding + email-normalization belong in the adapter `createUser` wrapper, not
  `events.createUser`.** One atomic insert with the normalized email and seeded profile; can't be skipped,
  no second write, and the mapping is a pure function we unit-test. `events.createUser` would fire *after*
  the row exists with a non-normalized email.
- `[insight]` **Vercel preview OAuth must proxy through prod via `AUTH_REDIRECT_PROXY_URL`** — preview URLs
  are dynamic and can't be pre-registered as Google redirect URIs, so register only prod + localhost and
  set the proxy URL on Vercel's Preview env (Auth.js v5's documented answer). **`AUTH_REDIRECT_PROXY_URL`
  must be set on the PRODUCTION (stable) env too, not only Preview** — "if the variable is not set in the
  stable environment, the proxy functionality will not be enabled" (Auth.js docs). With it missing on prod,
  the prod callback handles the preview login locally and dies with `InvalidCheck: pkceCodeVerifier could
  not be parsed`; `AUTH_SECRET` must also be identical across prod+preview. (Corrected 2026-06-16.)
- `[gotcha]` **`signInCallback`'s type needs a *double* `NonNullable`** — `NextAuthConfig["callbacks"]` is
  optional *and* its `signIn` member is optional, so `NonNullable<...>["signIn"]` still includes `undefined`
  and `tsc` rejects invoking it in tests. `NonNullable<NonNullable<...>["signIn"]>` strips it.
- `[note]` **Vitest loads `.env` into `process.env`**, so the DB integration test ran for real (not
  skipped) locally against the `vercel-dev` branch — Prisma Client itself doesn't load `.env`, but Vitest
  does.
- `[gotcha]` **The preview-proxy strategy can't smoke-test the *first* auth PR.** `AUTH_REDIRECT_PROXY_URL`
  routes preview OAuth callbacks *through production* (`https://guasi.tw/api/auth/...`) — but this is the PR
  that *introduces* those routes, so the prod callback **404s until merge**. Bootstrap gap: smoke-test
  **locally** (registered `localhost` redirect, no proxy) pre-merge, then on prod post-merge. Future preview
  PRs work fine once prod has the routes.
- `[gotcha]` **`<form>` cannot be nested inside `<p>`** (invalid HTML) — but neither `tsc` nor `next build`
  catches it; it only surfaces at **runtime as a hydration error**. The logout form shipped inside a `<p>`
  from the plan's literal JSX; fixed to a `<div>`. Build-green ≠ valid DOM.
- `[note]` **Browser extensions (Feedly's `data-feedly-mini`, Grammarly, etc.) mutate `<body>`/`<html>`
  before React hydrates**, producing an attribute-mismatch hydration warning that looks like our bug but
  isn't. The sanctioned fix is `suppressHydrationWarning` on `<body>` — safe because our own render there
  is deterministic. The dev-overlay call stack naming a `chrome-extension://…` script is the tell.

**Process learnings:**
- `[gotcha]` A **Google `client_secret_*.json`** downloaded from Cloud Console landed loose in the repo
  root and wasn't covered by `.gitignore` (creds already live in `.env`). Added a `client_secret_*.json`
  ignore rule before the first commit so the secret can't be committed.

---

## v0.5.0 — DB skeleton: Neon + Prisma + token-gated /api/health (2026-06-15 15:02)

**Review:** not yet

**Design docs:**
- DB Skeleton (Milestone 2): [Spec](superpowers/specs/2026-06-15-db-skeleton-design.md)

**What was built:**
- **Neon Postgres + Prisma 6.19.3** wired into the app — pooled `DATABASE_URL` for runtime queries,
  direct `DATABASE_URL_UNPOOLED` for migrations; `lib/db/client.ts` Prisma singleton (opens the
  `lib/*` seam).
- **Migrations in the pipeline** — `build: prisma migrate deploy && next build`, `postinstall:
  prisma generate` (both in `package.json`, no Vercel dashboard override).
- **Trivial `HealthCheck` model + first migration** (`init_health_check`) — proves the migration
  runs end-to-end without committing to the real §8 schema.
- **Token-gated `GET /api/health`** — checks `x-health-token` against `HEALTH_CHECK_SECRET` and
  returns 401 *before any DB call*; on success does a real `healthCheck.count()` →
  `{status,db,rows,time}`. `rows` exposes per-branch DB isolation directly in the response.
- **Per-preview Neon branching** via the Neon–Vercel integration — each preview deploy gets its own
  branch off `production`, auto-deleted on merge; prod hits the `production` branch.
- **Repo's first GitHub Action** — `scripts/smoke.mjs` (zero-dep) + `.github/workflows/smoke.yml`,
  a post-deploy smoke test on `deployment_status` (prod: apex + www + health; preview: health; with
  the Vercel automation-bypass header). Prod run: **4/4 green**.
- Docs: the milestone execution spec, plus README / `services.md` / `operating-costs.md` updates;
  `deployment.md` §5 ticked.

**Key technical learnings:**
- `[gotcha]` **Vercel preview deploys sit behind Vercel Authentication (SSO).** Any automated probe
  (curl, the smoke Action) gets a *false 401* — the SSO wall, not the app — *before* reaching the
  route. Fix: enable **Protection Bypass for Automation** and send `x-vercel-protection-bypass`. The
  **production custom domain (`guasi.tw`) is exempt**; only preview + generated prod `*.vercel.app`
  URLs are gated.
- `[insight]` **Preview DB env vars are injected per-deployment, not as static project vars.** With
  preview branching on, the integration sets `DATABASE_URL`/`DATABASE_URL_UNPOOLED` on each preview
  *at deploy time* (→ that deploy's branch), so the "Preview" column in Settings is **blank by
  design** — empty-Preview is correct *iff* branching is on, broken if it's off.
- `[insight]` The integration **auto-creates a `vercel-dev` branch** for Vercel's Development env;
  point local `.env` at it instead of a hand-made `dev` branch, or you get two drifting dev DBs.
- `[gotcha]` **`prisma@latest` is now 7.x (7.8.0)** — pinned **6.19.3**: Prisma 7's `@prisma/dev`
  pulls a vulnerable `@hono/node-server` (3 moderate advisories; `npm audit fix` *downgrades to 6*),
  and 7's new mandatory-output/ESM generator is churn a trivial skeleton doesn't need.
- `[insight]` **Token-gate the health route as cost control, not authzn.** Rejecting before the DB
  read means an anonymous flood costs ~nothing — no billed Vercel invocation work, no warm Neon
  compute (which would defeat scale-to-zero). An auth wall wouldn't help and isn't available pre-auth.
- `[note]` **Connecting an *existing* standalone Neon project to Vercel is done from the Neon side**
  (Neon → Integrations → Vercel). Vercel's Storage → "Create" only provisions a *new, Vercel-managed*
  DB — keeping the project standalone preserves the §12 portability / GCP escape hatch.
- `[note]` **`deployment_status` workflows fire from the *deployed ref's* workflow file, not only
  `main`.** The smoke Action ran on this PR's previews *before* merge (pre-bypass runs failed
  correctly on the SSO wall, then went green) — no chicken-and-egg, contrary to my initial assumption.

**Process learnings:**
- `[insight]` **Split operator-driven vs in-repo phases in the execution spec.** Phases A–B (Neon
  project, integration, env vars/secrets — all dashboard work) gated Phase C (code). Writing them as
  separate checklists with explicit "report back X" handoffs kept the dashboard round-trips crisp.
- `[gotcha]` Background `next start` left port 3000 held; a later `npm start` died `EADDRINUSE` and a
  stale server served an *old* build — a verification read silently showed the pre-change response.
  Kill `lsof -ti:3000` before re-verifying after a rebuild.

## v0.4.1 — Post-launch ops & decisions (2026-06-15 12:29)

**Review:** not yet

No app code shipped — Vercel/Git config + ops docs + decisions on top of the v0.4.0 release
(so no new git tag). Capturing the learnings before they're lost (only committed docs carry forward).

**What was built / decided:**
- **Tagged `v0.4.0`** and refreshed `CLAUDE.md` to "implementation started."
- **Vercel Ignored Build Step** configured to **skip docs-only deploys**; verified live (three
  docs commits each "Canceled by Ignored Build Step"). Recorded in `deployment.md` §2.
- **README status badges** — live up/down for `guasi.tw` + `www.guasi.tw` (shields `website`) + a
  "Deployed on Vercel" link badge.
- **New `docs/operating-costs.md`** — cost ledger (Vercel Pro $20/mo, domain $29.99/yr, free-tier +
  anticipated; ~$270/yr run-rate).
- **New `docs/services.md`** — single inventory of every service/account (Active / Decided / Anticipated).
- **Email architecture decided & recorded** (spec §12, cost ledger, `CLAUDE.md`): send transactional
  mail via **Resend from a `send.guasi.tw` subdomain**; keep **iCloud Custom Email on the root** for
  *receiving* only.

**Key technical learnings:**
- `[gotcha]` **Vercel Hobby can't deploy a private repo owned by a GitHub org** — only
  *personal-account* private repos. That (not "commercial use" in the abstract) is why **Pro
  ($20/mo) is required**; the only free alternatives were *make the repo public* or *move it to a
  personal account*.
- `[gotcha]` **Vercel has no native `[skip ci]`.** Skipping is *only* via the **Ignored Build Step**
  (exit `0` = skip, `≥1` = build). It also **moved** in the UI — now under **Settings → Build and
  Deployment** with a Presets / Repository-Scripts / Custom picker, no longer under Git.
- `[insight]` **For skip rules, deny-list beats allow-list.** "Build *unless* only docs changed"
  (`git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md' ':(exclude)docs'`) auto-covers new
  code/config; the "only build if folder X changed" preset would wrongly skip root changes like
  `package.json` / `next.config.ts`.
- `[note]` The Ignored Build Step posts a **transient `pending`** commit status first, then flips to
  "Canceled by Ignored Build Step" (state `success`) — don't check too early. `HEAD^` is available
  (Vercel clones `--depth=10`).
- `[note]` **No official Vercel deploy-status badge**; community ones read GitHub's deployment API,
  which **can't see a private repo** — so used shields.io **`website` up/down** badges (they ping the
  live URL, independent of repo visibility).
- `[insight]` **Email: receiving ≠ sending.** iCloud Custom Email is a personal *mailbox* (receiving;
  no sending API; ToS bans automated/bulk) — never send app mail through it. Best practice: mailbox
  provider on the **root** (receiving) + ESP on a **subdomain** (sending) to isolate DNS + reputation.
  Don't remove iCloud to "use the domain for the app" — that conflates the two jobs and just loses the inbox.
- `[note]` **Don't nuke the GoDaddy zone** to add a web host — `guasi.tw` already runs iCloud email
  (MX/SPF/DKIM/DMARC/apple-domain); only the apex `A` + `www` CNAME changed for Vercel.

**Process learnings:**
- `[insight]` **Decisions live in docs, learnings live in the devlog.** `services.md` (inventory) +
  `operating-costs.md` (ledger) + spec §12 (rationale) hold the *decisions*; the devlog holds the
  *learnings*. Only committed docs carry to the next session — so record decisions in docs
  immediately, and write up learnings at session end.
- `[note]` **Verify vendor facts, don't recall them.** Several assumptions this session were wrong
  until checked (no `[skip ci]`, the IBS UI moved, no Vercel badge, the org-repo Pro gate) — a quick
  search each time corrected them.

## v0.4.0 — Walking skeleton: scaffold, Vercel CI/CD & guasi.tw live (2026-06-15)

**Review:** not yet

**Design docs:**
- Walking skeleton (scaffold + CI/CD + domain): [Spec](superpowers/specs/2026-06-15-walking-skeleton-design.md)

**What was built:**
- **First code in the repo:** a flat **modular-monolith Next.js scaffold** (Next 16 + React 19 +
  TypeScript, App Router) — `app/` only; `lib/` and `prisma/` deferred until product code lands.
  Considered and rejected a workspaces / Turborepo monorepo (only one deployable today, and
  `prisma/` lives in-repo either way).
- A minimal on-brand **hello-world landing** (`我是正身`, `zh-Hant`); `npm run build` green (static `/`).
- **Vercel CI/CD** wired via the GitHub integration — `push main` → production, PR → preview.
  Project **`guasi-app`**.
- **`guasi.tw` bound** — apex `A → 216.198.79.1` + `www` CNAME at **GoDaddy**, SSL auto-issued,
  `www` 308-redirects to apex.
- New **execution spec** (`2026-06-15-walking-skeleton-design.md`) as a per-session tracker
  (north star: `deployment.md` §5); **README** gained a **Deployment & CI/CD** section;
  `deployment.md` §5 + the `todo.md` hello-world item ticked.

**Key technical learnings:**
- `[gotcha]` **`npm audit fix --force` wanted to downgrade Next 16 → 9.3.3** to clear a
  *transitive* `postcss` advisory (GHSA-qx2v-qp2m-jg93). The right fix for a transitive dep is an
  npm **`overrides`** pin (`postcss: ^8.5.15`) — bumps it without touching Next; `npm audit` → 0.
- `[gotcha]` **Vercel now hands out a *new* IP range.** Apex `A → 216.198.79.1` (not the
  long-documented `76.76.21.21`) and a **project-unique** `www` CNAME
  (`…vercel-dns-017.com`, not the generic `cname.vercel-dns.com`). Use exactly what the Domains
  page shows — the generic values still work but are the old path.
- `[insight]` **Don't nuke the GoDaddy zone to add a web host.** `guasi.tw` already ran **iCloud
  Custom Email Domain** (MX + SPF/DKIM/DMARC + `apple-domain` TXT). Only the apex `A` (a GoDaddy
  WebsiteBuilder record) and the `www` CNAME needed changing; deleting the rest would have killed
  email. Edit the two web records, leave NS/SOA/MX/TXT/DKIM alone.
- `[gotcha]` **`create-next-app` refuses a non-empty dir** — `CLAUDE.md`/`todo.md` trip its
  empty-folder check, so the scaffold was hand-rolled. Also the root `tsconfig` must **exclude the
  gitignored `pitch-deck/`** workspace, or its own deps fail the Next typecheck.
- `[note]` **Bootstrap ordering:** importing a repo makes Vercel immediately deploy `main`, so the
  scaffold had to land on `main` *before* the import — else the first production build has nothing
  to build.
- `[note]` Vercel **auto-named the project `guasi-app`** from `package.json` (not the `guasi-web`
  the convention suggested) — cosmetic/internal; the domain is attached separately.

**Process learnings:**
- `[insight]` **The structure question was worth stopping for.** The user paused the scaffold to
  reconsider monorepo-vs-monolith; laying out three concrete options (folder-tree previews +
  trade-offs) surfaced that the stated "I want a monorepo" actually resolved to the flat monolith
  once "the DB schema is in-repo either way" was made explicit.
- `[note]` **A doc-closeout PR doubles as preview-deploy verification** — opening it makes Vercel
  build a preview, exercising the `PR → preview` half of CI/CD that a straight-to-`main` flow never
  triggers.

## v0.3.0-design — Routing, ID provisioning & platform verification (2026-06-15)

**Review:** not yet

**Design docs:**
- Routing, ID provisioning & squatting: [Spec](superpowers/specs/2026-06-15-routing-and-identity-design.md)
- Platform read-mechanics: [`platform-verification.md`](platform-verification.md) (capability matrix + evidence log; not a specs/plans doc)

**What was built:**
- **New routing-and-identity spec** (`superpowers/specs/2026-06-15-routing-and-identity-design.md`): URL route table + state behavior; the slug-location decision (**decided: `/gua/{id}`**); proof-gated ID-provisioning lifecycle (email → internal uuid → first bind → permanent slug → 308 redirect); abandoned-account cleanup; `is_main` vs permanent-slug overlap; the ID model (**decided: handle-derived, all-3-platforms-as-source, immutable**); and squatting/collision protection via proof-gated claiming + platform-priority + transparency.
- **New `docs/platform-verification.md`** — empirical capability matrix for reading **author** + **code-bearing text** across Threads / IG / miin.cc, for both **post** and **bio** methods. Includes copy-paste read recipes, the URL-handle spoof proof, a Vercel render-weight ladder, the unified verification algorithm, and an evidence log of every URL tested.
- **Corrected the parent spec's naive "public web fetch returns the author"** assumption (it returns a JS app-shell) and slimmed the routing spec's §5 to a pointer at the verification doc.
- **Found miin's public JSON API** (the lightest render path, a pure `fetch()`) and **proved headless render works** as the fallback; **moved miin into MVP** — MVP platforms are now **Threads + IG + miin.cc**. All three are live handle sources at launch (raising the weak-platform-squatting concern to MVP scope).
- Updated `CLAUDE.md` docs index with both new docs.

**Key technical learnings:**
- `[insight]` **Meta serves two different pages by User-Agent.** Threads/IG return a JS app-shell + consent gate to a browser UA, but **server-render full OG/AL meta to a crawler UA** (`facebookexternalhit/1.1`). That crawler-SSR is the tokenless way to get **both** author (`og:title`/`og:url`) and content (`og:description`) — no Meta token needed for MVP.
- `[gotcha]` **Never trust the @handle in a pasted post URL.** Meta serves the same post under *any* path handle (HTTP 200) — I pasted `@zuck` and `@notreal999` for someone else's post and Meta still canonicalized `og:title`/`og:url` to the **true author**. Read the author from the platform's authoritative response only; trusting the path enables an identity-takeover.
- `[gotcha]` **Threads migrated to `threads.com`** — `og:url` returns `threads.com`, not `threads.net`. The canonical-host allowlist must accept both.
- `[gotcha]` **IG profile bio is NOT in OG tags** (the IG profile `og:description` is a fixed follower-count template — confirmed on a 1.6k-post account). So bio-verification on IG needs a token/headless; the **post caption**, by contrast, *is* in `og:description`. Use the post method on IG.
- `[gotcha]` **IG crawler-SSR is occasionally throttled** — one isolated fetch returned no OG tags (which briefly led me to a wrong "IG caption unreadable" conclusion). On retry it's reliable (12/12). Mitigation: **retry once on incomplete SSR**.
- `[insight]` **The lightest way to render a SPA on Vercel is to not render it.** miin is a client-rendered Next.js SPA (no SSR author), but sniffing its network calls revealed a **public, unauthenticated JSON API** (`api.miin.cc/web/story/v3/story?storyId=…`, `…/v2/user/page?userId=…`) returning structured author + full untruncated text + bio. A plain `fetch()` beats both OG-scraping and a headless browser.
- `[note]` **miin API text shape:** short posts carry text in `title[]`, long posts fill `content[]` (415-char body returned in full) — scan both; no truncation (unlike OG `og:description`).
- `[insight]` **Anti-squatting and free-choice naming are in tension.** Proof-gated claiming (slug must equal a handle you proved) delegates KOL protection to the platforms that already authenticated them — but it reintroduces cross-platform handle collisions. Free guasi-native names avoid collisions but reopen squatting. Decision deferred.
- `[note]` **Meta public oEmbed is gone** (`instagram_oembed` needs an app token with `oembed_read`); not required given crawler-SSR works tokenless.
- `[note]` **Vercel headless pattern** = `puppeteer-core` + `@sparticuz/chromium` (the full `puppeteer` Chromium is too big for Lambda), ≥1024 MB function, raised/background timeout — heavy and async; fallback only.

**Process learnings:**
- `[insight]` **Empirical testing flipped my conclusions twice** — "IG caption unreadable" → readable-but-throttled, and "miin needs headless" → public JSON API. Verify platform behavior with real fetches against real URLs; reasoning from memory about how Meta/SPAs *should* behave was wrong both times.
- `[insight]` **Splitting an overgrown spec into a focused companion + a dedicated reference doc** kept each concern legible; the routing spec now points at the verification doc instead of duplicating (and drifting from) its mechanics.

## v0.2.0-design — Verification security model & Vercel stack lock-in (2026-06-15 00:29)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- **Verification security model locked** (§6.2/§6.3/§8): the **bound 分身 is the proof post's author**, resolved from platform authority (oEmbed/API or strictly-validated canonical URL) — never user-supplied page content. The **auth code is scoped to one binding request, single-use, and expiring**. Replaced the `auth_codes` table with **`binding_requests`**; narrowed `linked_accounts.status` to `verified | unbound`.
- **Author-match target clarified**: it's the *specific 分身*, never the 正身 identity name or the `@gua.si.tw` tag; **many 分身 per platform** allowed, each its own binding request. Added a "three distinct handles" note to the spec.
- **Manual paste-back set as the MVP primary path** (synchronous, more responsive); tag-based mention auto-capture deferred to Phase 2. Added new threat rows (copy-paste/stolen-code abuse, spoofed post page) + an author-integrity requirement (§6.3).
- **MVP stack locked — all on Vercel** (§12): Next.js + TypeScript; **Neon** serverless Postgres via Prisma; **Auth.js** with **Google OAuth + email magic-link/OTP** (Prisma adapter, verified-email account linking); **Vercel Blob** for snapshots + avatars; async screenshot/archive via a serverless queue calling an **external screenshot API**. GCP kept as a portable escape hatch.
- Updated `CLAUDE.md` (locked decisions + Vercel stack), `todo.md` (hosting + security checked off; auto-capture → Phase 2 section; **added hello-world landing page on Vercel bound to `guasi.tw`** as the first implementation step).
- Made the three `guasi.tw` mentions in the (local, gitignored) pitch deck clickable to `https://guasi.tw`.

**Key technical learnings:**
- `[insight]` **The copy-paste-to-my-wall attack is defeated by two independent gates, not by code secrecy.** (1) The bound account *is* the post author resolved from the platform — you can't make an account you don't control author a post. (2) The code is scoped + single-use + expiring, so a copied post carries someone else's code, useless in any other session.
- `[gotcha]` **Resolve the post author from the platform's authority, never from the pasted page.** If you read the author from user-supplied page content, an attacker pastes a URL to a page *they* control that mimics any author — defeating the whole author-match gate. Accept only canonical platform URLs → oEmbed/API.
- `[insight]` **Manual paste-back is *more* responsive than the "premium" auto-detect.** A mention webhook is lossy + laggy (a poller adds poll-cycle latency) and needs a business account + app review + a live Meta token. Pasting the URL verifies synchronously in seconds and removes the platform dependency. The fancier option was strictly worse here.
- `[insight]` **Don't size hosting on read QPS.** "1000 QPS public querying" is cache-dominated: with cache-on-write (`revalidateTag`) the origin sees near-zero. The real cost sink is the per-verification **snapshot pipeline** (headless browser / screenshot), not reads.
- `[gotcha]` **Serverless + Postgres needs connection pooling.** With Prisma on Vercel: pooled connection string for queries, **direct** URL for migrations — skip it and concurrent functions exhaust the connection limit.
- `[insight]` **Three distinct handles must not be conflated**: `@gua.si.tw` (service tag, not a check), the 正身 identity name (site profile, not a check), and the 分身 handle (the only one the author-match uses).
- `[note]` **Site-login OAuth ≠ identity-verification OAuth.** Google login for `guasi.tw` doesn't touch the §6.1 "no platform OAuth for identity" rule — different OAuth, different purpose, no Meta gatekeeping.
- `[note]` Vercel's on-demand ISR / `revalidateTag` natively implements the "cache public pages, expire from the management side" pattern.
- `[note]` **Lucia was deprecated as a library in 2025** (now a learning resource) — use **Auth.js (NextAuth v5)** instead.

**Process learnings:**
- `[insight]` **Pressure-test stated scale numbers before pricing anything.** The "1000 QPS / 100 QPS" figures were guesses; deriving the realistic load profile (cache-dominated reads, bursty writes, snapshot-bound compute) changed the hosting answer by orders of magnitude and avoided over-engineering.

## v0.1.1-design — Snapshot, ledger, status & naming (2026-06-14 23:11)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- Folded a trusted reviewer's notes ([`first_thought.md`](first_thought.md)'s sibling [`random_thoughts.md`](random_thoughts.md)) and several new decisions into the spec.
- **Proof snapshot at verification time** (§6.4) — capture content + screenshot + third-party archive, so a proof survives the account/post being banned.
- **Append-only public ledger** (§6.6), **unbinding** with reasons (§6.5), **verification timeline** (§6.7).
- **Account status management** (§6.8) — owner marks banned/hacked (self-service) vs unbanned/reclaimed (re-verify).
- **正身 profile** (§4) — avatar, brief description, and a designated **main 分身** (an `is_main` flag on a bound account, not a free-form URL; defaults to the first verified 分身, changeable on 分身管理). Public 驗明正身 page = a Linktree-like profile for a *verified* identity.
- **Verification-post flow** (§6.2) — choose platform → copy-paste template (6-digit code + `@gua.si.tw` tag + 驗明正身 URL) → post → paste URL or tag auto-capture.
- Finalized naming: concept term **正身**, brand/domain **我是/`guasi`** (`guasi.tw` registered), tagline **我是正身**, UI terms 建立正身 / 註冊分身 / 驗明正身.
- Built a 13-page open-slide pitch deck (kept local, gitignored — not committed).

**Key technical learnings:**
- `[insight]` **A banned account's proof post dies exactly when the proof matters most.** Snapshot + independently archive at verification time; don't store a live URL. A self-captured snapshot is "trust the site," so a third-party archive (+ Phase 2 crypto timestamp) is what makes it independently credible.
- `[insight]` **Status-change asymmetry.** Trust-*reducing* claims (banned/hacked) can be self-service (login only) — they can't be abused to impersonate, and a hijacker can't remove a flag on the 正身 they don't control. Trust-*restoring* claims (recovered) must be re-verified.
- `[insight]` **The verification post is the growth engine.** Public + tags `@gua.si.tw` + links back to the user's page → every proof markets the service. This is the built-in answer to 行銷困難.
- `[insight]` **Separate "OAuth for identity" from "API for reading a post."** Reading/auto-capturing posts via platform API is fine; tying *identity* to Meta OAuth is not.
- `[gotcha]` **Instagram caption links aren't clickable** (Threads' are), and IG posts need an attached image. Keep the URL short/typeable and lean on the IG bio link.
- `[note]` 6-digit auth code suffices — security is author-match + expiry + single-use, not code entropy.

**Process learnings:**
- `[insight]` **Brand name vs concept term can be split deliberately.** Letting 正身 carry the meaning frees the domain (我是/guasi) to be simple; they compose into the tagline 我是正身. Avoids two competing "clever" names.
- `[note]` Domain discovery matters less than the social handle for this product, so `.com`/`.id` are optional later pickups; `guasi.tw` is enough to launch.

## v0.1.0-design — Design & pitch (2026-06-14 20:54)

**Review:** not yet

**Design docs:**
- 正身 identity verification: [Spec](superpowers/specs/2026-06-14-identity-backup-design.md)

**What was built:**
- Turned the raw idea ([`first_thought.md`](first_thought.md)) into a full product + architecture design spec.
- Wrote a non-technical product pitch ([`product-pitch.md`](product-pitch.md)) organized by actor (the website, the KOL, the public viewer).
- Created project [`CLAUDE.md`](../CLAUDE.md) capturing locked decisions and open questions for resuming work.
- Initialized git (local only, private) and made the first commit. No remote yet.
- Chose the name 正身 (tsiànn-sin); fallback 是我啦 (sī guá lah).

**Key technical learnings:**
- `[insight]` **Verify while accounts are alive.** A banned account can no longer prove ownership, so the product only has value if users register and cross-link *before* a ban. This single constraint drives the whole UX (push pre-emptive verification).
- `[insight]` **Persist immutable proof records, not a `verified` boolean.** Storing `(platform, account_id, proof_post_url, auth_code, fetched_author_id, verified_at)` is what makes the Phase 2 "publicly-verifiable proofs" upgrade additive instead of forcing a re-verification of every user.
- `[insight]` **Separate "OAuth for identity" from "API for reading a post."** Verification must NOT depend on Meta OAuth (else Meta gates who gets verified — fatal for an anti-ban product). But using a platform API (oEmbed) just to *read* a public post is fine. Keep web-fetch as a fallback so a revoked API token can't take the service down.
- `[note]` Verification mechanism is public-post + one-time auth code (no DMs — DM automation violates ToS and risks banning the service's own accounts).
- `[note]` Prior art to study: Keybase (public proofs), Mastodon `rel="me"`, Bluesky domain handles.

**Process learnings:**
- `[note]` Git privacy is about the *remote*, not git itself — `git init` is fully local/private; staying private until MVP just means no public remote (a private remote is also an option for backup).

**Open questions:**
- Domain name (Hokkien romanization is hard to type; candidates: `thereal.me`, `whoami.tw`, `iam.tw`, `itsme.la`).
- Cloud provider: GCP vs AWS.
- Per-platform post-fetch strategy (oEmbed vs web fetch).
- Auth-code format/expiry; public-lookup query shape (handle vs URL).
