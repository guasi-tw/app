# Post-URL Help — Per-Platform "How to find the post URL" Walkthrough

**Status:** design (2026-06-18), approved. A **minor UI follow-up to the Add-Account wizard**.
**No data-model change** — adds one presentation field to `PlatformAdapter` and a render block in the
wizard, plus static image assets.

**Goal:** After a user posts their verification post, they have to paste the post's URL back into the
wizard. Finding that URL is non-obvious per platform — **miin.cc takes 3 taps**, and Threads/IG hide
it behind a share/⋯ menu. Add a per-platform, always-visible **walkthrough (numbered 繁中 steps +
annotated screenshots)** so a user who doesn't know where the URL lives can follow along.

## Background

The wizard (`app/(site)/add/[platform]/AddAccountWizard.tsx`) ends with a paste-the-URL form:
`貼文發佈後，把貼文網址貼回這裡`. There is currently **no guidance** on *how* to obtain that URL. The
flow already has per-platform presentation hooks on the adapter (`postUrlPlaceholder`, `serviceTag`,
`hashtag`), so the natural home for this guidance is the same `PlatformAdapter` seam — register a
platform's steps once, no wizard changes when a future platform is added.

This is purely additive UI. It does not touch parsing, fetching, `resolvePost`, or any binding logic.

## Decisions

1. **Format:** numbered 繁中 text steps, **each step paired with a screenshot**.
2. **Placement:** an **always-visible block *below* the submit button** — the primary paste-and-go path
   stays at the top; the walkthrough sits underneath for anyone who needs it (it is not collapsed).
