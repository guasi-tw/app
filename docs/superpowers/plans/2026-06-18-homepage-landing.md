# Homepage Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the thin `/` stub into the real landing page by curating the existing `/about` content onto `/`, sharing one content source and one CSS module between both pages.

**Architecture:** `/about` already holds a full landing page in `content.ts`. We promote that content + CSS to shared modules at `app/(site)/`, extract the two drift-prone visual blocks (`HowItWorks`, `ExampleCard`) into shared components used by both pages, and render a curated `/` (hero → how-it-works → demo card → closing CTA). The only logged-in/out difference is the CTA, isolated in a `LandingCta` component backed by a pure, unit-tested `landingCtaModel` helper. `/about` keeps rendering the full content set (zero drift — same objects).

**Tech Stack:** Next.js App Router (React Server Components), TypeScript, CSS Modules, Vitest (node environment — logic/content tests only; no DOM render tests in this repo).

**Spec:** `docs/superpowers/specs/2026-06-18-homepage-landing-design.md`

**Branch:** Work on a feature branch off `main` (e.g. `feat/homepage-landing`). Do not push or open a PR until the user says "ship it".

**Conventions:** Traditional Chinese (zh-Hant / Taiwan) for all user-facing copy. `git add` explicit paths only — never `git add -A`. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: Relocate content + CSS to shared modules

The landing content/styles are no longer about-only. Move them to `app/(site)/` and rename the export so both pages import one source.

**Files:**
- Rename: `app/(site)/about/content.ts` → `app/(site)/landing-content.ts`
- Rename: `app/(site)/about/content.test.ts` → `app/(site)/landing-content.test.ts`
- Rename: `app/(site)/about/about.module.css` → `app/(site)/landing.module.css`
- Modify: `app/(site)/about/page.tsx` (import paths + symbol)

- [ ] **Step 1: Move the three files with git (preserves history)**

```bash
git mv "app/(site)/about/content.ts"        "app/(site)/landing-content.ts"
git mv "app/(site)/about/content.test.ts"   "app/(site)/landing-content.test.ts"
git mv "app/(site)/about/about.module.css"  "app/(site)/landing.module.css"
```

- [ ] **Step 2: Rename the export in `landing-content.ts`**

In `app/(site)/landing-content.ts`, change the one export line:

```ts
// from:
export const aboutContent = {
// to:
export const landingContent = {
```

