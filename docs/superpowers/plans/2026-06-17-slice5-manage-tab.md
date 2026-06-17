# Slice 5 — Manage tab (分身管理) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the four owner controls on the `/gua/{slug}` 管理 tab (disclose, set-as-main, condition flags, 恢復·重新驗證), ship the profile-edit surface, add multi-line bio support, and `onboardedAt`-based post-login routing — Threads-only.

**Architecture:** A two-phase release (spec §M). **Release 1** ships the additive schema delta alone (a nullable `User.onboardedAt` + two unused `BindingEventType` enum values, backfilled) so production's DB is forward-compatible before any feature code merges. **Release 2** builds the features on the already-migrated schema. New mutating logic lives in `lib/binding/repo.ts` (pure DB functions, DB-tested) and is exposed through server actions; the manage UI uses an inline-expand confirm pattern (client state in a new `ManageChips` component, no modal). Re-verify reuses the existing Add flow, scoped to a target account via a `recover` query param.

**Tech Stack:** Next.js 16 App Router (React 19, Server Components + Server Actions), Prisma 6 + Neon Postgres, Vitest (node env — DB tests `skipIf(!DATABASE_URL)`, no React-render tests), TypeScript strict.

---

## File Structure

**Release 1 — schema only (its own PR → merge → prod):**
- Modify `prisma/schema.prisma` — add `User.onboardedAt`, add `disclosed` + `set_main` to `BindingEventType`.
- Create `prisma/migrations/<ts>_slice5_schema/migration.sql` — generated, then hand-edited to add the backfill `UPDATE`.

**Release 2 — features:**
- `lib/identity/profile.ts` — `BIO_MAX → 200`, new `BIO_MAX_LINES`, newline-collapse + line-cap in `sanitizeBio`.
- `app/(site)/gua/[slug]/types.ts` — `AccountView` gains `accountId`.
- `app/(site)/gua/[slug]/accounts.ts` — populate `accountId` in `toView`.
- `lib/binding/repo.ts` — new `discloseBinding`, `setMainBinding`, `reportCondition`, `reverifyBinding`; `set_main` event added to `commitBinding`; **remove** `provisionExistingAccount` + `listProvisionCandidates` + `ProvisionResult`.
- `app/(site)/gua/[slug]/actions.ts` — new `discloseAction`, `setMainAction`, `reportConditionAction` (+ `revalidatePath`).
- `app/(site)/gua/[slug]/ManageChips.tsx` — **new** client component (inline-confirm).
- `app/(site)/gua/[slug]/AccountRow.tsx` — drop the stub, render `<ManageChips>`.
- `app/(site)/add/[platform]/page.tsx`, `.../actions.ts`, `.../AddAccountWizard.tsx` — thread the `recover` param.
- `app/(site)/add/[platform]/confirm/page.tsx`, `.../actions.ts`, `.../ConfirmForms.tsx` — recovery branch + `recoverAction` + `RecoverConfirm`.
- `app/(auth)/post-login/page.tsx` — `onboardedAt` branch.
- `app/(site)/onboarding/actions.ts` — stamp `onboardedAt` once.
- `app/(site)/ProfileForm.tsx` — **new** shared form (counters + disabled-save), used by onboarding + settings.
- `app/(site)/onboarding/page.tsx` — render `ProfileForm`; **delete** `OnboardingForm.tsx`.
- `app/(site)/settings/page.tsx` — **new** edit page.
- `app/(site)/settings/avatar/page.tsx`, `.../AvatarForm.tsx`, `.../actions.ts` — **new** avatar page.
- `lib/identity/repo.ts` — `updateUserProfile` gains `onboardedAt?`; new `updateUserAvatar`.
- `app/(site)/gua/[slug]/IdentityCard.tsx` — enable 編輯個人資料 link.
- `app/globals.css` — `.id-bio` `pre-line`, inline-confirm panel + chip styles, counter.
- Docs: `docs/routes.md`, `docs/devlog.md`, `todo.md`.

---

# RELEASE 1 — schema only

> Ship this as its **own PR**, merge, and let it deploy to prod **before** starting Release 2. It is behavior-inert (a nullable column + two unused enum values), so it changes nothing at runtime but makes prod's DB forward-compatible.

---

### Task 1: Schema delta + backfill migration

**Files:**
- Modify: `prisma/schema.prisma:34-59` (User model) and `:131-137` (BindingEventType enum)
- Create: `prisma/migrations/<timestamp>_slice5_schema/migration.sql`

- [ ] **Step 1: Add the two enum values**

In `prisma/schema.prisma`, change the `BindingEventType` enum to:

```prisma
enum BindingEventType {
  bound
  unbound
  reported_banned
  reported_hacked
  re_verified
  disclosed   // NEW — account went private → public (one-way)
  set_main    // NEW — account designated the main 分身
}
```

- [ ] **Step 2: Add the `onboardedAt` column**

In the `User` model, add this line right after `updatedAt DateTime  @updatedAt` (line 52):

```prisma
  onboardedAt   DateTime?   // first onboarding completion (§F routing)
```

- [ ] **Step 3: Generate the migration without applying it**

Run: `npx prisma migrate dev --name slice5_schema --create-only`
Expected: creates `prisma/migrations/<timestamp>_slice5_schema/migration.sql` and prints "you can now edit it". It does NOT apply yet.

- [ ] **Step 4: Hand-edit the migration to add the backfill**