3. **Scope:** **all three** MVP platforms — Threads, Instagram, miin.cc.
4. **Data model:** new `postUrlHelp: readonly PostUrlStep[]` field on `PlatformAdapter`.
5. **Image storage:** committed static assets under `public/help/<platform>/step-N.webp`, referenced by
   static path (e.g. `/help/miin/step-1.webp`). No `next/image` (the codebase doesn't use it) — plain
   `<img loading="lazy">`.
6. **Privacy:** screenshots are captured while posting **from the guasi / a throwaway account**, so the
   visible handle/avatar is the brand itself — nothing personal to redact. EXIF stripped on commit.
7. **Image ratio / format:** captured at 1284 × 500 landscape; **shipped as 900 × 351 WebP** (same
   ratio, q80), uniform across all 9 images (3 platforms × 3 steps). Wide focused strips cropped to the
   relevant control + a little context. Because the ratio is uniform, the CSS pins
   `aspect-ratio: 900 / 351` so space is reserved before the lazy image loads (no layout shift);
   displayed at column width (≈448 × 174px) with `height: auto`.
8. **Click highlight:** baked **into the image** by the capture author — a bright **yellow box** drawn
   around the tap target, applied uniformly across all steps so they read as one set. (The shots are
   over dark UIs — Threads/miin/IG-dark — where the yellow box reads clearly.)
9. **Step count:** **exactly 3 steps per platform** as captured. The data model stays a flexible
   `PostUrlStep[]` array (not a fixed 3-tuple) so a future platform isn't forced to 3.

### Out of scope (explicitly)

- The existing IG **compose** note (`igNote` — "先附上一張圖片…再貼到說明文字") is *posting* guidance, a
  different concern from *URL-finding*; it stays as-is. Generalizing it onto the adapter is a possible
  later cleanup, **not** part of this change.
- No collapsible/disclosure UI, no animation, no CSS marker-overlay approach (highlights are baked into
  the images).

## Sections

### A. Data model — `PostUrlStep` + `postUrlHelp` on the adapter

In `lib/binding/platforms/types.ts`:

```ts
/** One step in the per-platform "how to find the post URL" walkthrough. */
export type PostUrlStep = {
  /** 繁中 instruction for this step. */
  text: string;
  /** Static path under public/, e.g. "/help/miin/step-1.webp". */
  image: string;
  /** Screenshot alt text; defaults to `text` when omitted. */
  alt?: string;
};
```

Add to the `PlatformAdapter` interface, near `postUrlPlaceholder`:

```ts
/** Ordered walkthrough for finding a post's URL on this platform (text + screenshot per step). */
readonly postUrlHelp: readonly PostUrlStep[];
```

Because it's a required member, **all three adapters must define it** — TypeScript enforces coverage,
so a future platform can't silently ship without help steps.

### B. Per-adapter content

Each adapter (`threads.ts`, `instagram.ts`, `miin.ts`) declares its own `postUrlHelp` array. The exact
copy is finalized against the captured screenshots, but the shape and step counts are:

- **Threads** (`threads.ts`): **3 steps** — tap the share icon under the post → … → copy the link.
- **Instagram** (`instagram.ts`): **3 steps** — open the share/⋯ control → … → copy the link.
- **miin.cc** (`miin.ts`): **3 steps** — the 3-tap sequence the user identified (open the story's share
  control → … → copy link). miin is the primary motivator for this feature.

(Step-1 of Threads/miin highlights the share icon under the post; exact step-2/3 copy is authored
against the captured `step-2.png` / `step-3.png` during implementation.)

Image files land at `public/help/<platform>/step-N.webp`. Captions (the `text` of each step) are
authored to match the final shots.

### C. Wizard rendering

`app/(site)/add/[platform]/page.tsx` passes the steps into the wizard:

```tsx
<AddAccountWizard
  /* …existing props… */
  postUrlHelp={adapter.postUrlHelp}
/>
```

`AddAccountWizard.tsx` gains a `postUrlHelp: readonly PostUrlStep[]` prop and renders, **after** the
paste form / submit button (the last child of `.wizard`):

```tsx
{postUrlHelp.length > 0 ? (
  <section className="posturl-help">
    <h2 className="posturl-help-title">找不到貼文網址？這樣取得</h2>
    <ol className="posturl-help-steps">
      {postUrlHelp.map((s, i) => (
        <li key={i}>
          <span className="posturl-help-text">{s.text}</span>
          <img src={s.image} alt={s.alt ?? s.text} loading="lazy" />
        </li>
      ))}
    </ol>
  </section>
) : null}
```

- The `.length > 0` guard is defensive (every adapter ships steps today, but the block self-hides if an
  array is ever empty).
- **Only shown with the active paste form, not the expired branch.** When the request is expired the
  paste form is replaced by the regenerate button, so the URL walkthrough is irrelevant there — render
  the help block only in the non-`state.expired` path (the same branch that contains the paste form).
- `loading="lazy"` because it sits below the fold.
- Decorative ring lives in the image; `alt` describes the action for screen readers.

### D. Styling (`app/globals.css`)

New classes in the Slice-2 wizard block, matching the dark theme and 28rem column:

- `.posturl-help` — top margin/padding separating it from the submit button; left-aligned like the rest
  of `.wizard`.
- `.posturl-help-title` — small, muted heading (sized like a `.hint`/sub-label, not an `h1`).
- `.posturl-help-steps` — an ordered list with visible step numbers, comfortable `gap` between steps.
- `.posturl-help-steps li img` — `width: 100%; height: auto; aspect-ratio: 900 / 351; border-radius:
  0.6rem; border: 1px solid #2a2a33;` (mirrors `.template`'s framing) so each shot fills the column
  uniformly and reserves its space before the lazy image loads (no layout shift).

Exact values are the implementer's call within the existing design language; no new design tokens.

### E. Image assets (captured + optimized)

The 9 shipped images exist at `public/help/{threads,instagram,miin}/step-{1,2,3}.webp`, each 900 × 351
WebP (q80), shot from `@gua.si.tw` with the yellow highlight box baked in. **Only these 9 `.webp` are
committed.** Conversion was done with `cwebp -q 80 -resize 900 0` from the 1284 × 500 PNG crops —
total dropped from ~1.1 MB (PNG) to ~104 KB (WebP); per-image 8–16 KB. Only the 3 images for the
current platform load per page, lazily, below the fold.

Working files to keep OUT of git (all PNGs under `public/help/` are local sources, not shipped):
- `public/help/<platform>/step-N.png` — the 1284 × 500 PNG crops (WebP sources).
- `public/help/<platform>/step-N-org.png` — full 1284 × 2778 originals (status bar; bloat).
- `public/help/backup/` — duplicate full originals.
- Rule: add **`public/help/**/*.png`** to `.gitignore` (covers all three above).
- `.DS_Store` — **already** covered by the existing `.gitignore` rule (verified `git check-ignore`).

## Testing

- **Type safety:** `npx tsc --noEmit` — the new required `postUrlHelp` member forces all three adapters
  to define it; a missing one fails the build.
- **Render:** a component test (or manual check) that `AddAccountWizard` renders one `<li>` + `<img>`
  per step with the right `src`/`alt`, and that the block self-hides on an empty array.
- **Manual:** load `/add/threads`, `/add/instagram`, `/add/miin` after generating a template; confirm
  the walkthrough appears below the submit button with the correct per-platform images, and that images
  resolve from `public/help/...`.
- `npx vitest run` green before PR.

## Files touched

- `lib/binding/platforms/types.ts` — add `PostUrlStep` + `postUrlHelp` member.
- `lib/binding/platforms/threads.ts` / `instagram.ts` / `miin.ts` — add `postUrlHelp` arrays.
- `app/(site)/add/[platform]/AddAccountWizard.tsx` — new prop + render block.
- `app/(site)/add/[platform]/page.tsx` — pass `postUrlHelp` prop.
- `app/globals.css` — `.posturl-help*` classes.
- `public/help/{threads,instagram,miin}/step-{1,2,3}.webp` — 9 static assets (captured + optimized).
- `.gitignore` — add `public/help/**/*.png` (keep all PNG working files / sources local).
- Docs on ship: `docs/routes.md` unaffected (no route change); `docs/devlog.md` + `todo.md` per release
  convention.
