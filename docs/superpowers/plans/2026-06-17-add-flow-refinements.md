# Add-Flow Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit `/add` platform picker, send onboarding there, and simplify the first (main) binding to "accept as primary (public) or cancel" — per `docs/superpowers/specs/2026-06-17-add-flow-refinements-design.md`.

**Architecture:** UI/routing + confirm-step behaviour only — **no data-model change**. A new `/add` server-component picker; a conditional onboarding redirect; the slug-confirm step drops its public/private toggle and keep-as-分身 branch; copy/vocabulary fixes. Builds on Slice 2 (`lib/binding/*`, `app/add/[platform]/*`, `app/r/[shortRef]`).

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), React 19, Vitest 4. Type/lint gate is **`npx tsc --noEmit` only** (no ESLint; Next 16 removed `next lint` — never run it). No RSC unit tests in this repo (vitest is `environment: "node"`); pages are covered by `tsc` + `next build`.

---

## Task 1: `/add` platform picker page + additive CSS

**Files:**
- Create: `app/add/page.tsx`
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Create `app/add/page.tsx`**

```tsx
// app/add/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";

// Display list of the MVP platforms. A platform is "active" iff the registry has an adapter
// (Slice 2: threads only); the rest render disabled with a 施工中 badge. Generic picker — no
// primary/non-primary framing here, so it's reusable for future non-primary binding.
const PLATFORMS = [
  { key: "threads", label: "Threads" },
  { key: "instagram", label: "Instagram" },
  { key: "miin", label: "miin.cc" },
] as const;

export default async function PlatformPickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="wrap">
      <h1 className="wordmark sm">選擇平台</h1>
      <p className="lede">選擇要驗證綁定的平台。</p>
      <div className="platform-list">
        {PLATFORMS.map((p) => {
          const active = !!getAdapter(p.key);
          return active ? (
            <a key={p.key} className="platform-tile" href={`/add/${p.key}`}>
              <span>{p.label}</span>
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <div key={p.key} className="platform-tile disabled" aria-disabled="true">
              <span>{p.label}</span>
              <span className="tag-wip">施工中</span>
            </div>
          );
        })}
      </div>
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 2: Append the additive CSS to `app/globals.css`**

Append to the END of `app/globals.css` (dark theme: `--bg:#0b0b0f`, `--fg:#f5f5f7`, `--muted:#8a8a94`; surfaces `#15151c`/border `#2a2a33`/radius `0.6rem`):

```css
/* --- Add-flow refinements: platform picker --- */
.platform-list { width: 100%; max-width: 28rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
.platform-tile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  background: #15151c;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
  color: var(--fg);
  text-decoration: none;
  font: inherit;
}
.platform-tile.disabled { color: var(--muted); background: #101015; border-style: dashed; cursor: not-allowed; }
.tag-wip { font-size: 0.8rem; color: var(--muted); border: 1px solid #2a2a33; border-radius: 0.4rem; padding: 0.1rem 0.5rem; }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/add/page.tsx app/globals.css
git commit -m "feat(add): /add platform picker (Threads active; IG/miin 施工中)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Onboarding redirect → conditional (`/add` for new users)

**Files:**
- Modify: `app/onboarding/actions.ts:55`
- Modify: `app/onboarding/actions.test.ts`

> TDD: the redirect target is asserted in the existing test. Update the expectations to the new behaviour (red), then change the action (green). A new user (no slug) goes to the `/add` picker; a provisioned user (re-editing their profile) returns to `/gua/{slug}`.

- [ ] **Step 1: Update the test expectations (red)**

In `app/onboarding/actions.test.ts`:

(a) Widen the `currentUser` type to carry an optional slug. Replace:

```typescript
let currentUser: { id: string; shortRef: string } | null = null;
```

with:

```typescript
let currentUser: { id: string; shortRef: string; slug?: string | null } | null = null;
```

(b) In BOTH existing tests, change the redirect assertion from `/r/abc123` to `/add`. Replace each of the two occurrences of:

```typescript
    expect(redirect).toHaveBeenCalledWith("/r/abc123");
```

with:

```typescript
    expect(redirect).toHaveBeenCalledWith("/add");
```

(c) Add a new test at the end of the `describe(...)` block (before its closing `});`) asserting the provisioned path:

```typescript
  it("redirects a provisioned user (with slug) back to their /gua page", async () => {
    currentUser = { id: "user_123", shortRef: "abc123", slug: "alice" };
    const result = await saveProfileAction({}, formOf({ displayName: "阿明", bio: "" }));

    expect(result).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith("/gua/alice");
  });
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npx vitest run app/onboarding/actions.test.ts`
Expected: FAIL — the two updated tests still see `redirect("/r/abc123")` and the new slug test sees `/r/abc123`, none matching the new expectations.

- [ ] **Step 3: Change the redirect in `app/onboarding/actions.ts`**

Replace the final line (`app/onboarding/actions.ts:55`):

```typescript
  redirect(`/r/${user.shortRef}`);