Open the generated `migration.sql`. It should contain the two `ALTER TYPE ... ADD VALUE` lines and the `ADD COLUMN "onboardedAt"`. Append the backfill `UPDATE` so existing users are never re-routed to the first-time wizard. The final file should read (column type/quoting may vary — keep Prisma's generated lines, add only the `UPDATE`):

```sql
-- AlterEnum
ALTER TYPE "BindingEventType" ADD VALUE 'disclosed';
ALTER TYPE "BindingEventType" ADD VALUE 'set_main';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Backfill: existing users have already onboarded — stamp onboardedAt so they
-- skip the first-time wizard once Release 2's routing goes live (§M).
UPDATE "User" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
```

(The new enum values are only *added* here, never *used* in this migration, so the Postgres "can't use a new enum value in the same transaction that adds it" restriction doesn't apply — §M note.)

- [ ] **Step 5: Apply the migration locally + regenerate the client**

Run: `npx prisma migrate dev`
Expected: applies the pending migration; prints "Your database is now in sync with your schema"; runs `prisma generate`.

- [ ] **Step 6: Verify the type + existing tests still pass**

Run: `npx tsc --noEmit`
Expected: clean (the new `onboardedAt` field and enum values are now in the generated client types).

Run: `npx vitest run`
Expected: all existing tests green (behavior is unchanged).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: Slice 5 schema delta — onboardedAt + disclosed/set_main events (Release 1)

Additive, behavior-inert: nullable User.onboardedAt (backfilled to createdAt)
plus two unused BindingEventType values. Ships ahead of feature code so prod's
DB is forward-compatible (§M two-phase release).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **STOP here for Release 1.** Open a PR (`gh pr create --base main`), let the user review the Vercel preview + squash-merge, and confirm prod migrated (`prisma migrate deploy` runs in the Vercel build). Only then begin Release 2.

---

# RELEASE 2 — features

---

### Task 2: Bio multi-line + limits (`sanitizeBio`)

**Files:**
- Modify: `lib/identity/profile.ts:5` (`BIO_MAX`) and `:27-37` (`sanitizeBio`)
- Modify: `app/globals.css` (the `.id-bio` rule, ~line 60 in the file's id-card block — search for `.id-bio`)
- Test: `lib/identity/profile.test.ts`

- [ ] **Step 1: Add the failing tests**

Append these cases inside the existing `describe("sanitizeBio", ...)` block in `lib/identity/profile.test.ts`:

```ts
  it("accepts a bio up to the new 200-char max", () => {
    expect(sanitizeBio("a".repeat(200)).ok).toBe(true);
    expect(sanitizeBio("a".repeat(201)).ok).toBe(false);
  });
  it("collapses 3+ consecutive newlines down to a single blank-line separator", () => {
    expect(sanitizeBio("a\n\n\n\nb")).toEqual({ ok: true, value: "a\n\nb" });
  });
  it("allows up to 8 lines and rejects a 9th", () => {
    expect(sanitizeBio(Array.from({ length: 8 }, (_, i) => `l${i}`).join("\n")).ok).toBe(true);
    expect(sanitizeBio(Array.from({ length: 9 }, (_, i) => `l${i}`).join("\n")).ok).toBe(false);
  });
```

Also add `BIO_MAX_LINES` to the import at the top of the test file:

```ts
import {
  sanitizeDisplayName,
  sanitizeBio,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  BIO_MAX_LINES,
} from "./profile";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/identity/profile.test.ts`
Expected: FAIL — `BIO_MAX_LINES` is undefined / 201-char bio currently passes / no newline-collapse.

- [ ] **Step 3: Implement the changes**

In `lib/identity/profile.ts`, change the `BIO_MAX` constant and add `BIO_MAX_LINES` (lines 4-5 region):

```ts
export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 200;
export const BIO_MAX_LINES = 8;
```

Replace `sanitizeBio` (lines 27-37) with:

```ts
export function sanitizeBio(raw: string): BioResult {
  const value = (raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(CONTROL_EXCEPT_LF, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // allow a blank-line separator, block tall empty stacks
    .trim();
  if (value.length === 0) return { ok: true, value: null };
  if (HTML_TAG.test(value)) return { ok: false, error: "簡介不可包含 HTML 標記" };
  if (value.length > BIO_MAX) return { ok: false, error: `簡介不可超過 ${BIO_MAX} 字` };
  if (value.split("\n").length > BIO_MAX_LINES) {
    return { ok: false, error: `簡介最多 ${BIO_MAX_LINES} 行` };
  }
  return { ok: true, value };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/identity/profile.test.ts`
Expected: PASS (all cases, old + new).

- [ ] **Step 5: Make the bio render its line breaks**

In `app/globals.css`, find the `.id-bio` rule (in the id-card section) and add `white-space: pre-line;`. If the rule is e.g. `.id-bio { margin: 0; color: var(--muted); ... }`, change it to include:

```css
.id-bio { /* …existing props… */ white-space: pre-line; }
```

(If `.id-bio` has no standalone rule, add `.id-bio { white-space: pre-line; }` near the other id-card styles.)

- [ ] **Step 6: Commit**

```bash
git add lib/identity/profile.ts lib/identity/profile.test.ts app/globals.css
git commit -m "feat: multi-line bio (200 chars / 8 lines) + pre-line render

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `AccountView` gains `accountId`

The recovery chip (Task 10) needs the platform-authoritative `accountId` to scope the Add flow; the view row currently omits it.

**Files:**
- Modify: `app/(site)/gua/[slug]/types.ts:4-17`
- Modify: `app/(site)/gua/[slug]/accounts.ts:10-23`

- [ ] **Step 1: Add the field to the type**

In `types.ts`, add to the `AccountView` type (after `handle`):

```ts
export type AccountView = {
  id: string;
  /** Platform-authoritative account id (lowercased handle for Threads) — scopes re-verify. */
  accountId: string;
  handle: string;
  // …rest unchanged…
```

- [ ] **Step 2: Populate it in `toView`**

In `accounts.ts`, in the object returned by `toView`, add `accountId: a.accountId,` right after `id: a.id,`:

```ts
  return {
    id: a.id,
    accountId: a.accountId,
    handle: a.handle,
    // …rest unchanged…
```

- [ ] **Step 3: Verify the type compiles**

Run: `npx tsc --noEmit`
Expected: clean (`LinkedAccount.accountId` exists; no other consumer requires changes — `ManageChips` adds the usage in Task 10).

- [ ] **Step 4: Commit**

```bash
git add "app/(site)/gua/[slug]/types.ts" "app/(site)/gua/[slug]/accounts.ts"
git commit -m "feat: carry accountId on AccountView (for re-verify scoping)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Repo — `discloseBinding`

**Files:**
- Modify: `lib/binding/repo.ts`
- Test: `lib/binding/repo.db.test.ts`

- [ ] **Step 1: Add the failing DB test**

In `lib/binding/repo.db.test.ts`, add `discloseBinding` to the import block (top of file), then add this test inside the `describe.skipIf(!hasDb)(...)` block:

```ts
  it("discloseBinding flips a private row to public + writes a disclosed event (idempotent)", async () => {
    const u = await freshUser("br-disc@example.com", "BrDisc001");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "discme")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ok = await discloseBinding(u.id, res.linkedAccountId);
    expect(ok).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } }))?.visibility).toBe("public");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed" } })).toBe(1);

    // Idempotent: disclosing an already-public row writes no second event.
    await discloseBinding(u.id, res.linkedAccountId);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed" } })).toBe(1);
  });

  it("discloseBinding rejects an account owned by someone else", async () => {
    const owner = await freshUser("br-disc-own@example.com", "BrDiscOwn");
    const other = await freshUser("br-disc-oth@example.com", "BrDiscOth");
    const res = await commitBinding({ requestId: (await resolvedRequest(owner.id, "ownonly")).id, asMain: false, visibility: "private", mintSlug: false });
    if (!res.ok) return;
    expect(await discloseBinding(other.id, res.linkedAccountId)).toEqual({ ok: false, error: "not_found" });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binding/repo.db.test.ts`
Expected: FAIL — `discloseBinding` is not exported (or test skipped if no `DATABASE_URL`; if skipped, rely on tsc in Step 4 and run against a preview/dev DB before the PR).

- [ ] **Step 3: Implement `discloseBinding`**

In `lib/binding/repo.ts`, add (after `commitBinding`, before the dead `provisionExistingAccount` block that Task 7 removes):

```ts
export type ManageResult = { ok: true } | { ok: false; error: "not_found" | "not_active" };

/** §C.1 disclose — private → public (one-way). Idempotent: a public row writes no event. */
export async function discloseBinding(userId: string, linkedAccountId: string): Promise<ManageResult> {
  const acct = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!acct || acct.userId !== userId) return { ok: false, error: "not_found" };
  if (acct.visibility === "public") return { ok: true };
  await prisma.$transaction(async (tx) => {
    await tx.linkedAccount.update({ where: { id: acct.id }, data: { visibility: "public" } });
    await tx.bindingEvent.create({
      data: { userId, platform: acct.platform, accountId: acct.accountId, eventType: "disclosed" },
    });
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run lib/binding/repo.db.test.ts`
Expected: tsc clean; tests PASS (or skip without a DB).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/repo.ts lib/binding/repo.db.test.ts
git commit -m "feat: discloseBinding (private→public, one-way, writes disclosed event)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Repo — `setMainBinding`

**Files:**
- Modify: `lib/binding/repo.ts`
- Test: `lib/binding/repo.db.test.ts`

- [ ] **Step 1: Add the failing DB test**

Add `setMainBinding` to the import block, then add inside the `describe` block:

```ts
  it("setMainBinding re-points the ★ to a public row, clearing the old main, writing only set_main", async () => {
    const u = await freshUser("br-main1@example.com", "BrMain001");
    const first = await commitBinding({ requestId: (await resolvedRequest(u.id, "firstmain")).id, asMain: true, visibility: "public", mintSlug: true });
    const second = await commitBinding({ requestId: (await resolvedRequest(u.id, "second")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!first.ok || !second.ok) return;

    const ok = await setMainBinding(u.id, second.linkedAccountId);
    expect(ok).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: first.linkedAccountId } }))?.isMain).toBe(false);
    const newMain = await prisma.linkedAccount.findUnique({ where: { id: second.linkedAccountId } });
    expect(newMain?.isMain).toBe(true);
    expect(newMain?.visibility).toBe("public"); // old main stays public (permanence)
    expect((await prisma.linkedAccount.findUnique({ where: { id: first.linkedAccountId } }))?.visibility).toBe("public");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main", accountId: "second" } })).toBe(1);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed" } })).toBe(0); // was already public
  });

  it("setMainBinding on a PRIVATE row forces it public + writes both disclosed and set_main", async () => {
    const u = await freshUser("br-main2@example.com", "BrMain002");
    await commitBinding({ requestId: (await resolvedRequest(u.id, "rootmain")).id, asMain: true, visibility: "public", mintSlug: true });
    const priv = await commitBinding({ requestId: (await resolvedRequest(u.id, "privrow")).id, asMain: false, visibility: "private", mintSlug: false });
    if (!priv.ok) return;

    await setMainBinding(u.id, priv.linkedAccountId);
    const row = await prisma.linkedAccount.findUnique({ where: { id: priv.linkedAccountId } });
    expect(row?.isMain).toBe(true);
    expect(row?.visibility).toBe("public");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "disclosed", accountId: "privrow" } })).toBe(1);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main", accountId: "privrow" } })).toBe(1);
  });

  it("setMainBinding refuses a flagged (non-active) account", async () => {
    const u = await freshUser("br-main3@example.com", "BrMain003");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "flagme")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    await prisma.linkedAccount.update({ where: { id: res.linkedAccountId }, data: { condition: "hacked" } });
    expect(await setMainBinding(u.id, res.linkedAccountId)).toEqual({ ok: false, error: "not_active" });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binding/repo.db.test.ts`
Expected: FAIL — `setMainBinding` not exported.

- [ ] **Step 3: Implement `setMainBinding`**

Add to `lib/binding/repo.ts` (after `discloseBinding`):

```ts
/**
 * §C.2 set-as-main — re-point the ★ (never mints a slug; a main always already has one).
 * Clears the previous main (it stays public — permanence — but loses the ★), forces the new
 * main public (writing a `disclosed` event first if it was private), and writes `set_main`.
 */
export async function setMainBinding(userId: string, linkedAccountId: string): Promise<ManageResult> {
  const acct = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!acct || acct.userId !== userId) return { ok: false, error: "not_found" };
  if (acct.condition !== "active") return { ok: false, error: "not_active" };
  const wasPrivate = acct.visibility === "private";
  await prisma.$transaction(async (tx) => {
    await tx.linkedAccount.updateMany({ where: { userId, isMain: true }, data: { isMain: false } });
    await tx.linkedAccount.update({ where: { id: acct.id }, data: { isMain: true, visibility: "public" } });
    if (wasPrivate) {
      await tx.bindingEvent.create({
        data: { userId, platform: acct.platform, accountId: acct.accountId, eventType: "disclosed" },
      });
    }
    await tx.bindingEvent.create({
      data: { userId, platform: acct.platform, accountId: acct.accountId, eventType: "set_main" },
    });
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run lib/binding/repo.db.test.ts`
Expected: tsc clean; tests PASS (or skip without a DB).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/repo.ts lib/binding/repo.db.test.ts
git commit -m "feat: setMainBinding (re-point ★, force public, write set_main/disclosed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Repo — `reportCondition`

**Files:**
- Modify: `lib/binding/repo.ts`
- Test: `lib/binding/repo.db.test.ts`

- [ ] **Step 1: Add the failing DB test**

Add `reportCondition` to the import block, then add inside the `describe` block:

```ts
  it("reportCondition('hacked') flags the row + writes reported_hacked; ('banned') → reported_banned", async () => {
    const u = await freshUser("br-cond@example.com", "BrCond001");
    const h = await commitBinding({ requestId: (await resolvedRequest(u.id, "hackedone")).id, asMain: false, visibility: "public", mintSlug: false });
    const b = await commitBinding({ requestId: (await resolvedRequest(u.id, "bannedone")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!h.ok || !b.ok) return;

    expect(await reportCondition(u.id, h.linkedAccountId, "hacked")).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: h.linkedAccountId } }))?.condition).toBe("hacked");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "reported_hacked", accountId: "hackedone" } })).toBe(1);

    expect(await reportCondition(u.id, b.linkedAccountId, "banned")).toEqual({ ok: true });
    expect((await prisma.linkedAccount.findUnique({ where: { id: b.linkedAccountId } }))?.condition).toBe("banned");
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "reported_banned", accountId: "bannedone" } })).toBe(1);
  });

  it("reportCondition rejects an account the caller does not own", async () => {
    const owner = await freshUser("br-cond-own@example.com", "BrCondOwn");
    const other = await freshUser("br-cond-oth@example.com", "BrCondOth");
    const res = await commitBinding({ requestId: (await resolvedRequest(owner.id, "mineonly")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    expect(await reportCondition(other.id, res.linkedAccountId, "hacked")).toEqual({ ok: false, error: "not_found" });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binding/repo.db.test.ts`
Expected: FAIL — `reportCondition` not exported.

- [ ] **Step 3: Implement `reportCondition`**

Add to `lib/binding/repo.ts` (after `setMainBinding`). Add the import for the type at the top of the file (it already imports `Platform, Visibility`):

```ts
import type { AccountCondition, Platform, Visibility } from "@prisma/client";
```

Then:

```ts
/** §C.3 condition flags — these only LOWER trust; recovery is re-verify only (§C.4). */
export async function reportCondition(
  userId: string,
  linkedAccountId: string,
  condition: "banned" | "hacked",
): Promise<ManageResult> {
  const acct = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!acct || acct.userId !== userId) return { ok: false, error: "not_found" };
  const eventType = condition === "hacked" ? "reported_hacked" : "reported_banned";
  await prisma.$transaction(async (tx) => {
    await tx.linkedAccount.update({ where: { id: acct.id }, data: { condition: condition as AccountCondition } });
    await tx.bindingEvent.create({
      data: { userId, platform: acct.platform, accountId: acct.accountId, eventType },
    });
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run lib/binding/repo.db.test.ts`
Expected: tsc clean; tests PASS (or skip without a DB).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/repo.ts lib/binding/repo.db.test.ts
git commit -m "feat: reportCondition (banned/hacked flag + ledger event)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Repo — `commitBinding` emits `set_main`; remove dead provision code

**Files:**
- Modify: `lib/binding/repo.ts:80-202`
- Test: `lib/binding/repo.db.test.ts`

- [ ] **Step 1: Update the tests**

In `lib/binding/repo.db.test.ts`:

(a) Remove `provisionExistingAccount` from the import block.

(b) Delete the entire `it("provisionExistingAccount sets main + public + mints slug from the handle (§D.5)", ...)` test (lines ~122-133).

(c) Add this assertion to the existing `it("commitBinding (confirm-as-slug) mints the slug + forces isMain/public", ...)` test, right before its closing `});`:

```ts
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main" } })).toBe(1);
```

(d) Add a new test confirming an ordinary (non-main) bind writes NO `set_main`:

```ts
  it("commitBinding (ordinary, non-main) writes no set_main event", async () => {
    const u = await freshUser("br-nomain@example.com", "BrNoMain0");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "plainrow")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "set_main" } })).toBe(0);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binding/repo.db.test.ts`
Expected: FAIL on the `set_main` count (currently 0, expected 1) — and tsc would flag the removed import once Step 3 deletes the function.

- [ ] **Step 3: Add the `set_main` event to `commitBinding`**

In `lib/binding/repo.ts`, inside `commitBinding`'s transaction, immediately after the `bound` `bindingEvent.create({...})` block (around line 138) and before the `let slug` line, add:

```ts
      if (params.asMain) {
        // The original main designation belongs in the timeline too (§C.2).
        await tx.bindingEvent.create({
          data: {
            userId: req.userId,
            platform: req.platform,
            accountId: req.resolvedAccountId!,
            eventType: "set_main",
          },
        });
      }
```

- [ ] **Step 4: Remove the dead provision code**

Delete from `lib/binding/repo.ts`:
- the `ProvisionResult` type (lines ~162-164),
- the entire `provisionExistingAccount` function (lines ~166-194),
- the entire `listProvisionCandidates` function (lines ~196-202).

(The §F invariant proves both are unreachable — confirmed by grep: their only references are in `repo.ts` itself and the test deleted in Step 1.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run lib/binding/repo.db.test.ts`
Expected: tsc clean (no dangling references); tests PASS (or skip without a DB).

- [ ] **Step 6: Commit**

```bash
git add lib/binding/repo.ts lib/binding/repo.db.test.ts
git commit -m "feat: commitBinding writes set_main; remove dead provision code (§G)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Repo — `reverifyBinding`

The re-verify commit path Slice 2 deferred. Append-only refresh of ONE existing row.

**Files:**
- Modify: `lib/binding/repo.ts`
- Test: `lib/binding/repo.db.test.ts`

- [ ] **Step 1: Add the failing DB test**

Add `reverifyBinding` to the import block, then add inside the `describe` block:

```ts
  it("reverifyBinding refreshes a flagged row: new ProofRecord + re_verified, restores active, keeps one row", async () => {
    const u = await freshUser("br-rev@example.com", "BrRev0001");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "revacct")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    await prisma.linkedAccount.update({ where: { id: res.linkedAccountId }, data: { condition: "hacked" } });

    // A fresh resolved request from the SAME account (accountId === handle for Threads).
    const fresh = await resolvedRequest(u.id, "revacct");
    const out = await reverifyBinding({ requestId: fresh.id, linkedAccountId: res.linkedAccountId });
    expect(out).toEqual({ ok: true });

    const row = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(row?.condition).toBe("active");
    expect(await prisma.linkedAccount.count({ where: { userId: u.id, accountId: "revacct" } })).toBe(1); // never a dup row
    expect(await prisma.proofRecord.count({ where: { linkedAccountId: res.linkedAccountId } })).toBe(2); // original + refresh
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "re_verified" } })).toBe(1);
    expect((await prisma.bindingRequest.findUnique({ where: { id: fresh.id } }))?.status).toBe("verified");
  });

  it("reverifyBinding rejects when the resolved author is a different account", async () => {
    const u = await freshUser("br-rev2@example.com", "BrRev0002");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "realacct")).id, asMain: false, visibility: "public", mintSlug: false });
    if (!res.ok) return;
    const wrong = await resolvedRequest(u.id, "wrongacct"); // different resolvedAccountId
    expect(await reverifyBinding({ requestId: wrong.id, linkedAccountId: res.linkedAccountId })).toEqual({ ok: false, error: "account_mismatch" });
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "re_verified" } })).toBe(0);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/binding/repo.db.test.ts`
Expected: FAIL — `reverifyBinding` not exported.

- [ ] **Step 3: Implement `reverifyBinding`**

Add to `lib/binding/repo.ts` (after `reportCondition`):

```ts
export type ReverifyResult =
  | { ok: true }
  | { ok: false; error: "not_resolvable" | "account_mismatch" | "not_found" };

/**
 * §C.4 trust-restoring re-proof. The resolved author MUST be the SAME account as the bound row
 * (you can't swap a different account onto an existing row). Append-only refresh of ONE row:
 * new ProofRecord + re_verified event + condition→active + verify the request. Never a new row.
 */
export async function reverifyBinding(params: {
  requestId: string;
  linkedAccountId: string;
}): Promise<ReverifyResult> {
  const req = await findRequestById(params.requestId);
  if (!req || req.status !== "resolved" || !req.resolvedAccountId || !req.resolvedHandle || !req.proofPostUrl) {
    return { ok: false, error: "not_resolvable" };
  }
  const acct = await prisma.linkedAccount.findUnique({ where: { id: params.linkedAccountId } });
  if (!acct || acct.userId !== req.userId || acct.platform !== req.platform) {
    return { ok: false, error: "not_found" };
  }
  if (acct.accountId !== req.resolvedAccountId) {
    return { ok: false, error: "account_mismatch" };
  }
  await prisma.$transaction(async (tx) => {
    const proof = await tx.proofRecord.create({
      data: {
        linkedAccountId: acct.id,
        proofPostUrl: req.proofPostUrl!,
        authCode: req.code,
        authorHandle: req.resolvedHandle!,
        authorDisplayName: req.resolvedDisplayName,
      },
    });
    await tx.bindingEvent.create({
      data: {
        userId: req.userId,
        platform: req.platform,
        accountId: req.resolvedAccountId!,
        eventType: "re_verified",
        proofRecordId: proof.id,
      },
    });
    await tx.linkedAccount.update({ where: { id: acct.id }, data: { condition: "active" } }); // updatedAt bumps automatically
    await tx.bindingRequest.update({ where: { id: req.id }, data: { status: "verified", consumedAt: new Date() } });
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run lib/binding/repo.db.test.ts`
Expected: tsc clean; tests PASS (or skip without a DB).

- [ ] **Step 5: Commit**

```bash
git add lib/binding/repo.ts lib/binding/repo.db.test.ts
git commit -m "feat: reverifyBinding (same-account guard, append-only refresh of one row)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Manage server actions (`disclose` / `set-main` / `flag`)

**Files:**
- Modify: `app/(site)/gua/[slug]/actions.ts`
- Test: `app/(site)/gua/[slug]/actions.test.ts` (**new**)

- [ ] **Step 1: Write the failing test**

Create `app/(site)/gua/[slug]/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const discloseBinding = vi.fn();
const setMainBinding = vi.fn();
const reportCondition = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/binding/repo", () => ({
  discloseBinding: (...a: unknown[]) => discloseBinding(...a),
  setMainBinding: (...a: unknown[]) => setMainBinding(...a),
  reportCondition: (...a: unknown[]) => reportCondition(...a),
}));
vi.mock("@/lib/identity/session", () => ({ getCurrentUser: () => Promise.resolve(currentUser) }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

import { discloseAction, setMainAction, reportConditionAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "u1", slug: "alice", shortRef: "ref1" };
});

describe("manage actions", () => {
  it("discloseAction calls discloseBinding + revalidates the owner's pages", async () => {
    await discloseAction(form({ linkedAccountId: "la1" }));
    expect(discloseBinding).toHaveBeenCalledWith("u1", "la1");
    expect(revalidatePath).toHaveBeenCalledWith("/gua/alice");
    expect(revalidatePath).toHaveBeenCalledWith("/r/ref1");
  });

  it("setMainAction calls setMainBinding", async () => {
    await setMainAction(form({ linkedAccountId: "la2" }));
    expect(setMainBinding).toHaveBeenCalledWith("u1", "la2");
  });

  it("reportConditionAction passes a valid condition through", async () => {
    await reportConditionAction(form({ linkedAccountId: "la3", condition: "hacked" }));
    expect(reportCondition).toHaveBeenCalledWith("u1", "la3", "hacked");
  });

  it("reportConditionAction redirects home on an invalid condition (never calls repo)", async () => {
    await reportConditionAction(form({ linkedAccountId: "la3", condition: "bogus" }));
    expect(reportCondition).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("a logged-out caller is sent to /login", async () => {
    currentUser = null;
    await discloseAction(form({ linkedAccountId: "la1" }));
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(discloseBinding).not.toHaveBeenCalled();
  });
});
```

> Note: in test the mocked `redirect` does not throw, so code after a `redirect()` still runs; guard with `return` after each `redirect` so the "logged-out" and "invalid condition" cases don't fall through to the repo call.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(site)/gua/[slug]/actions.test.ts"`
Expected: FAIL — the manage actions are not exported yet.

- [ ] **Step 3: Implement the actions**

Replace `app/(site)/gua/[slug]/actions.ts` with:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/identity/session";
import { discloseBinding, setMainBinding, reportCondition } from "@/lib/binding/repo";

/** 登出 → back to Home, logged out. */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * 切換帳號 → sign out then land on /login, where Google's chooser (forced by
 * prompt=select_account) lets the user pick a different account.
 */
export async function switchAccountAction() {
  await signOut({ redirectTo: "/login" });
}

/** Clear the client Router Cache so the just-mutated row re-renders in its new bucket (§L). */
function revalidateOwner(user: { slug: string | null; shortRef: string }) {
  if (user.slug) revalidatePath(`/gua/${user.slug}`);
  revalidatePath(`/r/${user.shortRef}`);
}

/** §C.1 disclose private → public. */
export async function discloseAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
  await discloseBinding(user.id, linkedAccountId);
  revalidateOwner(user);
}

/** §C.2 set-as-main (re-point ★; forces public). */
export async function setMainAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
  await setMainBinding(user.id, linkedAccountId);
  revalidateOwner(user);
}

/** §C.3 condition flags (回報遭盜用 / 回報已被停權). */
export async function reportConditionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? "");
  const raw = String(formData.get("condition") ?? "");
  if (raw !== "hacked" && raw !== "banned") return redirect("/");
  await reportCondition(user.id, linkedAccountId, raw);
  revalidateOwner(user);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run "app/(site)/gua/[slug]/actions.test.ts"`
Expected: tsc clean; tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(site)/gua/[slug]/actions.ts" "app/(site)/gua/[slug]/actions.test.ts"
git commit -m "feat: manage server actions (disclose/set-main/flag) with revalidatePath

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `ManageChips` inline-confirm component + wire `AccountRow` + CSS

No React-render test infra exists (vitest `node` env, `*.test.ts` only) — this component is verified manually on the Vercel preview (Task 15 checklist). The server actions it calls are already unit-tested (Task 9).

**Files:**
- Create: `app/(site)/gua/[slug]/ManageChips.tsx`
- Modify: `app/(site)/gua/[slug]/AccountRow.tsx:1-28,61`
- Modify: `app/globals.css` (chip + confirm-panel styles)

- [ ] **Step 1: Create `ManageChips.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { AccountView } from "./types";
import { discloseAction, setMainAction, reportConditionAction } from "./actions";

type Panel = "disclose" | "main" | "hacked" | "banned" | null;

function ConfirmPanel({
  tone,
  message,
  confirmLabel,
  action,
  accountId,
  condition,
  onCancel,
}: {
  tone: "warn" | "danger";
  message: string;
  confirmLabel: string;
  action: (fd: FormData) => void;
  accountId: string;
  condition?: "hacked" | "banned";
  onCancel: () => void;
}) {
  return (
    <div className={`confirm-panel ${tone}`}>
      <p className="confirm-msg">{message}</p>
      <div className="confirm-row">
        <form action={action}>
          <input type="hidden" name="linkedAccountId" value={accountId} />
          {condition ? <input type="hidden" name="condition" value={condition} /> : null}
          <button type="submit" className="btn-primary sm">{confirmLabel}</button>
        </form>
        <button type="button" className="btn-secondary sm" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

/** §C management controls — inline-expand confirm (pattern A); no modal. */
export function ManageChips({ account }: { account: AccountView }) {
  const [panel, setPanel] = useState<Panel>(null);

  // Flagged rows: the only control is the scoped re-verify entry (§C.4).
  if (account.flagged) {
    return (
      <div className="acct-actions">
        <a className="chip recover" href={`/add/${account.platform}?recover=${encodeURIComponent(account.accountId)}`}>
          恢復 · 重新驗證 →
        </a>
      </div>
    );
  }

  const isPrivate = account.variant === "private";
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="acct-actions">
      {isPrivate ? (
        <button type="button" className="chip" onClick={() => toggle("disclose")}>🔒 設為公開（永久）</button>
      ) : (
        <span className="chip is-static">🔒 已公開（永久）</span>
      )}

      {account.variant !== "main" && (
        <button type="button" className="chip" onClick={() => toggle("main")}>★ 設為主要</button>
      )}

      <button type="button" className="chip" onClick={() => toggle("hacked")}>回報遭盜用</button>
      <button type="button" className="chip" onClick={() => toggle("banned")}>回報已被停權</button>

      {/* Panels are gated on their chip still being applicable, so a post-revalidate
          re-render (which moves the row to a new bucket) auto-collapses the panel. */}
      {isPrivate && panel === "disclose" && (
        <ConfirmPanel
          tone="warn"
          message="公開後將永久顯示在你的正身頁，無法再次隱藏。"
          confirmLabel="確認公開"
          action={discloseAction}
          accountId={account.id}
          onCancel={() => setPanel(null)}
        />
      )}
      {account.variant !== "main" && panel === "main" && (
        <ConfirmPanel
          tone="warn"
          message={
            isPrivate
              ? "設為主要會將此帳號永久公開，並成為你正身頁的代表帳號（★）。"
              : "將此帳號設為你正身頁的代表帳號（★）。"
          }
          confirmLabel="設為主要"
          action={setMainAction}
          accountId={account.id}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === "hacked" && (
        <ConfirmPanel
          tone="danger"
          message="將公開標記此帳號遭盜用，降低其信任。僅能透過重新驗證恢復。"
          confirmLabel="回報遭盜用"
          action={reportConditionAction}
          accountId={account.id}
          condition="hacked"
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === "banned" && (
        <ConfirmPanel
          tone="danger"
          message="將公開標記此帳號已被停權，降低其信任。僅能透過重新驗證恢復。"
          confirmLabel="回報已被停權"
          action={reportConditionAction}
          accountId={account.id}
          condition="banned"
          onCancel={() => setPanel(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `AccountRow` to it**

In `app/(site)/gua/[slug]/AccountRow.tsx`:
- Delete the local `ManageChips` function (lines 11-28).
- Add the import at the top: `import { ManageChips } from "./ManageChips";`
- The existing `{manage && <ManageChips account={account} />}` call on line 61 now resolves to the imported component — no change needed there.

- [ ] **Step 3: Add the styles**

In `app/globals.css`, after the `.chip:hover` rule (~line 439), add:

```css
.chip.is-static { cursor: default; opacity: 0.7; }
.chip.is-static:hover { border-color: #34343f; }
a.chip.recover { text-decoration: none; }

.confirm-panel {
  width: 100%; margin-top: 0.4rem; padding: 0.65rem 0.8rem;
  border-radius: 0.55rem; border: 1px solid #34343f; background: #15151c;
}
.confirm-panel.warn { border-color: #5a4a12; background: #1a160b; }
.confirm-panel.danger { border-color: #5a1f1f; background: #1a0d0d; }
.confirm-msg { margin: 0 0 0.55rem; font-size: 0.8rem; line-height: 1.55; color: var(--fg); }
.confirm-row { display: flex; gap: 0.5rem; align-items: center; }
.btn-primary.sm, .btn-secondary.sm { padding: 0.32rem 0.8rem; font-size: 0.78rem; }
```

- [ ] **Step 4: Verify the type compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run the full suite (nothing should regress)**

Run: `npx vitest run`
Expected: green (or DB tests skipped).

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/gua/[slug]/ManageChips.tsx" "app/(site)/gua/[slug]/AccountRow.tsx" app/globals.css
git commit -m "feat: ManageChips inline-confirm controls on the 管理 tab

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Re-verify entry — thread `recover` through the Add flow

The flagged-row recovery link lands on `/add/{platform}?recover={accountId}`. The target accountId rides query params through the wizard into the confirm page, where a same-account guard either rejects ("這則貼文不是這個帳號發的") or offers a re-verify that commits via `reverifyBinding`.

**Files:**
- Modify: `app/(site)/add/[platform]/page.tsx`
- Modify: `app/(site)/add/[platform]/actions.ts` (`createRequestAction`, `submitProofUrlAction`)
- Modify: `app/(site)/add/[platform]/AddAccountWizard.tsx`
- Modify: `app/(site)/add/[platform]/confirm/page.tsx`
- Modify: `app/(site)/add/[platform]/confirm/actions.ts` (new `recoverAction`)
- Modify: `app/(site)/add/[platform]/confirm/ConfirmForms.tsx` (new `RecoverConfirm`)
- Test: `app/(site)/add/[platform]/confirm/actions.test.ts` (**new**)

- [ ] **Step 1: Thread `recover` through the add page**

In `app/(site)/add/[platform]/page.tsx`:

(a) Widen the searchParams type and read `recover`:

```ts
  searchParams: Promise<{ rid?: string; recover?: string }>;
```
```ts
  const { rid, recover } = await searchParams;
```

(b) In the "no live request" branch's form, add a hidden field (after the `platform` hidden input):

```tsx
        {recover ? <input type="hidden" name="recover" value={recover} /> : null}
```

(c) Pass `recover` to the wizard:

```tsx
      <AddAccountWizard
        platform={platform}
        label={adapter.label}
        rid={req!.id}
        template={template}
        composeIntentUrl={adapter.composeIntentUrl ? adapter.composeIntentUrl(template) : null}
        igNote={platform === "instagram"}
        recover={recover ?? null}
      />
```

- [ ] **Step 2: Carry `recover` through the two add actions**

In `app/(site)/add/[platform]/actions.ts`:

(a) In `createRequestAction`, read `recover` and keep it on the redirect:

```ts
  const recover = String(formData.get("recover") ?? "");
  const existing = await findActiveRequest(user.id, platform as Platform);
  const req = existing ?? (await createBindingRequest({ userId: user.id, platform: platform as Platform, code: generateCode() }));
  redirect(`/add/${platform}?rid=${req.id}${recover ? `&recover=${encodeURIComponent(recover)}` : ""}`);
```

(b) In `submitProofUrlAction`, read `recover` and carry it to the confirm redirect (replace the final `redirect(...)`):

```ts
  const recover = String(formData.get("recover") ?? "");
  // …existing resolve logic unchanged…
  redirect(`/add/${platform}/confirm?rid=${req.id}${recover ? `&recover=${encodeURIComponent(recover)}` : ""}`);
```

- [ ] **Step 3: Add the hidden `recover` field to the wizard's paste form**

In `app/(site)/add/[platform]/AddAccountWizard.tsx`:

(a) Add `recover` to the `Props` type and destructure it:

```ts
type Props = {
  platform: string;
  label: string;
  rid: string;
  template: string;
  composeIntentUrl: string | null;
  igNote?: boolean;
  recover?: string | null;
};
```
```ts
export function AddAccountWizard({ platform, label, rid, template, composeIntentUrl, igNote, recover }: Props) {
```

(b) Inside the paste `<form action={action} ...>`, alongside the existing hidden inputs, add:

```tsx
        {recover ? <input type="hidden" name="recover" value={recover} /> : null}
```

- [ ] **Step 4: Add `RecoverConfirm` to `ConfirmForms.tsx`**

Append to `app/(site)/add/[platform]/confirm/ConfirmForms.tsx`:

```tsx
/** §C.4 recovery confirm — author already matched the target account; re-verify refreshes the proof. */
export function RecoverConfirm({
  platform,
  platformLabel,
  rid,
  recover,
  handle,
  confirmRecover,
  cancel,
}: {
  platform: string;
  platformLabel: string;
  rid: string;
  recover: string;
  handle: string;
  confirmRecover: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  return (
    <div className="confirm-actions">
      <p>✓ @{handle} · 作者由平台確認</p>
      <p className="hint">重新驗證會以這則貼文更新證明，並恢復這個帳號的信任狀態。</p>
      <form action={confirmRecover} className="confirm-actions">
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <input type="hidden" name="recover" value={recover} />
        <button type="submit" className="btn-primary">確認重新驗證</button>
      </form>
      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">取消</button>
      </form>
      <CancelHint platformLabel={platformLabel} />
    </div>
  );
}
```

- [ ] **Step 5: Add `recoverAction`**

In `app/(site)/add/[platform]/confirm/actions.ts`:

(a) Extend the imports:

```ts
import { revalidatePath } from "next/cache";
import { cancelRequest, commitBinding, findLinkedAccount, findRequestById, reverifyBinding } from "@/lib/binding/repo";
```

(b) Append the action:

```ts
/** §C.4 confirm recovery: re-verify the SAME account (guarded), then return to the 正身 page. */
export async function recoverAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const recover = String(formData.get("recover") ?? "");
  const { user, req } = await ownedResolvedRequest(rid, platform);

  // Defense in depth: the page already guards this, but never trust the round-trip.
  if (req.resolvedAccountId !== recover) {
    redirect(`/add/${platform}/confirm?rid=${rid}&recover=${encodeURIComponent(recover)}`);
  }
  const linked = await findLinkedAccount(user.id, platform, recover);
  if (!linked) {
    redirect(user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`);
  }
  const res = await reverifyBinding({ requestId: req.id, linkedAccountId: linked!.id });
  if (!res.ok) {
    redirect(`/add/${platform}/confirm?rid=${rid}&recover=${encodeURIComponent(recover)}&err=${res.error}`);
  }
  if (user.slug) revalidatePath(`/gua/${user.slug}`);
  redirect(user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`);
}
```

- [ ] **Step 6: Add the recovery branch to the confirm page**

In `app/(site)/add/[platform]/confirm/page.tsx`:

(a) Widen searchParams and read `recover`:

```ts
  searchParams: Promise<{ rid?: string; err?: string; recover?: string }>;
```
```ts
  const { rid, err, recover } = await searchParams;
```

(b) Import `RecoverConfirm` and `recoverAction`:

```ts
import { OrdinaryConfirm, SlugConfirm, RecoverConfirm } from "./ConfirmForms";
import {
  cancelRequestAction,
  confirmAsSlugAction,
  confirmOrdinaryAction,
  recoverAction,
} from "./actions";
```

(c) Replace the `{alreadyBound ? (...) : (...)}` render block. The recovery branch takes precedence over the ordinary `alreadyBound` notify (a flagged row is already bound, so `alreadyBound` is true during recovery too):

```tsx
      {recover ? (
        req!.resolvedAccountId !== recover ? (
          <div className="confirm-card">
            <p className="error">這則貼文不是這個帳號發的。</p>
            <p className="hint">重新驗證必須由原本的帳號（你要恢復的那一個）發佈證明貼文。</p>
            <a className="btn-secondary" href={`/add/${platform}?recover=${encodeURIComponent(recover)}`}>重試</a>
            <form action={cancelRequestAction}>
              <input type="hidden" name="platform" value={platform} />
              <input type="hidden" name="rid" value={req!.id} />
              <button type="submit" className="btn-secondary">取消</button>
            </form>
          </div>
        ) : (
          <div className="confirm-card">
            <RecoverConfirm
              platform={platform}
              platformLabel={adapter.label}
              rid={req!.id}
              recover={recover}
              handle={req!.resolvedHandle!}
              confirmRecover={recoverAction}
              cancel={cancelRequestAction}
            />
          </div>
        )
      ) : alreadyBound ? (
        // …existing already-bound notify card, unchanged…
      ) : (
        // …existing new-bind card, unchanged…
      )}
```

(Keep the two existing branches' contents exactly as they are — only the outer `recover ?` wrapper is new.)

- [ ] **Step 7: Write the failing `recoverAction` test**

Create `app/(site)/add/[platform]/confirm/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findRequestById = vi.fn();
const findLinkedAccount = vi.fn();
const reverifyBinding = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => { throw new Error(`redirect:${url}`); });
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({ getCurrentUser: () => Promise.resolve(currentUser) }));
vi.mock("@/lib/binding/repo", () => ({
  findRequestById: (...a: unknown[]) => findRequestById(...a),
  findLinkedAccount: (...a: unknown[]) => findLinkedAccount(...a),
  reverifyBinding: (...a: unknown[]) => reverifyBinding(...a),
  commitBinding: vi.fn(),
  cancelRequest: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import { recoverAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "u1", slug: "alice", shortRef: "ref1" };
});

describe("recoverAction", () => {
  it("re-verifies the matching account and returns to the 正身 page", async () => {
    findRequestById.mockResolvedValue({ id: "rq1", userId: "u1", platform: "threads", resolvedAccountId: "acc" });
    findLinkedAccount.mockResolvedValue({ id: "la1" });
    reverifyBinding.mockResolvedValue({ ok: true });
    await expect(recoverAction(form({ platform: "threads", rid: "rq1", recover: "acc" }))).rejects.toThrow("redirect:/gua/alice");
    expect(reverifyBinding).toHaveBeenCalledWith({ requestId: "rq1", linkedAccountId: "la1" });
    expect(revalidatePath).toHaveBeenCalledWith("/gua/alice");
  });

  it("bounces back to the recover entry when the resolved author is a different account", async () => {
    findRequestById.mockResolvedValue({ id: "rq1", userId: "u1", platform: "threads", resolvedAccountId: "OTHER" });
    await expect(recoverAction(form({ platform: "threads", rid: "rq1", recover: "acc" }))).rejects.toThrow(
      "redirect:/add/threads/confirm?rid=rq1&recover=acc",
    );
    expect(reverifyBinding).not.toHaveBeenCalled();
  });
});
```

(`ownedResolvedRequest` calls `findRequestById` and checks `req.userId`/`req.platform`; the mocks above satisfy it. The `redirect` mock throws so execution stops at the first redirect — matching real `next/navigation` behavior.)

- [ ] **Step 8: Run the tests**

Run: `npx tsc --noEmit && npx vitest run "app/(site)/add/[platform]/confirm/actions.test.ts"`
Expected: tsc clean; tests PASS.

- [ ] **Step 9: Commit**

```bash
git add "app/(site)/add"
git commit -m "feat: scoped re-verify (recover) entry from flagged rows + same-account guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `onboardedAt` routing + stamp on onboarding completion

**Files:**
- Modify: `app/(auth)/post-login/page.tsx`
- Modify: `app/(auth)/post-login/page.test.ts`
- Modify: `app/(site)/onboarding/actions.ts:49-53`
- Modify: `app/(site)/onboarding/actions.test.ts`
- Modify: `lib/identity/repo.ts:17-22` (`updateUserProfile` signature)

- [ ] **Step 1: Update the post-login test**

In `app/(auth)/post-login/page.test.ts`, widen the `currentUser` type to include `onboardedAt`, then replace the "no slug → onboarding" test and add the pre-provisioned case:

```ts
let currentUser: { id: string; shortRef: string; slug?: string | null; onboardedAt?: Date | null } | null = null;
```
```ts
  it("sends a slug-less but already-onboarded user to their /r card (not the wizard)", async () => {
    currentUser = { id: "u1", shortRef: "abc123", slug: null, onboardedAt: new Date("2026-06-01") };
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/r/abc123");
  });

  it("sends a genuine first-timer (no slug, no onboardedAt) to onboarding", async () => {
    currentUser = { id: "u1", shortRef: "abc123", slug: null, onboardedAt: null };
    await PostLoginPage();
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });
```

(Delete the old "sends a not-yet-provisioned user (no slug) to onboarding" test — it's superseded by the two above.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run "app/(auth)/post-login/page.test.ts"`
Expected: FAIL — the slug-less-but-onboarded case currently routes to `/onboarding`.

- [ ] **Step 3: Implement the routing branch**

Replace the body of `PostLoginPage` in `app/(auth)/post-login/page.tsx` (keep/extend the doc comment):

```ts
export default async function PostLoginPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  else if (user.slug) redirect(`/gua/${user.slug}`);
  else if (user.onboardedAt) redirect(`/r/${user.shortRef}`); // pre-provisioned card, not the wizard
  else redirect("/onboarding"); // genuine first-timer
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run "app/(auth)/post-login/page.test.ts"`
Expected: PASS.

- [ ] **Step 5: Widen `updateUserProfile` to accept `onboardedAt`**

In `lib/identity/repo.ts`, change `updateUserProfile`:

```ts
export function updateUserProfile(
  id: string,
  data: { displayName: string; bio: string | null; avatarUrl?: string; onboardedAt?: Date },
) {
  return prisma.user.update({ where: { id }, data });
}
```

- [ ] **Step 6: Update the onboarding action test for the stamp**

In `app/(site)/onboarding/actions.test.ts`, the `updateUserProfile` assertions must now tolerate the stamped `onboardedAt`. Change the two `toHaveBeenCalledWith(...)` checks to `objectContaining` + `expect.any(Date)`:

```ts
    expect(updateUserProfile).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({ displayName: "阿明", bio: "嗨，我是阿明", onboardedAt: expect.any(Date) }),
    );
```
```ts
    expect(updateUserProfile).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({ displayName: "阿明", bio: null, onboardedAt: expect.any(Date) }),
    );
```

(The "redirects a provisioned user (with slug)" test's `currentUser` has no `onboardedAt`, so it also gets stamped — that test only asserts the redirect, so it needs no change.)

- [ ] **Step 7: Stamp `onboardedAt` in `saveProfileAction`**

In `app/(site)/onboarding/actions.ts`, replace the `updateUserProfile` call (lines 49-53):

```ts
  await updateUserProfile(user.id, {
    displayName: nameRes.ok ? nameRes.value : "",
    bio: bioRes.ok ? bioRes.value : null,
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(user.onboardedAt ? {} : { onboardedAt: new Date() }), // stamp once, on first completion (§F)
  });
```

- [ ] **Step 8: Run the affected suites**

Run: `npx tsc --noEmit && npx vitest run "app/(site)/onboarding/actions.test.ts" "app/(auth)/post-login/page.test.ts"`
Expected: tsc clean; both PASS.

- [ ] **Step 9: Commit**

```bash
git add "app/(auth)/post-login" "app/(site)/onboarding/actions.ts" "app/(site)/onboarding/actions.test.ts" lib/identity/repo.ts
git commit -m "feat: onboardedAt routing (slug-less returning user → /r card) + stamp once

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Shared `ProfileForm` (counters + disabled-save) + settings edit page

**Files:**
- Create: `app/(site)/ProfileForm.tsx`
- Modify: `app/(site)/onboarding/page.tsx`
- Delete: `app/(site)/onboarding/OnboardingForm.tsx`
- Create: `app/(site)/settings/page.tsx`
- Modify: `app/(site)/gua/[slug]/IdentityCard.tsx:130`
- Modify: `app/globals.css` (`.counter` style)

- [ ] **Step 1: Create the shared `ProfileForm`**

`app/(site)/ProfileForm.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { saveProfileAction, type OnboardingState } from "@/app/(site)/onboarding/actions";
import { DISPLAY_NAME_MAX, BIO_MAX, BIO_MAX_LINES } from "@/lib/identity/profile";

type Initial = { displayName: string; bio: string; avatarUrl: string | null };

export function ProfileForm({ variant, initial }: { variant: "onboarding" | "edit"; initial: Initial }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveProfileAction, {});
  const [name, setName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);

  const bioLines = bio === "" ? 0 : bio.split("\n").length;
  // Measure the SAME way the server validates (JS String.length) so the hint never disagrees.
  const invalid =
    name.trim().length === 0 ||
    name.length > DISPLAY_NAME_MAX ||
    bio.length > BIO_MAX ||
    bioLines > BIO_MAX_LINES;

  return (
    <form action={action} className="form">
      <div className="field">
        <label className="label" htmlFor={variant === "onboarding" ? "avatar" : undefined}>頭像</label>
        {initial.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.avatarUrl} alt="目前頭像" className="avatar-preview" />
        ) : null}
        {variant === "onboarding" ? (
          <>
            <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
            <p className="hint">JPEG / PNG / WebP，小於 2MB。上傳後會自動裁切與重新編碼。</p>
            {state.errors?.avatar ? <p className="error">{state.errors.avatar}</p> : null}
          </>
        ) : (
          <a className="btn-secondary" href="/settings/avatar">更換頭像 ↗</a>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="displayName">顯示名稱</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          maxLength={DISPLAY_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input"
        />
        <p className="hint counter">{name.length}/{DISPLAY_NAME_MAX}</p>
        {state.errors?.displayName ? <p className="error">{state.errors.displayName}</p> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="bio">一句話簡介</label>
        <textarea
          id="bio"
          name="bio"
          maxLength={BIO_MAX}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="textarea"
        />
        <p className="hint counter">{bio.length}/{BIO_MAX} · {bioLines}/{BIO_MAX_LINES} 行</p>
        {state.errors?.bio ? <p className="error">{state.errors.bio}</p> : null}
      </div>

      {variant === "onboarding" ? (
        <p className="hint permanence">
          接下來你會驗證<strong>主要帳號</strong>，它的帳號名稱會成為你的
          <strong>永久公開網址</strong> guasi.tw/gua/… —— <strong>之後無法更改</strong>。
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending || invalid}>
        {pending ? "儲存中…" : variant === "onboarding" ? "下一步：設定主要帳號 →" : "儲存"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Point onboarding at the shared form**

Replace `app/(site)/onboarding/page.tsx`'s import and usage:

```ts
import { ProfileForm } from "@/app/(site)/ProfileForm";
```
```tsx
      <ProfileForm
        variant="onboarding"
        initial={{
          displayName: user.displayName ?? "",
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl,
        }}
      />
```

Then delete the old form file:

```bash
git rm "app/(site)/onboarding/OnboardingForm.tsx"
```

- [ ] **Step 3: Create the settings edit page**

`app/(site)/settings/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { ProfileForm } from "@/app/(site)/ProfileForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const backHref = user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`;
  return (
    <main className="wrap">
      <h1 className="wordmark sm">編輯個人資料</h1>
      <ProfileForm
        variant="edit"
        initial={{ displayName: user.displayName ?? "", bio: user.bio ?? "", avatarUrl: user.avatarUrl }}
      />
      <p className="id-foot"><a href={backHref}>← 返回我的正身</a></p>
    </main>
  );
}
```

- [ ] **Step 4: Enable the 編輯個人資料 link**

In `app/(site)/gua/[slug]/IdentityCard.tsx`, replace the disabled button (line 130):

```tsx
              <a className="btn-secondary" href="/settings">編輯個人資料</a>
```

- [ ] **Step 5: Add the counter style**

In `app/globals.css`, near the `.hint` rules, add:

```css
.hint.counter { text-align: right; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests green (the onboarding action still imports `saveProfileAction` from the same path; the deleted `OnboardingForm` had no test).

- [ ] **Step 7: Commit**

```bash
git add "app/(site)/ProfileForm.tsx" "app/(site)/onboarding/page.tsx" "app/(site)/settings/page.tsx" "app/(site)/gua/[slug]/IdentityCard.tsx" app/globals.css
git commit -m "feat: shared ProfileForm (counters + disabled-save) + 編輯個人資料 page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Avatar settings page + `saveAvatarAction` + cache-busting

**Files:**
- Create: `app/(site)/settings/avatar/page.tsx`
- Create: `app/(site)/settings/avatar/AvatarForm.tsx`
- Create: `app/(site)/settings/avatar/actions.ts`
- Modify: `lib/identity/repo.ts` (new `updateUserAvatar`)
- Modify: `app/(site)/onboarding/actions.ts` (cache-bust the onboarding avatar too)
- Test: `app/(site)/settings/avatar/actions.test.ts` (**new**)

- [ ] **Step 1: Add `updateUserAvatar` to the repo**

In `lib/identity/repo.ts`, after `updateUserProfile`:

```ts
export function updateUserAvatar(id: string, avatarUrl: string) {
  return prisma.user.update({ where: { id }, data: { avatarUrl } });
}
```

- [ ] **Step 2: Write the failing avatar-action test**

Create `app/(site)/settings/avatar/actions.test.ts` (mirrors the onboarding action test — sharp is mocked to fail, exercising graceful degradation + the no-file guard):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sharp", () => {
  throw new Error('Could not load the "sharp" module using the linux-x64 runtime (simulated)');
});

const updateUserAvatar = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
let currentUser: { id: string; slug: string | null; shortRef: string } | null = null;

vi.mock("@/lib/identity/session", () => ({ getCurrentUser: () => Promise.resolve(currentUser) }));
vi.mock("@/lib/identity/repo", () => ({ updateUserAvatar: (...a: unknown[]) => updateUserAvatar(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

import { saveAvatarAction } from "./actions";

function form(fields: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "user_123", slug: "alice", shortRef: "ref1" };
});

describe("saveAvatarAction", () => {
  it("rejects a submission with no file (never touches storage)", async () => {
    const result = await saveAvatarAction({}, form({ avatar: new File([], "", { type: "application/octet-stream" }) }));
    expect(result?.error).toBe("請選擇圖片");
    expect(updateUserAvatar).not.toHaveBeenCalled();
  });

  it("degrades gracefully when sharp can't load (no crash, profile untouched)", async () => {
    const result = await saveAvatarAction(
      {},
      form({ avatar: new File([Uint8Array.from([1, 2, 3])], "a.png", { type: "image/png" }) }),
    );
    expect(result?.error).toBe("頭像處理失敗，請再試一次");
    expect(updateUserAvatar).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run "app/(site)/settings/avatar/actions.test.ts"`
Expected: FAIL — `saveAvatarAction` does not exist.

- [ ] **Step 4: Implement `saveAvatarAction`**

`app/(site)/settings/avatar/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/identity/session";
import { processAvatar, storeAvatar, AvatarError } from "@/lib/identity/avatar";
import { updateUserAvatar } from "@/lib/identity/repo";

export type AvatarState = { error?: string };

export async function saveAvatarAction(_prev: AvatarState, formData: FormData): Promise<AvatarState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "請選擇圖片" };

  let avatarUrl: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const processed = await processAvatar(buf, file.type);
    const stored = await storeAvatar(user.id, processed.data, processed.contentType);
    // §L cache-busting: storeAvatar overwrites a stable Blob key, so append a version to
    // force <img> to refetch the changed bytes.
    avatarUrl = `${stored}?v=${Date.now()}`;
  } catch (e) {
    if (e instanceof AvatarError) return { error: e.message };
    console.error("[settings/avatar] avatar processing failed", e);
    return { error: "頭像處理失敗，請再試一次" };
  }

  await updateUserAvatar(user.id, avatarUrl);
  if (user.slug) revalidatePath(`/gua/${user.slug}`);
  revalidatePath(`/r/${user.shortRef}`);
  revalidatePath("/settings");
  redirect("/settings");
}
```

- [ ] **Step 5: Create the avatar form + page**

`app/(site)/settings/avatar/AvatarForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { saveAvatarAction, type AvatarState } from "./actions";

export function AvatarForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, action, pending] = useActionState<AvatarState, FormData>(saveAvatarAction, {});
  return (
    <form action={action} className="form">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="目前頭像" className="avatar-preview" />
      ) : null}
      <input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required className="input" />
      <p className="hint">JPEG / PNG / WebP，小於 2MB。上傳後會自動裁切與重新編碼。</p>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "上傳中…" : "儲存頭像"}</button>
    </form>
  );
}
```

`app/(site)/settings/avatar/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { AvatarForm } from "./AvatarForm";

export default async function AvatarSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="wrap">
      <h1 className="wordmark sm">更換頭像</h1>
      <AvatarForm currentUrl={user.avatarUrl} />
      <p className="id-foot"><a href="/settings">← 返回編輯個人資料</a></p>
    </main>
  );
}
```

- [ ] **Step 6: Cache-bust the onboarding avatar too (consistency)**

In `app/(site)/onboarding/actions.ts`, change the avatar store line (inside the `try`):

```ts
      const processed = await processAvatar(buf, file.type);
      avatarUrl = `${await storeAvatar(user.id, processed.data, processed.contentType)}?v=${Date.now()}`;
```

- [ ] **Step 7: Run the tests**

Run: `npx tsc --noEmit && npx vitest run "app/(site)/settings/avatar/actions.test.ts" "app/(site)/onboarding/actions.test.ts"`
Expected: tsc clean; both PASS (the onboarding test's avatar path still errors via the sharp mock — the `?v=` append is only reached on success, so its assertions are unaffected).

- [ ] **Step 8: Commit**

```bash
git add "app/(site)/settings/avatar" lib/identity/repo.ts "app/(site)/onboarding/actions.ts"
git commit -m "feat: avatar settings page + cache-busting (§D/§L)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Docs, devlog, todo + final verification

**Files:**
- Modify: `docs/routes.md`
- Modify: `docs/devlog.md`
- Modify: `todo.md`

- [ ] **Step 1: Update `docs/routes.md`**

Add rows for the new routes (match the file's existing table columns — URL, file, auth, chrome, purpose):
- `/settings` → `app/(site)/settings/page.tsx` — auth required — chrome yes — 編輯個人資料 (name + bio).
- `/settings/avatar` → `app/(site)/settings/avatar/page.tsx` — auth required — chrome yes — 更換頭像.
- Note the `/add/{platform}?recover={accountId}` query-param mode on the existing add-flow row (scoped re-verify).

- [ ] **Step 2: Add the devlog entry**

In `docs/devlog.md`, add a TL;DR row at the top of the table and a section below `---`. Two-phase, so reflect both releases (use the actual merge dates/times from `git log` of the final commits):

```
## v0.14.0 — Slice 5: Manage tab + profile edit (2026-06-17)
**Review:** not yet
**Design docs:**
- Slice 5 Manage tab: [Spec](superpowers/specs/2026-06-17-slice5-manage-tab-design.md) [Plan](superpowers/plans/2026-06-17-slice5-manage-tab.md)
**What was built:**
- Release 1 (schema): `User.onboardedAt` (backfilled) + `disclosed`/`set_main` events — shipped ahead of features.
- Manage tab: inline-confirm disclose / set-as-main / condition flags; scoped 恢復·重新驗證 with same-account guard.
- Repo: `discloseBinding`, `setMainBinding`, `reportCondition`, `reverifyBinding`; `commitBinding` now writes `set_main`; removed dead `provisionExistingAccount`/`listProvisionCandidates`.
- Profile edit surface (`/settings` + `/settings/avatar`), shared `ProfileForm` with live counters + disabled-save.
- Multi-line bio (200 chars / 8 lines, `pre-line` render); `onboardedAt` post-login routing.
**Key technical learnings:**
- `[insight]` Two-phase schema-first release keeps migrations from racing feature merges on Neon preview branches.
- `[gotcha]` Postgres rejects using a new enum value in the same tx that adds it — adding the values in a feature-inert Release 1 sidesteps it.
- `[insight]` Inline-confirm panels gated on their chip's applicability auto-collapse after `revalidatePath` moves the row to a new bucket — no manual state-sync.
- `[note]` Avatar Blob uses a stable key, so a `?v={Date.now()}` suffix is required to bust the `<img>` cache on re-upload.
```

(Anchor for the TL;DR link: `#v0140--slice-5-manage-tab--profile-edit-2026-06-17`.)

- [ ] **Step 3: Cross off `todo.md`**

Tick the Slice 5 / Manage-tab items in `todo.md`.

- [ ] **Step 4: Full verification (CLAUDE.md ship gate)**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run`
Expected: all green (DB tests run if `DATABASE_URL` is set — otherwise verify them against a preview/dev DB before opening the PR).

- [ ] **Step 5: Commit the docs**

```bash
git add docs/routes.md docs/devlog.md todo.md
git commit -m "docs: Slice 5 routes + devlog v0.14.0 + todo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Open the Release 2 PR**

```bash
gh pr create --base main --title "feat: Slice 5 — Manage tab + profile edit (v0.14.0, Release 2)" --body "<summary + manual-test checklist below>"
```

Then **STOP** — do not merge. The user reviews the Vercel preview and squash-merges themselves.

**Manual checklist for the PR body (verify on the Vercel preview, as owner):**
- Disclose a private row → confirm permanence copy → row becomes public, no hide-again control.
- Set-main between two accounts → old loses ★ but stays public; new is ★ + public. From a private row → it's forced public (disclosed + set_main events).
- Flag a row (遭盜用 / 停權) → public warning shows, chips swap to the single recovery pill.
- Recovery: a wrong-account post is rejected ("這則貼文不是這個帳號發的"); the right account re-verifies, restores active, keeps one row.
- Edit name/bio → live counters, 儲存 disabled when invalid; multi-line bio renders line breaks.
- Change avatar on `/settings/avatar` → new image shows immediately (cache-bust).
- Slug-less user (no accounts) → only the gray 主要帳號 box; returning slug-less-but-onboarded user lands on `/r/{shortRef}`, not the wizard.

---

## Appendix — Spec coverage map

| Spec section | Task(s) |
|---|---|
| §B.1 `onboardedAt` + backfill | 1, 12 |
| §B.2 `disclosed` / `set_main` enums | 1 |
| §C.1 disclose | 4, 9, 10 |
| §C.2 set-as-main (re-point, force public, set_main; provisioning emits set_main) | 5, 7, 9, 10 |
| §C.3 condition flags (two pills) | 6, 9, 10 |
| §C.4 恢復·重新驗證 (same-account guard, append-only refresh, flagged-only) | 8, 11 |
| §C inline-confirm pattern A | 10 |
| §D profile-edit surface (dedicated page, reuse form, avatar one click away, counters + disabled save) | 13, 14 |
| §E bio multi-line + limits | 2, 13 |
| §F slug-less state + `onboardedAt` routing | 12 (UI reuse already shipped) |
| §G remove dead provision code | 7 |
| §H timeline write-only (events) | 4, 5, 6, 8 (Slice 4 renders) |
| §L revalidation + avatar cache-bust | 9, 11, 14 |
| §M two-phase release | 1 (Release 1), 2–15 (Release 2) |
