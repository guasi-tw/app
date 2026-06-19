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
5. **Image storage:** committed static assets under `public/help/<platform>/step-N.png`, referenced by
   static path (e.g. `/help/miin/step-1.png`). No `next/image` (the codebase doesn't use it) — plain
   `<img loading="lazy">`.
6. **Privacy:** screenshots are captured while posting **from the guasi / a throwaway account**, so the
   visible handle/avatar is the brand itself — nothing personal to redact. EXIF stripped on commit.
7. **Image ratio:** **4:5 portrait, exported ~900 × 1125 px** (2× the ~448px wizard column for retina).
   Bottom-sheet steps are framed to fill 4:5 (sheet + a bit of the post above), not letterboxed strips.
   The CSS renders at column width with `height: auto`.
8. **Click highlight:** baked **into the image** by the capture author — a hollow ellipse/ring (no
   fill, no arrows), ~6–8px stroke in brand gold **`#e8b500`**, with a thin dark edge / soft shadow so
   it stays visible on Instagram's light menu surfaces as well as the dark Threads/miin shots. Same ring
   style across all steps so they read as one set.

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
  /** Static path under public/, e.g. "/help/miin/step-1.png". */
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

- **Threads** (`threads.ts`): open the post → tap the share / ⋯ control → tap `複製連結`. (~2–3 steps.)
- **Instagram** (`instagram.ts`): open the post → tap **⋯** (top-right) → tap `複製連結`. (~2–3 steps.)
- **miin.cc** (`miin.ts`): the **3-tap** sequence the user identified (open the story → open its menu →
  copy link). (3 steps.) miin is the primary motivator for this feature.

Image files land at `public/help/threads/step-N.png`, `public/help/instagram/step-N.png`,
`public/help/miin/step-N.png`. Captions (the `text` of each step) are authored to match the final
shots.

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
- `.posturl-help-steps li img` — `width: 100%; height: auto; border-radius: 0.6rem; border: 1px solid
  #2a2a33;` (mirrors `.template`'s framing) so each shot fills the column uniformly.

Exact values are the implementer's call within the existing design language; no new design tokens.

### E. Image asset pipeline

- Author captures portrait shots from the guasi/throwaway account, crops to **4:5**, bakes the gold
  highlight ring, and drops them into `public/help/<platform>/`.
- On commit, any oversized source is downscaled to ~900px wide, compressed, and **EXIF-stripped**
  (`sips` on macOS — built in, no install). Filenames: `step-1.png`, `step-2.png`, ….

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
- `public/help/{threads,instagram,miin}/step-*.png` — new static assets (author-supplied).
- Docs on ship: `docs/routes.md` unaffected (no route change); `docs/devlog.md` + `todo.md` per release
  convention.
