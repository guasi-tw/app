# Product & Identity Decisions

The maintained home for guasi's **product/identity design decisions** — public-URL routing,
slug provisioning, anti-squatting, binding uniqueness, platform-icon identity, and timeline
visibility. These were originally worked out in
the now-historical `docs/superpowers/specs/*` (routing-and-identity + mvp-wireframes); this doc
is the **current, authoritative** version and supersedes the specs where they differ.

> Keep this current when an identity/URL/binding policy changes. CLAUDE.md "Locked decisions"
> holds the one-liners; this doc holds the rules + rationale. Route mechanics (which file serves
> which URL) live in [`routes.md`](routes.md).

## Public URL & slug

- **`/gua/{slug}`** is the public Identity Card URL. The `/gua/` prefix **isolates the profile
  namespace** from `/login`, `/api`, etc. — so **no reserved-word list is needed** — and reinforces
  the brand. Accepted cost: the verification-post URL is ~4 chars longer than a root `/{handle}`.
- **The slug is a *proven handle*** — to hold `/gua/alice` you must have verified a 分身 whose handle
  is `alice`. This makes squatting structurally impossible for unique names (see Anti-squatting).
- **Slug sources = Instagram + Threads only (MVP).** A slug may be minted **only** from an IG or
  Threads handle. **miin.cc is a full binding/verification platform but is NOT slug-eligible** —
  whether miin ever becomes a slug source is **deferred**. (This is what *closes* the weak-platform
  squatting hole for MVP rather than merely mitigating it — see below.)
- **Minted at main-account designation**, behind an explicit **permanence gate**
  (`公開後將永久顯示…無法更改`). The 設定主要帳號 action is *what triggers* slug minting.
- **Frozen / immutable** after minting — never changeable, so every permalink and verification post
  that linked back stays valid forever. **Decoupled from the live handle:** if the user later renames
  or sells the source account, the slug stays (the proof record captured the binding at the time).
- **Slug ≠ `is_main` — separate fields.** The slug is the frozen, handle-derived public ID; `is_main`
  is a *changeable* "which 分身 to feature." Conflating them would break every permalink when the user
  changes their featured account.
- **First-claim-wins** on the slug string. The guarantee is the `users.slug` **unique index**
  (case-insensitive `citext`); the pre-offer availability check is UX only (a concurrent race is
  caught at commit). **No synthetic / disambiguated variants** (`alice-ig`, `alice2`) are offered —
  that would break the invariant that *every slug is exactly a proven handle*. If a handle is taken,
  the user picks another IG/Threads handle they can prove, or stays pre-provisioned.
- **Short links live in their own path `/r/{shortRef}`**, separate from `/gua/{slug}`, so refs and
  handle-derived slugs **cannot collide**. A pre-provisioning verification post links to `/r/{ref}`,
  which **308-redirects to `/gua/{slug}` once the slug is minted** — the link stays valid forever.

## Binding uniqueness

Per-**正身**, **not** global — `@@unique([userId, platform, accountId])`. The same platform account
can be legitimately bound by different 正身 (shared / transferred ownership); they're disambiguated by
驗證時間, never blocked. There is **no** global "one owner per account" lock. (Also in CLAUDE.md
Locked decisions.)

## Trust & proof model

- **Centralized DB for MVP, but persist *immutable proof records*** — not just a `verified` boolean.
  `ProofRecord` captures the binding as it was at verification time, so **Phase 2 publicly-verifiable
  proofs are additive** (no re-architecture, no backfill).
- **Proof snapshot — deferred to Phase 2; MVP links to the live post.** The long-term plan is
  self-contained evidence (post **content + screenshot**) plus a **third-party archive**, because a
  banned account's post is gone exactly when the proof matters most. **MVP ships link-to-live-post
  only:** `ProofRecord` stores the canonical `proofPostUrl`; the snapshot/archive columns already exist
  but sit unused until Phase 2 (**additive — no migration needed then**).

## Verification & binding

- **Verification model — public-post proof only.** No DMs. **No platform OAuth for identity** — so Meta
  (or any platform) can't gate who gets verified. (This is separate from *site login*, which is Google
  OAuth — logging in with Google ≠ proving you own a Threads/IG account.)
