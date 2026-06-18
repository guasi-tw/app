# Slice 4 — Timeline tab (時間軸) design

**Status:** design ready — pending re-review (2026-06-18) · design session (**v0.15.0-design**, no tag).
The PlatformIcon parts (decision 6 / Visual design) **already shipped separately as `v0.14.1`** (merged +
tagged); the timeline itself is unbuilt — that's what writing-plans + the build slice (`v0.15.0`) cover.
**Builds the surface:** §G #8 "Identity Card — Timeline" of
[`2026-06-16-mvp-wireframes-design.md`](2026-06-16-mvp-wireframes-design.md) (treated as historical;
this doc supersedes it where they differ — see **Overrides**).

## Goal

Replace the `時間軸施工中（Slice 4）` placeholder in
[`app/(site)/gua/[slug]/IdentityCard.tsx`](../../../app/(site)/gua/[slug]/IdentityCard.tsx) (shared by
`/gua/{slug}` and the slug-less `/r/{shortRef}` owner card) with a real render of the append-only
`BindingEvent` ledger. **The events are already written** by Slices 2 + 5 (`bound`, `disclosed`,
`set_main`, `reported_banned`, `reported_hacked`, `re_verified`, each optionally linking a
`ProofRecord`). This slice is **read-rendering + 繁中 copy only — no schema change.**

## Overrides (vs the 2026-06-16 wireframes spec)

- **Ordering: oldest-first (top-down), not newest-first.** §E.2 said `[DECIDED] newest-first`; the owner
  asked for a chronological top-down read (建立正身 at the very top, latest event at the bottom). This doc
  is now authoritative: `orderBy createdAt asc`, genesis prepended.
- **建立正身 anchor source = `User.onboardedAt ?? createdAt`** (not `created_at` per §H). `onboardedAt`
  (added in Slice 5 = when the 正身 profile was actually created) is the truer "建立正身" moment;
  `createdAt` is the legacy/null fallback.

## Decisions (all [DECIDED] 2026-06-18)

1. **Visibility filter = per-account, current visibility.** An event is shown publicly **iff its account
   is `public` right now**. A still-private account's events are fully withheld. When an account is later
   disclosed, its **entire history appears at once** — including the `bound` that happened while it was
   private. This is the *only* leak defense, and it's per-account (all-or-nothing), mirroring the
   Accounts tab. No new info leaks: a now-public account's bind date is already shown as 驗證於 {date} on
   the Accounts tab.
2. **All event types surface publicly** (for public accounts). The gotcha is handled purely by decision
   1, so no per-event-type classification is needed — the fullest, most honest "append-only ledger."
3. **Include a synthetic 建立正身 genesis row** at the top (oldest), sourced from
   `onboardedAt ?? createdAt`. It is a render-time anchor, **not** a `BindingEvent` row.
4. **Caching: none.** The read is a few indexed lookups over a handful of rows joined in JS
   (sub-millisecond); a materialized column / platform cache is premature optimization and out of slice
   scope. Keep the read path simple and always-correct. (If profiling ever shows a need, the chosen path
   is platform cache — Next `use cache` + `updateTag` — **not** a denormalized DB column.)
5. **Owner sees everything; public sees the filtered view** — exactly the `includePrivate = isOwner`
   pattern of `buildAccountGroups`. The owner's full list carries an `isPrivate` flag per entry; the
   client card hides `isPrivate` entries in 公開檢視 and shows them (marked 私密) in 管理檢視. Non-owners
   never receive private events from the server (defense in depth).
6. **Platform icons are brand-colored** (see Visual design). The shared `PlatformIcon` is upgraded from a
   single monochrome `currentColor` glyph to a **per-platform brand treatment** so platforms are
   distinguishable at a glance: **Instagram → its brand gradient**, **Threads → monochrome (its brand IS
   mono → render `--fg`/white on dark)**, **miin + every future platform → register its own brand
   color**. This changes the shared component, so it also colorizes the **Accounts tab** icons — an
   intended consistency win.
   **✅ Shipped separately as `v0.14.1`** (merged + tagged 2026-06-18, ahead of the timeline build), and
   rolled out to the **`/add` picker + `/add/{platform}` headings** too. `PlatformIcon` now takes `size` +
   `className` props and a `BRAND` registry; the IG-gradient duplicate-id risk is solved with a
   `useId()`-derived id (colons stripped) so it stays valid with many instances on a page. The lasting
   rule is folded into [`docs/product-decisions.md`](../../product-decisions.md) "Platform icon brand
   identity" + CLAUDE.md. The timeline build just **reuses** the component (at `size≈17`).