```

with:

```typescript
  // New 正身 (no main yet) → pick a platform to set their main; a provisioned user
  // re-editing their profile → back to their public page.
  redirect(user.slug ? `/gua/${user.slug}` : "/add");
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `npx vitest run app/onboarding/actions.test.ts`
Expected: PASS (all cases, including the new provisioned-user case).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/actions.ts app/onboarding/actions.test.ts
git commit -m "feat(onboarding): send new users to the /add platform picker (provisioned → /gua)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Route add-account entries through `/add` + copy renames

**Files:**
- Modify: `app/r/[shortRef]/page.tsx` (two `/add/threads` links → `/add`)
- Modify: `app/add/[platform]/page.tsx:38` (button label)
- Modify: `app/gua/[slug]/page.tsx:20` (`建置中` → `施工中`)

- [ ] **Step 1: Point both `/r` CTAs at the picker**

In `app/r/[shortRef]/page.tsx` there are exactly two `href="/add/threads"` links (the slug-taken "驗證其他帳號 →" escape and the main "＋ 驗證另一個帳號當主要帳號 →" CTA). Change **both** to `href="/add"`. Replace each occurrence of:

```tsx
href="/add/threads"
```

with:

```tsx
href="/add"
```

(There are 2 occurrences in this file; both should change.)

- [ ] **Step 2: Rename the wizard button**

In `app/add/[platform]/page.tsx`, replace:

```tsx
          <button type="submit" className="btn-primary">產生驗證貼文範本</button>
```

with:

```tsx
          <button type="submit" className="btn-primary">產生驗證貼文</button>
```

- [ ] **Step 3: Switch the `/gua` stub to `施工中`**

In `app/gua/[slug]/page.tsx`, replace:

```tsx
      <p className="lede">正身頁建置中（Slice 3）。</p>
```

with:

```tsx
      <p className="lede">正身頁施工中（Slice 3）。</p>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add "app/r/[shortRef]/page.tsx" "app/add/[platform]/page.tsx" "app/gua/[slug]/page.tsx"
git commit -m "feat(add): route add-account entries through /add; 產生驗證貼文 + 施工中 copy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: First-binding confirm rework — accept-as-primary or cancel

**Files:**
- Modify: `app/add/[platform]/confirm/ConfirmForms.tsx` (full rewrite below)
- Modify: `app/add/[platform]/confirm/actions.ts` (remove `keepAsAccountAction`)
- Modify: `app/add/[platform]/confirm/page.tsx` (drop keep-as-分身 wiring; pass `platformLabel`)

> The first binding IS the main account, so it's always public. Remove the public/private toggle and the keep-as-分身 option from the slug-confirm path; the only outcomes are **接受為主要帳號** or **取消** (with a hint to delete the verification post). `OrdinaryConfirm` (provisioned user adding a non-primary 分身) keeps its visibility choice and gains the same cancel hint.

- [ ] **Step 1: Rewrite `app/add/[platform]/confirm/ConfirmForms.tsx`**

Replace the ENTIRE file with:

```tsx
// app/add/[platform]/confirm/ConfirmForms.tsx
"use client";

import { useState } from "react";

/** Hint shown by every cancel action: the verification post is now orphaned and can be deleted. */
function CancelHint({ platformLabel }: { platformLabel: string }) {
  return (
    <p className="hint">取消後，你可以到 {platformLabel} 刪除剛才發佈的驗證貼文。</p>
  );
}

