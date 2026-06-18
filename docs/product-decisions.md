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

- **Each platform renders in its own brand identity.** A platform with a **colorful brand mark** shows
  in its brand color/gradient (e.g. **Instagram → its diagonal gradient**); a platform whose brand is
  **monochrome** (e.g. **Threads**) renders in `currentColor` (white on the dark theme). This is what
  makes IG instantly tellable apart from Threads, rather than two same-colored glyphs.
- **Single source of truth = `PlatformIcon`** (`app/(site)/gua/[slug]/PlatformIcon.tsx`). Its glyph
  registry (`PATHS`) and brand-treatment registry (`BRAND`) are **independent of the read-`PlatformAdapter`**
  — icons must render for platforms that are listed but **not yet implemented** (the 施工中 tiles), which
  have no adapter. Glyphs come from Simple Icons (CC0 path data); using a brand's own colors for
  nominative identification is fine (same basis as the glyphs).
- **Principle for adding a new platform** — when you add platform support, in addition to the enum +
  adapter, **register the platform's glyph in `PATHS` and (if its brand is colorful) its color/gradient
  in `BRAND`.** A monochrome brand needs only the glyph. Until a glyph is registered, `PlatformIcon`
  renders nothing for that platform (graceful — text label still shows). *(miin.cc currently has no
  registered glyph — TBD.)*

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