## Data flow & the leak-proof read model

`BindingEvent` has **no Prisma relation** to `LinkedAccount` (it's keyed by the composite logical key
`(userId, platform, accountId)`) nor to `ProofRecord` (`proofRecordId` is a bare `String?`). So the read
model joins in application code — **2–3 small indexed queries, no N+1, no schema edit:**

**`listTimelineEvents(userId, { includePrivate }): Promise<TimelineEntry[]>`** — new, in
`lib/identity/repo.ts` (or a sibling `lib/identity/timeline.ts`):

1. Load the user's `LinkedAccount`s → `Map<"{platform}:{accountId}", { visibility, handle, platform }>`.
2. Load `BindingEvent`s `where { userId }`, `orderBy createdAt asc` (index `[userId, createdAt]` already
   exists; asc per the ordering override).
3. For each event, look up its account in the map.
   - **Skip** if the account is missing (defensive — shouldn't happen; nothing is deleted in MVP).
   - **Skip** if `!includePrivate && account.visibility !== "public"` — the leak defense.
4. Batch-fetch `ProofRecord`s for the `proofRecordId`s present (`where { id: { in: [...] } }`) →
   `Map<id, proofPostUrl>`; attach to `bound` / `re_verified` entries only.
5. **Prepend** the genesis entry (`onboardedAt ?? createdAt`, no account/handle, never private).

Returns `TimelineEntry[]` ordered oldest→newest with the genesis at index 0.

### `buildTimeline(userId, isOwner)` — view-builder

Sibling to [`accounts.ts`](../../../app/(site)/gua/[slug]/accounts.ts), in
`app/(site)/gua/[slug]/timeline.ts`. Calls `listTimelineEvents(userId, { includePrivate: isOwner })` and
maps each entry to a **plain, serialisable** `TimelineView`:

```ts
export type TimelineView = {
  id: string;                 // event id, or "genesis"
  date: string;               // YYYY-MM-DD (toISOString().slice(0,10), matching accounts.ts)
  kind:                       // drives label + whether a proof link renders
    | "genesis" | "bound" | "disclosed" | "set_main"
    | "reported_banned" | "reported_hacked" | "re_verified" | "unbound";
  handle: string | null;      // null for genesis
  platform: string | null;    // platform key → PlatformIcon; null for genesis
  platformLabel: string | null; // adapter.label; null for genesis
  proofPostUrl: string | null;  // set only on bound / re_verified
  isPrivate: boolean;         // account currently private (owner view only; always false for genesis)
};
```

Both `app/(site)/gua/[slug]/page.tsx` and `app/(site)/r/[shortRef]/page.tsx` build it alongside
`buildAccountGroups` and pass a new `timeline: TimelineView[]` prop to `IdentityCard`.

## Event copy (繁體中文 / Taiwan)

Each row reads: `{YYYY-MM-DD} · {label} @{handle}（{platformLabel}）` + optional `查看貼文 ↗`.
Platform glyph via the existing `PlatformIcon`.

| `kind` | Label | Proof link | Notes |
|---|---|---|---|
| `genesis` | **建立正身** | — | synthetic, oldest, no handle/platform |
| `bound` | **綁定** | ✓ 查看貼文 ↗ | the core proof event |
| `disclosed` | **設為公開** | — | one-way private→public |
| `set_main` | **設為主要** | — | ★ re-point (current + historical) |
| `reported_hacked` | **本人回報遭盜用** | — | owner-reported; trust-lowering |
| `reported_banned` | **本人回報已被停權** | — | owner-reported; trust-lowering |
| `re_verified` | **重新驗證** | ✓ 查看貼文 ↗ | guasi-verified re-proof; trust-restoring |
| `unbound` | **解除綁定** | — | no MVP writer; renders if it ever exists (append-only) |

The `本人回報…` prefix makes the **owner-reported (self-asserted)** nature of the condition flags explicit
— the contrast §E.2 asked for between owner-reported (trust-lowering) and 重新驗證 (proof-backed,
trust-restoring).

## Ordering & the flagged→recovered story

Oldest-first, top-down. A recovery sits *below* the flag it recovers, reading as a chronological story:

```
2026-06-15 · 建立正身
2026-06-15 · 綁定 @alice（Threads） · 查看貼文 ↗
2026-06-17 · 本人回報遭盜用 @alice（Threads）
2026-06-18 · 重新驗證 @alice（Threads） · 查看貼文 ↗
```

## Visual design (build to this)

**Reference mockup:** [`2026-06-18-timeline-tab-mockup.png`](2026-06-18-timeline-tab-mockup.png) (rendered
with the real card tokens; left = 公開檢視, right = 管理檢視). The HTML source lived in the gitignored
`.superpowers/brainstorm/timeline-mockup.html`. **The text below is authoritative** — the image
illustrates it.

**Tokens** (reuse `globals.css`): `--bg #0b0b0f`, `--fg #f5f5f7`, `--muted #8a8a94`,
`--accent #e8b500`, `--line #2a2a33`, **plus a new `--danger #f0484f`** for condition flags.

**Row anatomy** — a vertical list (`.timeline`) with a left rail (1px `--line`) and a 9px dot per item.
Top-to-bottom per item:
1. **Date** — `.tl-date`, ~.72rem, `--muted`, `YYYY-MM-DD`.
2. **Action verb** (lead-in) — `.tl-action`, ~.85rem, weight 600, `--muted`: 綁定 / 設為公開 / 設為主要 /
   重新驗證, etc.
3. **Account line — the hero** — `.tl-acct`, ~1.05rem: `@handle` (weight 800, `--fg`) + **`PlatformIcon`
   at ~17px** + platform label (~.92rem `--muted`). **Every account-bearing row shows its platform icon**
   (not just binds); genesis is the only row with no account/icon.
4. **Proof link** (only `bound` / `re_verified`) — `.tl-proof`, ~.82rem, `--accent`, `查看貼文 ↗`.

**Per-kind treatment:**
- **genesis** — gold action text (`--accent`, ~1rem), gold dot, no account line.
- **proof (`bound` / `re_verified`)** — gold dot, the `查看貼文 ↗` link.
- **plain (`set_main` / `disclosed` / future `unbound`)** — muted dot, no proof link.
- **flag (`reported_banned` / `reported_hacked`) — danger treatment, must read as alarming:** label in
  `--danger` (weight 800) with a `⚠` prefix, **red dot, 2px red left-border, faint red wash
  (`rgba(240,72,79,.09)`)**, handle tinted light-red. This is the unmistakable "compromised account" cue.
- **private (owner 管理檢視 only)** — whole item dimmed (`opacity ~.68`), hollow ring dot, a dashed
  `👁 私密` tag on the account line. Matches the dashed private rows on the Accounts tab.

**Dot color is a secondary cue only** — label color + the red wash carry the meaning; the dot is a nice
touch, not the signal.

**New CSS** — add `.timeline`, `.tl-item` (+ `.genesis`/`.proof`/`.flag`/`.priv`), `.dot`, `.tl-date`,
`.tl-action`, `.tl-acct` (`.hd`/`.pl`), `.tl-proof`, `.tl-priv-tag` to `globals.css`, alongside the
existing `id-*` / `acct-*` blocks. Reuse existing tokens; introduce only `--danger`.

### PlatformIcon brand coloring (shared component change)

Upgrade `app/(site)/gua/[slug]/PlatformIcon.tsx` from one monochrome `currentColor` path to a
**per-platform brand treatment**, keyed off `platform`:
- **instagram** → fill the path with the IG brand gradient (5-stop diagonal, roughly
  `#ffd521 → #f50000 → #b900b4 → #7e00ce → #4f5bd5`).
- **threads** → leave monochrome (`currentColor`), so it inherits `--fg` (white on dark) — its brand is
  already mono.
- **miin + future platforms** → each registers its own brand color/treatment in the same map.
- **Gotcha (resolved):** the IG gradient needs a `<linearGradient>` with an id; many instances on a page
  would collide on a static id (invalid). **Chosen fix:** a per-instance `useId()`-derived id (colons
  stripped, since they're invalid inside `url(#…)`). `PlatformIcon` is now a client component for this.
- This colorizes **every** `PlatformIcon` usage, including the **Accounts tab** — intended and consistent.
  Keep the glyph `aria-hidden` (the adjacent text label remains the accessible name).
- **Status: shipped in `v0.14.1`** (PlatformIcon brand coloring + `/add` picker + `/add/{platform}`
  headings). **For the timeline build this subsection is reference only — do not re-implement; just
  consume `PlatformIcon`.**

## Component wiring & rendering

- **`IdentityCard`** gains `timeline: TimelineView[]`. The timeline tab replaces the placeholder with a
  presentational **`<TimelineList entries={timeline} manage={manage} />`**.
- **Client-side mode filter** (mirrors the Accounts tab): in 公開檢視 (`!manage`) hide entries where
  `isPrivate`; in 管理檢視 show all, rendering a `👁 私密` marker on private entries. Both projections are
  already safe — for a non-owner the server never sent private entries at all.
- **Genesis** always renders (never private).
- **Empty state:** `尚無時間軸記錄。` — defensive only; in practice the genesis row always shows (even the
  slug-less `/r/` owner who has onboarded but not yet bound sees just 建立正身).
- **Styling:** build to the **Visual design** section above (vertical rail + dots, account-line hero,
  red danger treatment for flags, brand-colored `PlatformIcon`). New `.tl-*` classes in `globals.css`.
- **`TimelineList`** is presentational; keep it dumb (props in, JSX out) so it's testable in isolation,
  matching the existing `AccountRow` split.

## Testing (vitest, matching the existing `*.test.ts` style)

`listTimelineEvents`:
- Non-owner: events for currently-private accounts are **absent**; only public-account events + genesis.
- Owner (`includePrivate`): private-account events present and flagged `isPrivate`.
- **Disclosure history:** an account bound-private-then-disclosed surfaces its `bound` event publicly
  (full history once public).
- `proofPostUrl` attached on `bound` / `re_verified` only; `null` elsewhere.
- Order: `createdAt asc`, genesis first; genesis date = `onboardedAt ?? createdAt`.
- Defensive: an event whose account is missing is skipped.

Page-level: assert the `timeline` prop is built/passed (extend the existing `page.test.ts`).

## In scope beyond the timeline

- **`PlatformIcon` brand coloring** (decision 6 / Visual design) — **shipped as `v0.14.1`** (merged +
  tagged; also added to `/add` + `/add/{platform}`). The timeline build only **consumes** it.

## Out of scope / non-goals

- No caching/materialization (decision 4).
- No schema change, no migration.
- No new event types or writers — Slice 4 only *reads* what Slices 2 + 5 write.
- `BindingEvent.reason` is unused in MVP (no writer sets it); render defensively if present, but no UI
  depends on it.

## Docs to fold (after the slice ships — not in this design session)

- **CLAUDE.md → Locked decisions:** add a "Timeline (§E.2) rendering" bullet — per-account
  current-visibility filter, all event types public, oldest-first, genesis row from
  `onboardedAt ?? createdAt`, proof on `bound`/`re_verified`, no cache.
- **Brand-colored `PlatformIcon`** (decision 6) — ✅ **shipped in `v0.14.1`**: rule recorded in
  [`docs/product-decisions.md`](../../product-decisions.md) "Platform icon brand identity" + CLAUDE.md
  Locked decisions, and the adapter-registry comment.
- **`docs/routes.md`:** flip surface #8's note from placeholder to live.
- **`docs/devlog.md`:** v0.15.0 entry at ship time; resolves the v0.14.0-design Slice-4 leak gotcha.