/** §D.3 ordinary bind (provisioned user, non-primary 分身) — visibility choice (default 私密) + confirm/cancel. */
export function OrdinaryConfirm({
  platform,
  platformLabel,
  rid,
  confirm,
  cancel,
}: {
  platform: string;
  platformLabel: string;
  rid: string;
  confirm: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  return (
    <div className="confirm-actions">
      <form action={confirm} className="confirm-actions">
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <fieldset>
          <legend className="label">能見度設定</legend>
          <label className="label"><input type="radio" name="visibility" value="private" defaultChecked /> 私密（預設）</label>
          <label className="label"><input type="radio" name="visibility" value="public" /> 公開</label>
          <p className="hint warn">⚠ 一旦公開將永久顯示，無法改回私密。</p>
        </fieldset>
        <button type="submit" className="btn-primary">確認綁定</button>
      </form>
      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">這不是我要綁的帳號 · 取消</button>
      </form>
      <CancelHint platformLabel={platformLabel} />
    </div>
  );
}

/**
 * §D.4 first (main) binding — the main account is always public, so there is NO visibility choice
 * and NO keep-as-分身 option: the only outcomes are accept-as-primary (mint slug, public, main) or
 * cancel. A permanence checkbox gates the irreversible accept.
 */
export function SlugConfirm({
  platform,
  platformLabel,
  rid,
  slugUrl,
  taken,
  confirmAsSlug,
  cancel,
}: {
  platform: string;
  platformLabel: string;
  rid: string;
  slugUrl: string;
  taken: boolean;
  confirmAsSlug: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="confirm-actions">
      {taken ? (
        <p className="error">{slugUrl} 已被使用 —— 此網址無法作為你的正身頁，請取消後改用其他帳號驗證。</p>
      ) : (
        <>
          <p>你的永久公開網址將會是：</p>
          <p className="url-preview">{slugUrl}</p>
          <p className="hint warn">此網址永久固定且公開，無法更改。</p>
          <form action={confirmAsSlug} className="confirm-actions">
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={rid} />
            <label className="gate">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> 我了解此網址無法更改
            </label>
            <button type="submit" className="btn-primary" disabled={!agreed}>接受為主要帳號</button>
          </form>
        </>
      )}

      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">取消（不綁定此帳號）</button>
      </form>
      <CancelHint platformLabel={platformLabel} />
    </div>
  );
}
```

- [ ] **Step 2: Remove `keepAsAccountAction` from `app/add/[platform]/confirm/actions.ts`**

Delete the entire `keepAsAccountAction` function (the block starting `/** §D.4 keep-as-分身 ... */` through its closing `}`):

```typescript
/** §D.4 keep-as-分身: commit non-main with the chosen visibility, stay pre-provisioned. */
export async function keepAsAccountAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const visibility = (formData.get("visibility") === "public" ? "public" : "private") as Visibility;
  const { user, req } = await ownedResolvedRequest(rid, platform);

  const res = await commitBinding({ requestId: req.id, asMain: false, visibility, mintSlug: false });
  if (!res.ok && res.error === "duplicate_binding") {
    redirect(`/add/${platform}/confirm?rid=${rid}&err=dup`);
  }
  // Falls through here on success AND on not_resolvable (double-submit after a prior commit) —
  // both mean "the binding is done", so land the user on their 正身.
  redirect(`/r/${user.shortRef}`);
}
```

Leave `confirmOrdinaryAction`, `confirmAsSlugAction`, `cancelRequestAction`, and the `Visibility` import (still used by `confirmOrdinaryAction`) intact.

- [ ] **Step 3: Update `app/add/[platform]/confirm/page.tsx`**

(a) Remove `keepAsAccountAction` from the import block. Replace:

```typescript
import {
  cancelRequestAction,
  confirmAsSlugAction,
  confirmOrdinaryAction,
  keepAsAccountAction,
} from "./actions";
```

with:

```typescript
import {
  cancelRequestAction,
  confirmAsSlugAction,
  confirmOrdinaryAction,
} from "./actions";
```

(b) Update the three confirm-form usages to add `platformLabel={adapter.label}` and drop `keepAsAccount`. Replace the whole `{user.slug ? ( ... ) : adapter.slugEligible ? ( ... ) : ( ... )}` block:

```tsx
        {user.slug ? (
          // Owner already provisioned → ordinary bind (§D.3), commit here.
          <OrdinaryConfirm
            platform={platform}
            rid={req!.id}
            confirm={confirmOrdinaryAction}
            cancel={cancelRequestAction}
          />
        ) : adapter.slugEligible ? (
          // Pre-provisioned + slug-eligible platform → slug-confirm (§D.4).
          <SlugConfirm
            platform={platform}
            rid={req!.id}
            slugUrl={`${SITE_ORIGIN}/gua/${deriveSlug(req!.resolvedHandle!)}`}
            taken={err === "slug_taken" || !(await isSlugAvailable(deriveSlug(req!.resolvedHandle!)))}
            confirmAsSlug={confirmAsSlugAction}
            keepAsAccount={keepAsAccountAction}
            cancel={cancelRequestAction}
          />
        ) : (
          // Not slug-eligible (e.g. a future miin-only path) → keep-as-分身 / cancel only (§D.5).
          <SlugConfirm
            platform={platform}
            rid={req!.id}
            slugUrl=""
            taken={true}
            confirmAsSlug={confirmAsSlugAction}
            keepAsAccount={keepAsAccountAction}
            cancel={cancelRequestAction}
          />
        )}