- **Older = more credible.** The product surfaces *when* each account was verified; an older verification
  is stronger evidence. This is the principle behind the Timeline's oldest-first ordering (see
  [Timeline visibility & rendering](#timeline-visibility--rendering)).
- **Binding flow (§6.2).** User picks a platform (optionally pre-declares the handle — a confirmation aid
  only) → guasi returns a **copy-paste template** containing a **6-digit auth code**, the **`@gua.si.tw`
  tag**, and the user's **驗明正身 page URL** → user posts it → **pastes the post URL back**. **Manual
  paste-back is the MVP primary path** (synchronous + more responsive than a mention webhook;
  auto-capture deferred to Phase 2). **The verification post doubles as the growth engine** (public +
  links back) — the built-in answer to 行銷困難.
- **Verification security model (§6.2/§6.3/§8) — author-match, not entropy.** The **bound 分身 is the
  proof post's author, resolved from platform authority** (oEmbed/API, or a strictly-validated canonical
  URL — *never* user-supplied page content). The author-match target is the **specific 分身**, never the
  正身 identity name and never the `@gua.si.tw` tag. **Many 分身 per platform** are allowed — each is its
  own binding request. The **auth code is scoped to one binding request, single-use, and expiring**, so a
  leaked/copied code is useless in any other session; **6 digits is enough** because security =
  author-match + scope + expiry, not code entropy. (Data model: the `binding_requests` table holds the
  pending state.) Note: **IG caption links aren't clickable; Threads' are.**
- **Reading the post — per-platform, with a web-fetch fallback.** Platform API (oEmbed) *or* public web
  fetch is acceptable, chosen per-platform; keep web fetch as a fallback so a revoked API token can't take
  the service down. **Shipped: Threads via tokenless crawler-UA SSR.** Settled per-platform mechanics live
  in [`platform-verification.md`](platform-verification.md).

## 正身 profile & main 分身

- Each 正身 has an **avatar, brief description, and a designated main 分身** — an **`is_main` flag on a
  bound account**, *not* a free-form URL; **at most one per user**.
