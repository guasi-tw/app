# miin platform glyph — design (2026-06-18)

Status: approved (brainstormed with the visual companion; gradient/tilt values locked by live tuning).
Historical record — once shipped, the maintained docs (CLAUDE.md Locked decisions,
`product-decisions.md` "Platform icon brand identity", the devlog) are the source of truth.

## Problem

`PlatformIcon` renders a brand glyph for each platform so platforms are distinguishable at a glance
(add picker, `/add/{platform}` heading, Accounts tab, Timeline). miin.cc shipped as an active
platform (v0.16.0) **without** a glyph: its `PATHS`/`BRAND` entries were left as TODO, so it fell
through to the "renders nothing" fallback. The blocker recorded in `product-decisions.md` was that
miin's brand is a **wordmark, not a square symbol**, and a wide wordmark doesn't fit the square slot.

Resolution from the owner: miin treats the "Miin" wordmark **as its symbol** (it has no separate
mark) — the same standing as IG's camera or the Threads @-glyph. So we reproduce the actual app icon
faithfully rather than inventing a monogram.

## What we're building

A faithful mini reproduction of miin's app icon as a **tiled** glyph — the first glyph that isn't a
transparent monochrome/gradient silhouette. miin's brand is a **light-on-dark rainbow wordmark**, so
it needs its own dark rounded-square backdrop to read (especially on light backgrounds), unlike the
IG/Threads silhouettes which work transparent via `fill`.

### Visual (locked values, measured from the PNG + tuned live)

- **Canvas:** `viewBox="0 0 100 100"`, `width = height = size` (square footprint, same as the other
  glyphs — `size` 13/20/24 all work). Navy rounded square: `<rect width=100 height=100 rx=23>` (≈23%
  corner radius), `fill="#030037"` (sampled from the icon corners).
- **Mark:** miin's **official wordmark path** (from their site SVG, native `viewBox 0 0 102 34`),
  centered + tilted + scaled via group transform
  `translate(50 50.5) rotate(-7) scale(0.9) translate(-51 -17)` — i.e. centered on the tile,
  rotated **−7°** (the PCA major axis of the icon's mark measured −7.15°, rises to the right),
  scaled **0.9**. Path uses `fill-rule="evenodd"` (required for the letter counters).
- **Gradient:** a `userSpaceOnUse` linear gradient in **tile coordinates** (not the rotated mark
  space) — this **decouples** the color bands from the letter tilt, so the bands stay ~horizontal in
  canvas space while the letters lean −7°; only the M's bottom-left dips into the warm end, exactly
  like the real icon. Lean **5°**, spread **L=20** about center `(50, 50.5)` →
  endpoints **`(48.26, 70.42)` (warm, offset 0) → `(51.74, 30.58)` (cool, offset 1)**.
  Stops (red corner trimmed, extra yellow, per owner tuning):

  | offset | color | | offset | color |
  |---|---|---|---|---|
  | 0.00 | `#f15b47` red | | 0.56 | `#26dac8` cyan |
  | 0.05 | `#f7943a` orange | | 0.72 | `#3495ea` blue |
  | 0.13 | `#ffd21e` yellow | | 0.81 | `#5362e6` blue-purple |
  | 0.25 | `#b9e72f` yellow-green | | 1.00 | `#6b3dde` purple |
  | 0.41 | `#4bf667` green | | | |

- **Rendering technique:** a `<mask>` (the tilted wordmark filled white) over a full-tile
  `<rect fill="url(#gradient)">`, on top of the navy `<rect>`. The gradient maps across the mask's
  extent so the full red→purple ramp shows inside the letters.

Caveat (accepted): miin's official logo path is slightly **wider/flatter** than the app-icon's
custom lettering, so letter proportions aren't pixel-identical to the PNG — but the color reading and
silhouette match. We use the official vector rather than tracing the raster.

### Architecture

Extend `PlatformIcon` (`app/(site)/gua/[slug]/PlatformIcon.tsx`) with a small **`TILE` registry**
parallel to `PATHS`/`BRAND`:

- New `MIIN_WORDMARK` path constant + `TILE: Record<string, Tile>` with the miin entry holding the
  locked `bg`, mark `transform`, gradient `endpoints`, and `stops`.
- In the component, **branch first on `TILE[platform]`**: if present, render the `100×100` tiled
  square with **`useId()`-derived unique mask + gradient ids** (mirrors the existing colon-stripped
  gradient-id handling — multiple instances render on one page). Otherwise the existing
  `PATHS`/`BRAND` path-glyph behavior is **untouched**.
- Component stays `"use client"` and `aria-hidden` (decorative; the adjacent text label carries the
  accessible name).

No other files change behavior: the glyph is consumed generically wherever `PlatformIcon` already is.

### Out of scope

- No new image/raster mode — SVG only.
- No change to IG/Threads glyphs, the `BRAND` gradient logic, or any adapter/read code.
- No generalized "tiled wordmark" framework — `TILE` holds just miin until a second colorful-wordmark
  platform appears.

## Docs to update

- `product-decisions.md` "Platform icon brand identity": replace the miin "no registered glyph"
  caveat with the **tiled-glyph** treatment (dark backdrop + masked gradient wordmark for
  colorful-wordmark brands) and note `TILE` as a third registry.
- The component's "WHEN ADDING A PLATFORM" comment: mention the tiled option for wordmark brands.
- CLAUDE.md Locked decisions one-liner (platform-icon bullet): note miin now ships a tiled glyph.
- `docs/devlog.md`: v0.20.0 entry + TL;DR row. `todo.md`: cross off the miin-glyph item if present.

## Testing / verification

- `npx tsc --noEmit` clean, `npx vitest run` green (no behavior change to existing tests; this is a
  presentational component with no existing unit test — visual verification was done in the companion
  against the real PNG).