```

with:

```tsx
        {user.slug ? (
          // Owner already provisioned → ordinary bind of a non-primary 分身 (§D.3).
          <OrdinaryConfirm
            platform={platform}
            platformLabel={adapter.label}
            rid={req!.id}
            confirm={confirmOrdinaryAction}
            cancel={cancelRequestAction}
          />
        ) : adapter.slugEligible ? (
          // First (main) binding on a slug-eligible platform → accept-as-primary or cancel (§D.4).
          <SlugConfirm
            platform={platform}
            platformLabel={adapter.label}
            rid={req!.id}
            slugUrl={`${SITE_ORIGIN}/gua/${deriveSlug(req!.resolvedHandle!)}`}
            taken={err === "slug_taken" || !(await isSlugAvailable(deriveSlug(req!.resolvedHandle!)))}
            confirmAsSlug={confirmAsSlugAction}
            cancel={cancelRequestAction}
          />
        ) : (
          // Not slug-eligible (future miin-only; currently dead — miin 404s) → cancel only.
          <SlugConfirm
            platform={platform}
            platformLabel={adapter.label}
            rid={req!.id}
            slugUrl=""
            taken={true}
            confirmAsSlug={confirmAsSlugAction}
            cancel={cancelRequestAction}
          />
        )}
```

- [ ] **Step 4: Verify nothing else references `keepAsAccountAction`**

Run: `grep -rn "keepAsAccountAction" app/`
Expected: NO matches (the action and all usages are gone).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 (the `SlugConfirm`/`OrdinaryConfirm` prop changes line up; no unused imports).

- [ ] **Step 6: Commit**

```bash
git add "app/add/[platform]/confirm/ConfirmForms.tsx" "app/add/[platform]/confirm/actions.ts" "app/add/[platform]/confirm/page.tsx"
git commit -m "feat(confirm): first binding is accept-as-primary or cancel (public-only, no keep-as-分身)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS. The only changed unit test is `app/onboarding/actions.test.ts` (now asserts `/add` + the `/gua/{slug}` case); all binding `*.db.test.ts` suites still pass against the live DB or skip without one.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Production build**

Run: `npx next build`
Expected: succeeds; the route list now includes `/add` (the picker) alongside `/add/[platform]`, `/add/[platform]/confirm`, `/r/[shortRef]`, `/gua/[slug]`. (The `build` script runs `prisma migrate deploy` first — `DATABASE_URL`/`DATABASE_URL_UNPOOLED` are set locally; the slice2 migration is already applied, so it's a no-op.)

- [ ] **Step 4: Commit any incidental fixes**

```bash
git add -A
git commit -m "chore(add-flow): green test + typecheck + build gate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If there is nothing to commit, skip this step.)

---

## Manual smoke (human-run, after merge/preview)

> The pages aren't in the vitest harness; confirm the flow on a preview with a working DB + login.

- [ ] Onboarding → **下一步：設定主要帳號 →** now lands on **`/add`** (選擇平台), with **Threads** clickable and **Instagram / miin.cc** gray + `施工中`.
- [ ] `/add` Threads → `/add/threads`; the button reads **產生驗證貼文**.
- [ ] After paste-back, the first-binding confirm shows **only** 接受為主要帳號 (permanence checkbox) + 取消 — **no** public/private radios, **no** keep-as-分身. The cancel area hints you can delete the verification post on Threads.
- [ ] Cancel → no `LinkedAccount` row; accept → mints the slug, redirects to `/gua/{handle}`.
- [ ] `/gua/{slug}` stub reads **正身頁施工中（Slice 3）**.

---

## Spec coverage check (self-review)

- **§A `/add` picker (Threads active; IG/miin 施工中)** → Task 1.
- **§B onboarding → `/add` (new) / `/gua/{slug}` (provisioned)** → Task 2 (TDD).
- **§C `/r` add-account CTA → `/add`** → Task 3 (both link occurrences).
- **§D first-binding = accept-as-primary or cancel; remove visibility toggle + keep-as-分身; cancel delete-post hint; `OrdinaryConfirm` unchanged (keeps visibility, gains hint); `keepAsAccountAction` removed; slug-taken → cancel-only** → Task 4.
- **§E renames (`產生驗證貼文`, `施工中`); `施工中` standard term** → Task 3.
- **§F tests/verification (`actions.test.ts` updates; tsc + build)** → Task 2 (test) + Task 5 (gate).

**Out of scope (correctly absent):** non-primary binding entry via `/add` (page is built generic), IG/miin adapters, any data-model change, Identity Card render (Slice 3).