- **The first binding is accepted as the main 分身** — and that designation is **what mints the slug**
  (see [Public URL & slug](#public-url--slug)). It is **changeable later** on the 分身管理 page; the slug
  it minted does **not** change (slug ≠ `is_main` — see Public URL & slug).
- The public **驗明正身** page is a **Linktree-like profile for a *verified* identity**.

## Account status & lifecycle

- **Append-only public ledger.** Bindings and unbindings are **permanent events, never deletions**.
  **Public = permanent** (an unbind is a *visible* event); **private stays private**. All status changes
  are ledger events surfaced on the Timeline.
- **Account status management (§6.8) — owner self-service, trust-lowering only.** The owner can mark a
  分身 **banned/hacked** while logged in. These flags only *lower* trust, so a hijacker can't usefully
  set them, and — crucially — **can't remove a flag they don't control**. Marking an account
  **recovered/unbanned requires re-verification** (`恢復·重新驗證` — a trust-*restoring* claim must be
  re-proven, not self-asserted).
- **Unbinding — deferred (no self-service unbind in MVP).** The model treats unbind as a permanent ledger
  event with a reason (hacked / unneeded / sold), but **MVP ships no unbind UI** — trust-lowering is the
  condition flags above + `恢復·重新驗證` only (the `unbound` status is reserved in the schema).

## Anti-squatting

- **Core mechanism — proof-gated claiming (delegate to the platforms).** To claim `/gua/taylorswift`
  you must prove control of `@taylorswift` on a supported platform. A squatter can't; the real owner
  can. Threads/IG already solved "who is the real Taylor Swift" — guasi **inherits** that for free.
  No reserved-celebrity database to maintain.
- **Weak-platform hole — closed for MVP.** The residual attack ("squatter grabs the KOL's handle on a
  low-authority platform, then mints the slug") is **eliminated for MVP by the IG/Threads-only slug
  rule** — miin (the lowest-authority source) can't mint a slug at all. If miin (or another
  low-authority platform) ever becomes slug-eligible, re-introduce these mitigations:
  1. **Challenge / reassign** — a higher-authority proof of the same handle can challenge a slug backed
     only by a low-authority platform.
  2. **Transparency** — the public card shows which platform(s) back the slug (a miin-only slug reads
     as suspicious on its face).
  3. Optional small **pre-launch reserved list** for ultra-high-value names (manual review; not a
     maintained database).
- **Genuine same-name collision** (two different real people each own "alice" on different platforms):
  unavoidable when handles are per-platform unique. **First-claim-wins**; the loser claims a slug from
  another handle they can prove.

## 404 & anti-enumeration

- **Generic "user not found"** for any missing / unprovisioned / released slug — never reveal
  availability (hides *who is registered on guasi*).
- **No register CTA on the 404 page** (prevents availability probing); the register CTA lives only on
  `/`.
- **Bare `/gua/`** → anonymous redirects to `/`; logged-in redirects to their own profile.
- A 正身 with **no public slug has no public URL** to visit or guess — it exists only at `/r/{shortRef}`
  for the owner.

## Pre-provisioned state

A 正身 whose only verified 分身 is on **miin** (or who hasn't designated a main account) **stays
pre-provisioned** — no public `/gua/{slug}` — until they verify an **IG or Threads** account to mint
the slug. Binding still works and the account persists; only the public URL waits.

## Platform icon brand identity

Platforms must be **distinguishable at a glance** wherever an account's platform is shown (the add
picker, the per-platform add page, the Accounts tab, the Timeline). The rule:

- **Each platform renders in its own brand identity.** Three treatments: a platform with a **colorful
  symbol** shows in its brand color/gradient (e.g. **Instagram → its diagonal gradient**); a
  **monochrome** brand (e.g. **Threads**) renders in `currentColor` (white on the dark theme); a
  **colorful-wordmark** brand (e.g. **miin** — light-on-dark rainbow wordmark, no separate symbol) is
  reproduced as a **tiled mini app-icon** (dark rounded square + the wordmark masked over a gradient).
  This is what makes platforms instantly tellable apart rather than same-colored glyphs.
- **Single source of truth = `PlatformIcon`** (`app/(site)/gua/[slug]/PlatformIcon.tsx`). Its three
  registries — glyph `PATHS`, brand-treatment `BRAND`, and tiled-glyph `TILE` — are **independent of
  the read-`PlatformAdapter`**: icons must render for platforms that are listed but **not yet
  implemented** (the 施工中 tiles), which have no adapter. Path glyphs come from Simple Icons (CC0 path
  data); using a brand's own colors/wordmark for nominative identification is fine (same basis).
- **Principle for adding a new platform** — when you add platform support, in addition to the enum +
  adapter, register the platform's icon: a **`PATHS` glyph** (+ its color/gradient in `BRAND` if the
  symbol is colorful; monochrome needs only the glyph), **or** — if the brand is a colorful wordmark
  with no square symbol — a **`TILE` entry** (background + mark path + centering/tilt transform +
  gradient endpoints/stops). Until an icon is registered, `PlatformIcon` renders nothing for that
  platform (graceful — the text label still shows).

## Adding a new platform — the standard contract

When you add a platform, these are the capabilities every platform is expected to support. Most are
**automatic** — the add/verify/recover flows are generic over `PlatformAdapter`, so a correct adapter
inherits them with **no per-platform code**. Keep it that way; if a platform can't satisfy one of
these, that's a design decision to surface, not to special-case silently.

1. **Adapter** (`lib/binding/platforms/<key>.ts`) implementing `PlatformAdapter`: the read mechanic,
   the `parsePostUrl` security gate (author from platform authority, never user page content), and a
   **deterministic `accountId`** for a given account (lowercased handle/username). See "Verification
   & binding."
2. **Registry** — one line in `ADAPTERS` (`lib/binding/platforms/index.ts`). This flips the `/add`
   tile 施工中 → active and un-404s `/add/<key>`.
3. **Icon** — register the glyph per "Platform icon brand identity" above.
4. **`slugEligible`** — decide whether a handle proven here may mint a slug (a *main* 分身 source).
   Threads/IG = yes; miin = no. A slug-ineligible platform can only be bound as a **non-main** 分身 by
   an already-provisioned owner. **Consequence for the picker:** a slug-less user (onboarding their
   main) is shown **only slug-eligible platforms** in `/add` — slug-ineligible ones are **hidden
   entirely** (not shown-disabled), so nobody is led toward a bind that can't mint their slug. A user
   who already has a slug sees all platforms. (Slug-eligibility must be known even for 施工中 platforms
   that have no adapter yet — keep it as per-platform metadata consistent with each adapter's
   `slugEligible`.)
5. **Recovery / re-verification (恢復·重新驗證) is standard and inherited — do not re-implement it.**
   A flagged (`banned`/`hacked`) 分身 on any platform is recovered through the **same** path
   (`/add/<key>?recover={accountId}` → the shared wizard → `resolvePost` → the **same-account guard**
   in `confirm/page.tsx` → `RecoverConfirm` → `reverifyBinding`). It works for a new platform the
   moment the adapter is registered. The **one thing the adapter must guarantee** is the deterministic
   `accountId` (item 1) — that's what lets the guard confirm a re-verification is the *same* account
   (and correctly refuse it if, e.g., the user renamed their account). The **recover-mode wizard copy
   is also platform-agnostic** (driven by the `recover` flag + `adapter.label` + the target handle —
   `重新驗證` verb, the "你正在恢復 @handle…" lede, the `產生重新驗證貼文` button), so a new platform
   gets the differentiated recovery wording for free, exactly like Threads. The only per-platform copy
   hook is the optional note slot (e.g. IG's non-clickable-caption `igNote`).

## Timeline visibility & rendering

The `時間軸` tab on the Identity Card renders the **append-only `BindingEvent` ledger** (shipped Slice 4,
v0.15.0). It is a *read* of the same events the Accounts tab and the audit model already store — no new
writers, no schema change.

- **Leak defense = per-account *current* visibility — the one rule that must be exactly right.** An event
  is shown publicly **iff its account is `public` right now**. A still-private account's events are
  **fully withheld** (showing even a redacted "something happened" row would leak that a private account
  exists); a later-**disclosed** account surfaces its **whole history at once**, including the `bound`
  that happened while it was private. The filter reads live `LinkedAccount.visibility`, never a per-event
  snapshot. This mirrors the Accounts tab and resolves the v0.14.0-design Slice-4 leak gotcha.
- **Owner vs public projection.** The owner's 管理檢視 sees **everything** (`includePrivate = isOwner`,
  resolved server-side from the session), with private rows dimmed + tagged `👁 私密`. A non-owner /
  logged-out viewer **never receives private entries from the server** — the client-side 公開檢視 filter
  is defense-in-depth, not the primary gate.
- **All event types surface publicly** (the visibility filter alone is the defense — no per-type gating):
  `bound`, `disclosed`, `set_main`, `re_verified`, `reported_banned`, `reported_hacked`, `unbound`.
- **Oldest-first / top-down** — *overrides* the original spec §E.2 "newest-first." Older verifications
  read as more credible, so the timeline grows downward from a synthetic **建立正身** genesis row dated
  `onboardedAt ?? createdAt`.
- **Proof link (`查看貼文 ↗`) on `bound` / `re_verified` only** — the events that carry a `ProofRecord`.
  Condition flags (`本人回報遭盜用 / 本人回報已被停權`) render with a red danger treatment; they are
  owner-reported and distinct from the proof-backed `重新驗證`.
- **No cache, no schema change.** `listTimelineEvents(userId, { includePrivate })` joins
  `BindingEvent → LinkedAccount → ProofRecord` **in application code** (no Prisma relations exist between
  them): a handful of indexed rows — 3 reads (user + accounts in parallel, then events oldest-first) plus
  a batched proof-URL fetch. A materialized column was rejected as premature.

## Open / deferred

- **Slug challenge / reassign mechanism** — only becomes necessary if a low-authority platform (miin)
  is ever made slug-eligible; not needed while slug sources are IG/Threads-only.
- **Released-slug tombstone vs generic 404** — a sold/released identity's slug: 404, or a "this identity
  was released" tombstone? `[REC]` tombstone for released, generic 404 for never-existed. Low priority.
- **Abandoned-account TTL** — accounts that register but never bind sit in limbo. `[REC]` soft-delete an
  unbound account after ~30 days with an email warning first. Needs a final number.
- **Whether miin.cc becomes a slug source** — deferred.