Leave the `AboutStep` / `AboutTrustItem` / `AboutAccount` type names as-is (renaming them is churn with no benefit; they're internal).

- [ ] **Step 3: Update the test to the new path + symbol**

```bash
sed -i '' 's#from "./content"#from "./landing-content"#; s/aboutContent/landingContent/g' "app/(site)/landing-content.test.ts"
```

- [ ] **Step 4: Update `about/page.tsx` imports**

In `app/(site)/about/page.tsx`, change the two import lines:

```ts
// from:
import { aboutContent as c } from "./content";
import styles from "./about.module.css";
// to:
import { landingContent as c } from "../landing-content";
import styles from "../landing.module.css";
```

- [ ] **Step 5: Verify types + existing tests pass**

Run: `npx tsc --noEmit && npx vitest run "app/(site)/landing-content.test.ts"`
Expected: tsc clean; all existing content tests PASS under the new filename.

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/landing-content.ts" "app/(site)/landing-content.test.ts" "app/(site)/landing.module.css" "app/(site)/about/page.tsx"
git commit -m "refactor(landing): relocate about content + css to shared modules

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Make the demo card 3-platform + add the live-card link

The mock card currently shows Threads ×2 + Instagram (2 distinct platforms). Change it to Threads + Instagram + miin.cc so it tells the cross-platform survival story, and add a link to the real card.

**Files:**
- Modify: `app/(site)/landing-content.ts`
- Test: `app/(site)/landing-content.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("aboutContent — accuracy constraints", ...)` block (now `landingContent`) in `app/(site)/landing-content.test.ts`:

```ts
it("the example profile demonstrates three distinct platforms (cross-platform story)", () => {
  const platforms = [
    ...new Set(landingContent.exampleProfile.accounts.map((a) => a.platform)),
  ].sort();
  expect(platforms).toEqual(["Instagram", "Threads", "miin.cc"]);
});

it("the example profile links to a real public 正身 card", () => {
  expect(landingContent.exampleProfile.liveLink.href).toBe("/gua/gua.si.tw");
  expect(landingContent.exampleProfile.liveLink.label).toContain("正身");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "app/(site)/landing-content.test.ts"`
Expected: FAIL — third platform is still `Threads`, and `liveLink` is `undefined`.

- [ ] **Step 3: Update the content**

In `app/(site)/landing-content.ts`, inside `exampleProfile`, change the third account and add `liveLink`:

```ts
    accounts: [
      { platform: "Threads", handle: "@meimei", verified: "驗證於 2026/05", main: true },
      { platform: "Instagram", handle: "@meimei.ig", verified: "驗證於 2026/05" },
      { platform: "miin.cc", handle: "@meimei", verified: "驗證於 2026/06" },
    ] satisfies AboutAccount[],
    liveLink: { label: "看一個真實的正身 →", href: "/gua/gua.si.tw" },
```

(The `accounts` array stays `satisfies AboutAccount[]`; `platform` is a string, so `"miin.cc"` is valid. `liveLink` is a new key on the `as const` object — no type change needed.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "app/(site)/landing-content.test.ts"`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add "app/(site)/landing-content.ts" "app/(site)/landing-content.test.ts"
git commit -m "feat(landing): demo card shows 3 platforms + links to live 正身

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Extract the `HowItWorks` shared component

Both `/` and `/about` show the 3-step how-it-works. Extract it so it can't drift. (The example-post anatomy stays inline in `/about` only — it's deep content.)

**Files:**
- Create: `app/(site)/HowItWorks.tsx`
- Modify: `app/(site)/about/page.tsx`

- [ ] **Step 1: Create the component**

Create `app/(site)/HowItWorks.tsx`:

```tsx
import { landingContent as c } from "./landing-content";
import styles from "./landing.module.css";

// The 3-step how-it-works block (建立正身 → 綁定分身 → 驗明正身) + the 正身/分身 gloss.
// Shared by the homepage and the about page so the steps can't drift.
export function HowItWorks() {
  return (
    <>
      <h2 className={styles.h2}>{c.how.title}</h2>
      <p className={styles.body}>{c.how.body}</p>
      <p className={styles.gloss}>{c.how.gloss}</p>
      <div className={styles.steps}>
        {c.how.steps.map((s) => (
          <div className={styles.step} key={s.n}>
            <div className={styles.stepNum}>{s.n}</div>
            <div className={styles.stepText}>
              <strong className={styles.strong}>{s.title}</strong>　{s.body}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Use it in `about/page.tsx`**

In `app/(site)/about/page.tsx`, add the import near the other imports:

```ts
import { HowItWorks } from "../HowItWorks";
```

Then in the `{/* 3 how it works + example post */}` section, replace the inline title/body/gloss/steps markup with `<HowItWorks />`, keeping the example-post block. The section becomes:

```tsx
        {/* 3 how it works + example post */}
        <section className={styles.section}>
          <HowItWorks />

          <div className={styles.post}>
            <span className={styles.badge}>{c.examplePost.badge}</span>
            <div className={styles.postHead}>
              <div className={styles.postAvatar} />
              <div className={styles.postAuthor}>
                {c.examplePost.author}{" "}
                <span className={styles.postTime}>· {c.examplePost.time}</span>
              </div>
            </div>
            <div className={styles.postBody}>
              <div className={styles.link}>{c.examplePost.tag}</div>
              <div>{c.examplePost.headline}</div>
              <div className={styles.gap}>{c.examplePost.linkIntro}</div>
              <div className={styles.link}>{c.examplePost.shortUrl}</div>
              <div className={styles.gap}>
                {c.examplePost.codeLabel}
                <strong className={styles.strong}>{c.examplePost.code}</strong>
              </div>
            </div>
            <div className={styles.preview}>
              <div className={styles.previewDomain}>{c.examplePost.previewDomain}</div>
              <div className={styles.previewTitle}>{c.examplePost.previewTitle}</div>
            </div>
            <p className={styles.postCaption}>{c.examplePost.caption}</p>
          </div>
        </section>
```

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests PASS (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add "app/(site)/HowItWorks.tsx" "app/(site)/about/page.tsx"
git commit -m "refactor(landing): extract shared HowItWorks component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Extract the `ExampleCard` shared component

The demo profile card is the centerpiece both pages show. Extract it (the drift-prone unit), with an option to show the live-card link instead of the share caption.

**Files:**
- Create: `app/(site)/ExampleCard.tsx`
- Modify: `app/(site)/about/page.tsx`

- [ ] **Step 1: Create the component**

Create `app/(site)/ExampleCard.tsx`:

```tsx
import { landingContent as c } from "./landing-content";
import styles from "./landing.module.css";

// The mock 驗明正身 card (a sample public identity card). Shared by the about page
// (illustrative, with the share caption) and the homepage (with a link through to a
// real card). `withLiveLink` swaps the caption for the 看一個真實的正身 → button.
export function ExampleCard({ withLiveLink = false }: { withLiveLink?: boolean }) {
  const p = c.exampleProfile;
  return (
    <>
      <h2 className={styles.h2}>{p.sectionTitle}</h2>
      <p className={styles.sectionDesc}>{p.sectionDesc}</p>

      <div className={styles.card}>
        <span className={styles.badge}>{p.badge}</span>
        <div className={styles.cardHead}>
          <div className={styles.avatar} aria-hidden="true">{p.avatarInitial}</div>
          <div className={styles.pname}>{p.name}</div>
          <div className={styles.purl}>{p.handleUrl}</div>
          <span className={styles.pcount}>{p.count}</span>
        </div>
        <div className={styles.tabbar}>
          <span className={styles.tabActive}>{p.tabs.accounts}</span>
          <span className={styles.tab}>{p.tabs.timeline}</span>
        </div>
        <div className={styles.accounts}>
          <p className={styles.guarantee}>{p.guarantee}</p>
          {p.accounts.map((a) => (
            <div className={styles.account} key={`${a.platform}-${a.handle}`}>
              <div className={styles.acctId}>
                <span className={styles.acctNameLine}>
                  <span className={styles.acctHandle}>{a.handle}</span>
                  {a.main && <span className={styles.acctMain}>★ 主要</span>}
                </span>
                <span className={styles.acctMeta}>
                  {a.platform} · {a.verified}
                </span>
              </div>
              <span className={styles.acctOut} aria-hidden="true">↗</span>
            </div>
          ))}
        </div>
      </div>

      {withLiveLink ? (
        <a className="btn-secondary" href={p.liveLink.href}>
          {p.liveLink.label}
        </a>
      ) : (
        <p className={styles.cardCaption}>{p.shareCaption}</p>
      )}
    </>
  );
}
```

Note the `key={`${a.platform}-${a.handle}`}` — two accounts can now share a handle (`@meimei` on Threads and miin.cc), so keying on handle alone would collide.

- [ ] **Step 2: Use it in `about/page.tsx`**

In `app/(site)/about/page.tsx`, add the import:

```ts
import { ExampleCard } from "../ExampleCard";
```

Replace the entire `{/* 4 example profile card */}` section's inner markup with the component (no live link on about):

```tsx
        {/* 4 example profile card */}
        <section className={styles.section}>
          <ExampleCard />
        </section>
```

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(site)/ExampleCard.tsx" "app/(site)/about/page.tsx"
git commit -m "refactor(landing): extract shared ExampleCard component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `landingCtaModel` helper + `LandingCta` component

Isolate the only logged-in/out difference behind a pure, unit-tested helper.

**Files:**
- Create: `app/(site)/landing-cta-model.ts`
- Create: `app/(site)/landing-cta-model.test.ts`
- Create: `app/(site)/LandingCta.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/(site)/landing-cta-model.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { landingCtaModel } from "./landing-cta-model";

describe("landingCtaModel", () => {
  it("logged-out → sign-in CTA", () => {
    expect(landingCtaModel(null)).toEqual({ kind: "signin" });
  });

  it("logged-in with a slug → link to the public card", () => {
    expect(landingCtaModel({ slug: "meimei", shortRef: "abc" })).toEqual({
      kind: "home",
      href: "/gua/meimei",
    });
  });

  it("logged-in without a slug → link to the short ref", () => {
    expect(landingCtaModel({ slug: null, shortRef: "abc" })).toEqual({
      kind: "home",
      href: "/r/abc",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/(site)/landing-cta-model.test.ts"`
Expected: FAIL with "Failed to resolve import ./landing-cta-model".

- [ ] **Step 3: Write the helper**

Create `app/(site)/landing-cta-model.ts`:

```ts
import { ownerHomePath } from "@/lib/identity/urls";

// The landing-page CTA depends only on auth state: a logged-out visitor gets the
// Google sign-in button; a logged-in owner gets a link to their own 正身. The model
// is pure so the branch is unit-tested without rendering.
export type LandingCtaModel =
  | { kind: "signin" }
  | { kind: "home"; href: string };

export function landingCtaModel(
  user: { slug: string | null; shortRef: string } | null,
): LandingCtaModel {
  return user
    ? { kind: "home", href: ownerHomePath(user) }
    : { kind: "signin" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(site)/landing-cta-model.test.ts"`
Expected: PASS.

- [ ] **Step 5: Create the `LandingCta` component**

Create `app/(site)/LandingCta.tsx`:

```tsx
import { GoogleSignInButton } from "@/app/GoogleSignInButton";
import { landingContent as c } from "./landing-content";
import { landingCtaModel } from "./landing-cta-model";
import styles from "./landing.module.css";

// Renders the landing CTA for the current auth state (see landingCtaModel).
export function LandingCta({
  user,
}: {
  user: { slug: string | null; shortRef: string } | null;
}) {
  const model = landingCtaModel(user);

  if (model.kind === "home") {
    return (
      <a className="btn-secondary" href={model.href}>
        前往我的正身頁 →
      </a>
    );
  }

  return (
    <>
      <GoogleSignInButton block />
      <div className={styles.ctaNote}>{c.cta.note}</div>
    </>
  );
}
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "app/(site)/landing-cta-model.ts" "app/(site)/landing-cta-model.test.ts" "app/(site)/LandingCta.tsx"
git commit -m "feat(landing): auth-aware LandingCta + pure landingCtaModel helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Rewrite the homepage `/`

Compose the curated landing page from the shared pieces.

**Files:**
- Modify: `app/(site)/page.tsx` (full rewrite)
- Test: `app/(site)/page.test.ts` (create)
- Reference: `app/globals.css` (`.btn-secondary` exists; `landing.module.css` provides `page`/`inner`/`section`/`center`/`gold`/`hookTitle`/`body`/`ctaTitle`/`ctaSub`)

The home page's auth-branch logic was extracted to `landingCtaModel` (TDD'd in Task 5), so the page itself is thin composition. We rewrite it first, then add a composition guard (a render smoke test — node env can't assert DOM, so it only confirms the page composes without throwing for both auth states).

- [ ] **Step 1: Rewrite `page.tsx`**

Replace the entire contents of `app/(site)/page.tsx`:

```tsx
import { getCurrentUser } from "@/lib/identity/session";
import { landingContent as c } from "./landing-content";
import styles from "./landing.module.css";
import { HowItWorks } from "./HowItWorks";
import { ExampleCard } from "./ExampleCard";
import { LandingCta } from "./LandingCta";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* hero: problem hook + one-line value prop + CTA */}
        <section className={`${styles.section} ${styles.center}`}>
          <h1 className={styles.hookTitle}>{c.hook.title}</h1>
          <p className={styles.body}>{c.brand.body}</p>
          <LandingCta user={user} />
        </section>

        {/* how it works */}
        <section className={styles.section}>
          <HowItWorks />
        </section>

        {/* live demo card */}
        <section className={styles.section}>
          <ExampleCard withLiveLink />
        </section>

        {/* closing CTA */}
        <section className={`${styles.section} ${styles.gold} ${styles.center}`}>
          <h2 className={styles.ctaTitle}>{c.cta.title}</h2>
          <p className={styles.ctaSub}>{c.cta.subtitle}</p>
          <LandingCta user={user} />
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify types + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; full suite green (the old home test, if any, is replaced next).

- [ ] **Step 3: Add the composition guard test**

Create `app/(site)/page.test.ts` (node env — confirms the page composes for both auth states; the CTA branch itself is covered by `landing-cta-model.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({
  getCurrentUser: () => Promise.resolve(currentUser),
}));
// Stub the presentational children so the test doesn't pull in CSS / server actions.
vi.mock("./HowItWorks", () => ({ HowItWorks: () => null }));
vi.mock("./ExampleCard", () => ({ ExampleCard: () => null }));
vi.mock("./LandingCta", () => ({ LandingCta: () => null }));

import Home from "./page";

beforeEach(() => {
  currentUser = null;
});

describe("/ homepage", () => {
  it("renders for a logged-out visitor", async () => {
    currentUser = null;
    const el = await Home();
    expect(el).toBeTruthy();
  });

  it("renders for a logged-in owner", async () => {
    currentUser = { id: "u1", slug: "meimei", shortRef: "abc" };
    const el = await Home();
    expect(el).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/(site)/page.test.ts"`
Expected: PASS (both auth states compose without throwing).

- [ ] **Step 5: Visual check in the dev server**

Run: `npm run dev`, open `http://localhost:3000/`.
Confirm: hero (帳號被封了… + 把那句你最想喊… + sign-in button), 3-step how-it-works, the demo card showing **Threads + Instagram + miin.cc** with a 「看一個真實的正身 →」 button linking to `/gua/gua.si.tw`, and the closing CTA. Confirm `/about` still renders the full page unchanged. (Optional: sign in and confirm the hero/closing CTA become 「前往我的正身頁 →」.)

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/page.tsx" "app/(site)/page.test.ts"
git commit -m "feat(landing): homepage is now the curated landing page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Update docs (ship-time)

**Files:**
- Modify: `docs/routes.md`
- Modify: `docs/devlog.md`
- Modify: `todo.md` (if it lists a homepage item)

- [ ] **Step 1: Update `docs/routes.md`**

Refresh the `/` and `/about` rows in the Page routes table:

- `/` → "Home / landing page. Curated from the shared landing content (hero + how-it-works + live demo card + CTA). Logged in → CTA becomes 前往我的正身; logged out → Google sign-in CTA."
- `/about` → "關於 guasi — the deeper read (full landing content incl. example-post anatomy, 平台中立, 為什麼可信, 為什麼是現在, contact). Copy in `landing-content.ts` (shared with `/`), styled by `landing.module.css`."

- [ ] **Step 2: Add the devlog entry**

In `docs/devlog.md`: add a TL;DR row at the top of the table and a new `## vX.Y.0 — homepage landing page (2026-06-18)` section (pick the next version per the table; confirm with the user). Use the format in CLAUDE.md (Review: not yet / Design docs / What was built / Key technical learnings). Design-docs links:

```
**Design docs:**
- Homepage landing page: [Spec](superpowers/specs/2026-06-18-homepage-landing-design.md) [Plan](superpowers/plans/2026-06-18-homepage-landing.md)
```

- [ ] **Step 3: Commit**

```bash
git add docs/routes.md docs/devlog.md todo.md
git commit -m "docs: homepage landing page — routes + devlog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes / sequencing

- The 「看一個真實的正身 →」 link points at `/gua/gua.si.tw`, which **does not exist yet** (404 today). It won't block this work — the static demo card ships independently — but the link is dead until that account is set up (see the separate "service account" decision). Set it up before public launch.
- No new marketing copy is written here beyond two micro-strings (`liveLink.label`, reusing the existing 前往我的正身頁 label). Search / FAQ / blog remain out of scope.
