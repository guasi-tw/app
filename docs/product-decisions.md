# Product & Identity Decisions

The maintained home for guasi's **product/identity design decisions** — public-URL routing,
slug provisioning, anti-squatting, and binding uniqueness. These were originally worked out in
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

## Open / deferred

- **Slug challenge / reassign mechanism** — only becomes necessary if a low-authority platform (miin)
  is ever made slug-eligible; not needed while slug sources are IG/Threads-only.
- **Released-slug tombstone vs generic 404** — a sold/released identity's slug: 404, or a "this identity
  was released" tombstone? `[REC]` tombstone for released, generic 404 for never-existed. Low priority.
- **Abandoned-account TTL** — accounts that register but never bind sit in limbo. `[REC]` soft-delete an
  unbound account after ~30 days with an email warning first. Needs a final number.
- **Whether miin.cc becomes a slug source** — deferred.
