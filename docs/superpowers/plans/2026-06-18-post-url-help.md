# Post-URL Help Walkthrough — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible, per-platform "how to find the post URL" walkthrough (3 numbered 繁中 steps + screenshots) below the submit button in the Add-Account wizard.

**Architecture:** Each platform declares its steps as data on its existing `PlatformAdapter` (`postUrlHelp: PostUrlStep[]`); `page.tsx` passes the active adapter's steps into `AddAccountWizard`, which renders them as an `<ol>` of caption + `<img>` below the paste form. Screenshots ship as pre-optimized WebP under `public/help/<platform>/`. No data-model, routing, or verification-logic changes.

**Tech Stack:** Next.js App Router (React 19), TypeScript, Vitest (node env), plain `<img>` (no `next/image`), global CSS in `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-06-18-post-url-help-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `lib/binding/platforms/types.ts` | Adapter contract | Add `PostUrlStep` type + required `postUrlHelp` member |
| `lib/binding/platforms/threads.ts` | Threads adapter | Add `postUrlHelp` (3 steps) |
| `lib/binding/platforms/instagram.ts` | Instagram adapter | Add `postUrlHelp` (3 steps) |
| `lib/binding/platforms/miin.ts` | miin adapter | Add `postUrlHelp` (3 steps) |
| `lib/binding/platforms/post-url-help.test.ts` | Regression test | **Create** — data shape, paths, on-disk asset existence |
| `app/(site)/add/[platform]/AddAccountWizard.tsx` | Wizard UI | New `postUrlHelp` prop + render block |
| `app/(site)/add/[platform]/page.tsx` | Wizard page | Pass `postUrlHelp={adapter.postUrlHelp}` |
| `app/globals.css` | Styling | `.posturl-help*` classes |
| `public/help/{threads,instagram,miin}/step-{1,2,3}.webp` | Assets | **Commit** (already on disk, untracked; PNG sources gitignored) |

**Testing reality (read before writing tests):** This project tests in the **node** environment and only includes `*.test.ts` (see `vitest.config.ts`). There is **no `@testing-library/react`/jsdom**, and **no React component is DOM-tested** anywhere in the repo. So the wizard render (Task 2) and CSS (Task 3) are verified by `tsc` + manual browser check — consistent with the codebase — while the meaningful automated coverage is the **adapter-data + asset-existence** test in Task 1.

---

## Task 1: Data model + per-adapter content + tests

**Files:**
- Create: `lib/binding/platforms/post-url-help.test.ts`
- Modify: `lib/binding/platforms/types.ts`
- Modify: `lib/binding/platforms/threads.ts`
- Modify: `lib/binding/platforms/instagram.ts`
- Modify: `lib/binding/platforms/miin.ts`
- Commit assets: `public/help/{threads,instagram,miin}/step-{1,2,3}.webp`

- [ ] **Step 1: Write the failing test**

Create `lib/binding/platforms/post-url-help.test.ts`:

```ts
// lib/binding/platforms/post-url-help.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { threadsAdapter } from "./threads";
import { instagramAdapter } from "./instagram";
import { miinAdapter } from "./miin";
import type { PlatformAdapter } from "./types";

const ADAPTERS: readonly PlatformAdapter[] = [threadsAdapter, instagramAdapter, miinAdapter];

// Final captions per spec §B (2026-06-18-post-url-help-design.md).
const CAPTIONS: Record<string, string[]> = {
  threads: ["按下圖示", "按下圖示", "複製完成，回到此處貼上連結"],
  instagram: ["按下圖示", "按下圖示", "複製完成，回到此處貼上連結"],
  miin: ["按下圖示", "按下圖示", "按下圖示並複製完成，回到此處貼上連結"],
};

describe("postUrlHelp — per-adapter walkthrough", () => {
  it("every registered adapter ships a non-empty postUrlHelp", () => {
    for (const a of ADAPTERS) expect(a.postUrlHelp.length).toBeGreaterThan(0);
  });

  for (const a of ADAPTERS) {
    describe(a.key, () => {
      it("has exactly the spec'd captions in order", () => {
        expect(a.postUrlHelp.map((s) => s.text)).toEqual(CAPTIONS[a.key]);
      });

      it("each step image is /help/<key>/step-N.webp in order", () => {
        a.postUrlHelp.forEach((step, i) => {
          expect(step.image).toBe(`/help/${a.key}/step-${i + 1}.webp`);
        });
      });

      it("each referenced image exists under public/", () => {
        for (const step of a.postUrlHelp) {
          const file = join(process.cwd(), "public", step.image);
          expect(existsSync(file), `missing asset: public${step.image}`).toBe(true);
        }
      });
    });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/binding/platforms/post-url-help.test.ts`
Expected: FAIL — `postUrlHelp` does not exist on the adapters (TS error / `undefined.length`).

- [ ] **Step 3: Add the `PostUrlStep` type + `postUrlHelp` member**

In `lib/binding/platforms/types.ts`, add the type just above the `PlatformAdapter` interface:

```ts
/** One step in the per-platform "how to find the post URL" walkthrough (text + screenshot). */
export type PostUrlStep = {
  /** 繁中 instruction for this step. */
  text: string;
  /** Static path under public/, e.g. "/help/miin/step-1.webp". */
  image: string;
  /** Screenshot alt text; defaults to a step-numbered form of `text` when omitted. */
  alt?: string;
};
```

Then, inside the `PlatformAdapter` interface, add this member immediately after the `postUrlPlaceholder` line:

```ts
  /** Ordered walkthrough for finding a post's URL on this platform (text + screenshot per step). */
  readonly postUrlHelp: readonly PostUrlStep[];
```

(Making it **required** means `tsc` now fails for all three adapters until Steps 4–6 add the arrays — that is the intended compile-time coverage.)

- [ ] **Step 4: Add `postUrlHelp` to the Threads adapter**

In `lib/binding/platforms/threads.ts`, inside `export const threadsAdapter`, add immediately after the `postUrlPlaceholder: "...",` line:

```ts
  postUrlHelp: [
    { text: "按下圖示", image: "/help/threads/step-1.webp" },
    { text: "按下圖示", image: "/help/threads/step-2.webp" },
    { text: "複製完成，回到此處貼上連結", image: "/help/threads/step-3.webp" },
  ],
```

- [ ] **Step 5: Add `postUrlHelp` to the Instagram adapter**

In `lib/binding/platforms/instagram.ts`, inside `export const instagramAdapter`, add immediately after the `postUrlPlaceholder: "...",` line:

```ts
  postUrlHelp: [
    { text: "按下圖示", image: "/help/instagram/step-1.webp" },
    { text: "按下圖示", image: "/help/instagram/step-2.webp" },
    { text: "複製完成，回到此處貼上連結", image: "/help/instagram/step-3.webp" },
  ],
```

- [ ] **Step 6: Add `postUrlHelp` to the miin adapter**

In `lib/binding/platforms/miin.ts`, inside `export const miinAdapter`, add immediately after the `postUrlPlaceholder: "...",` line:

```ts
  postUrlHelp: [
    { text: "按下圖示", image: "/help/miin/step-1.webp" },
    { text: "按下圖示", image: "/help/miin/step-2.webp" },
    { text: "按下圖示並複製完成，回到此處貼上連結", image: "/help/miin/step-3.webp" },
  ],
```

- [ ] **Step 7: Run tsc + the test to verify they pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run lib/binding/platforms/post-url-help.test.ts`
Expected: PASS (all describe blocks green). If the asset-existence check fails, confirm the 9 `.webp` are present: `ls public/help/*/step-*.webp` should list 9 files.

- [ ] **Step 8: Stage the code + the 9 WebP assets and commit**

The `.webp` are untracked (PNG sources are gitignored). Stage exact paths only (never `git add -A`):

```bash
git add lib/binding/platforms/types.ts \
        lib/binding/platforms/threads.ts \
        lib/binding/platforms/instagram.ts \
        lib/binding/platforms/miin.ts \
        lib/binding/platforms/post-url-help.test.ts \
        public/help/threads/step-1.webp public/help/threads/step-2.webp public/help/threads/step-3.webp \
        public/help/instagram/step-1.webp public/help/instagram/step-2.webp public/help/instagram/step-3.webp \
        public/help/miin/step-1.webp public/help/miin/step-2.webp public/help/miin/step-3.webp
git commit -m "feat(add): per-platform postUrlHelp data + assets

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Before committing, sanity-check scope: `git diff --cached --name-only` should list exactly the 5 code files + 9 webp (no PNG sources, no `.DS_Store`).

---

## Task 2: Wire the walkthrough into the wizard

**Files:**
- Modify: `app/(site)/add/[platform]/AddAccountWizard.tsx`
- Modify: `app/(site)/add/[platform]/page.tsx`

**Verification:** `tsc` + manual (no DOM test harness in this repo — see "Testing reality" above).

- [ ] **Step 1: Import the `PostUrlStep` type in the wizard**

In `app/(site)/add/[platform]/AddAccountWizard.tsx`, add below the existing `./actions` import:

```tsx
import type { PostUrlStep } from "@/lib/binding/platforms/types";
```

- [ ] **Step 2: Add `postUrlHelp` to the `Props` type and destructure it**

Change the `Props` type to add the new field (place it after `composeIntentUrl`):

```tsx
type Props = {
  platform: string;
  label: string;
  rid: string;
  template: string;
  postUrlPlaceholder: string;
  composeIntentUrl: string | null;
  postUrlHelp: readonly PostUrlStep[];
  igNote?: boolean;
  recover?: string | null;
};
```

Add `postUrlHelp` to the destructured parameter list of `AddAccountWizard`:

```tsx
export function AddAccountWizard({ platform, label, rid, template, postUrlPlaceholder, composeIntentUrl, postUrlHelp, igNote, recover }: Props) {
```

- [ ] **Step 3: Render the help block in the non-expired branch**

In the JSX, replace the non-expired branch (the `) : (` arm holding the paste `<form>`) so the form and the new help `<section>` are siblings inside a fragment. Replace:

```tsx
      ) : (
        <form action={action} className="form paste-form">
          <label className="label" htmlFor="url">貼文發佈後，把貼文網址貼回這裡</label>
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="rid" value={rid} />
          {recover ? <input type="hidden" name="recover" value={recover} /> : null}
          <input id="url" name="url" type="url" required placeholder={postUrlPlaceholder} className="input" />
          {state.error ? <p className="error">{state.error}</p> : null}
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "驗證中…" : "驗證並繼續 →"}
          </button>
        </form>
      )}
```

with:

```tsx
      ) : (
        <>
          <form action={action} className="form paste-form">
            <label className="label" htmlFor="url">貼文發佈後，把貼文網址貼回這裡</label>
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={rid} />
            {recover ? <input type="hidden" name="recover" value={recover} /> : null}
            <input id="url" name="url" type="url" required placeholder={postUrlPlaceholder} className="input" />
            {state.error ? <p className="error">{state.error}</p> : null}
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "驗證中…" : "驗證並繼續 →"}
            </button>
          </form>
          {postUrlHelp.length > 0 ? (
            <section className="posturl-help">
              <h2 className="posturl-help-title">找不到貼文網址？這樣取得</h2>
              <ol className="posturl-help-steps">
                {postUrlHelp.map((s, i) => (
                  <li key={i}>
                    <span className="posturl-help-text">{s.text}</span>
                    <img src={s.image} alt={s.alt ?? `步驟 ${i + 1}：${s.text}`} loading="lazy" />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      )}
```

(Only the non-expired branch changes; the `state.expired` branch is untouched — the walkthrough is irrelevant when the paste form is gone.)

- [ ] **Step 4: Pass the prop from the page**

In `app/(site)/add/[platform]/page.tsx`, add the prop to the `<AddAccountWizard … />` element (after the `composeIntentUrl=` line):

```tsx
        postUrlHelp={adapter.postUrlHelp}
```

- [ ] **Step 5: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no errors (the wizard now requires `postUrlHelp`, and the page supplies it).

- [ ] **Step 6: Commit**

```bash
git add app/(site)/add/[platform]/AddAccountWizard.tsx app/(site)/add/[platform]/page.tsx
git commit -m "feat(add): render postUrlHelp walkthrough below submit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Style the walkthrough

**Files:**
- Modify: `app/globals.css`

**Verification:** manual visual check (CSS is not unit-tested in this repo).

- [ ] **Step 1: Add the `.posturl-help*` classes**

Append to the Slice-2 wizard block in `app/globals.css` (e.g. right after the `.url-preview { … }` line). Uses existing tokens (`--fg`, `--muted`) and mirrors `.template`'s border:

```css
/* Add-wizard: "how to find the post URL" walkthrough (below the submit button). */
.posturl-help { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
.posturl-help-title { margin: 0; font-size: 0.8rem; font-weight: 600; color: var(--muted); }
.posturl-help-steps { margin: 0; padding-left: 1.4rem; display: flex; flex-direction: column; gap: 0.75rem; }
.posturl-help-steps li { color: var(--fg); }
.posturl-help-text { display: block; font-size: 0.85rem; margin-bottom: 0.4rem; }
.posturl-help-steps li img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 900 / 351;
  border-radius: 0.6rem;
  border: 1px solid #2a2a33;
}
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`
- Log in, go to `/add/threads`, click **產生驗證貼文** to reveal the wizard.
- Confirm: below the **驗證並繼續 →** button there is a `找不到貼文網址？這樣取得` heading and a numbered list of **3** screenshots; each image loads (no broken icon) from `/help/threads/step-N.webp`; the list reserves space (no layout jump on load).
- Repeat for `/add/instagram` and `/add/miin` — each shows its own 3 images and miin's step-3 caption reads `按下圖示並複製完成，回到此處貼上連結`.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(add): style postUrlHelp walkthrough

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full verification + docs

**Files:**
- Modify: `docs/devlog.md`
- Modify: `todo.md` (cross off the relevant item if present)

- [ ] **Step 1: Run the full type + test suite**

Run: `npx tsc --noEmit` → Expected: clean.
Run: `npx vitest run` → Expected: all green (including the new `post-url-help.test.ts`).

- [ ] **Step 2: Add the devlog entry (v0.21.0)**

Follow CLAUDE.md "Devlog format". Add a TL;DR row at the top of the table linking to the new anchor, and a section below `---`:

```markdown
## v0.21.0 — add-wizard post-URL walkthrough (2026-06-18)
**Review:** not yet
**Design docs:**
- Post-URL help: [Spec](superpowers/specs/2026-06-18-post-url-help-design.md) [Plan](superpowers/plans/2026-06-18-post-url-help.md)
**What was built:**
- Per-platform "how to find the post URL" walkthrough (3 steps + screenshots) below the wizard's submit button, for Threads / Instagram / miin.
- New `postUrlHelp` field on `PlatformAdapter`; screenshots shipped as 900×351 WebP under `public/help/`.
**Key technical learnings:**
- `[note]` Help steps live on the adapter seam, so adding a platform = register its glyph + adapter + `postUrlHelp` (no wizard change).
- `[insight]` Uniform image ratio lets CSS pin `aspect-ratio: 900/351` → zero layout shift for the lazy, below-the-fold images.
- `[gotcha]` Repo tests run in node with no DOM harness; the regression net is adapter-data + on-disk asset existence, not a component render test.
```

(Use the final-commit timestamp from `git log` if disambiguation is needed; date-only is fine.)

- [ ] **Step 3: Commit the docs**

```bash
git add docs/devlog.md todo.md
git commit -m "docs: devlog v0.21.0 — post-URL walkthrough

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Open the PR (only on the user's "ship it")**

Per CLAUDE.md "Raise a PR" flow: branch off `main`, confirm scope with `git diff --name-only main...HEAD`, then `gh pr create --base main`. **Do not merge** — the user reviews the Vercel preview and squash-merges themselves. Tagging (`v0.21.0`) is a separate explicit step after merge.

---

## Self-Review

- **Spec coverage:** §A data model → Task 1 Step 3. §B per-adapter captions → Task 1 Steps 4–6 (+ asserted in Step 1). §C render (below submit, non-expired only, length-guard, numbered alt) → Task 2 Step 3. §D styling (aspect-ratio 900/351, `.template` border) → Task 3 Step 1. §E assets (commit only the 9 webp; PNG/`.DS_Store` ignored) → Task 1 Step 8. Decision "flexible array not 3-tuple" → `readonly PostUrlStep[]`. a11y `步驟 N：` alt default → Task 2 Step 3. All covered.
- **Placeholders:** none — every code/CSS/test step shows complete content.
- **Type consistency:** `PostUrlStep { text; image; alt? }` and `postUrlHelp: readonly PostUrlStep[]` are used identically in types.ts, all three adapters, the test, the wizard `Props`, and the page prop. `a.key` values (`threads`/`instagram`/`miin`) match the `public/help/<key>/` directories.
