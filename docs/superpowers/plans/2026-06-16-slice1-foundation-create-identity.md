# Slice 1 — Foundation + Create Identity Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the 正身 (`User`) model with the public-URL fields (`slug`, `shortRef`, `updatedAt`), wire `shortRef` generation into the shipped Auth.js `createUser` path, and ship the 建立正身 onboarding UI plus the pre-provisioned owner page (`/r/{shortRef}`) and the `/gua/{slug}` resolver shell — all without any binding/verification logic (Slice 2).

**Architecture:** A modular-monolith slice. Pure domain logic (short-ref generation, profile sanitization, avatar processing) lives under `lib/identity/*` and is TDD'd with Vitest. DB access is a thin repo (`lib/identity/repo.ts`). UI is Next 16 App Router server components + one client form using React 19 `useActionState`; UI wiring is verified by typecheck/build + manual click-through (matching the repo's existing test boundary — only `lib/**` is unit-tested). Avatars are MIME-validated, re-encoded/resized via `sharp`, and stored in Vercel Blob.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 6 + Neon Postgres (citext) · Auth.js v5 (next-auth 5.0.0-beta.31, database sessions, Prisma adapter) · Vitest (node env) · `sharp` + `@vercel/blob`.

---

## Decisions locked for this slice (from spec + session)

- **Model delta is `slug` + `shortRef` + `updatedAt` only.** `displayName`, `avatarUrl`, `bio`, `email`, `createdAt` already exist on `User` (v0.6.0). The spec's §H.2 "add bio/avatar_url" is already satisfied.
- **Column naming follows the existing schema's camelCase convention** (`displayName`, `avatarUrl`, `createdAt` have no `@map`): the new fields are **`slug`**, **`shortRef`**, **`updatedAt`** (Prisma field == DB column). The spec's `short_ref`/`updated_at` are design notation.
- **Slug case-insensitivity = `citext`** (`@db.Citext @unique`), via Prisma `postgresqlExtensions` preview + `extensions = [citext]`. Stored value preserves the proven handle's case; uniqueness/lookup are case-insensitive natively.
- **Avatar = full pipeline in this slice:** provision Vercel Blob, add `@vercel/blob` + `sharp`, validate MIME (JPEG/PNG/WebP, reject SVG), re-encode/resize to WebP 512×512 server-side (strips EXIF), store in Blob.
- **Post-login routing:** Google login `redirectTo` becomes `/onboarding`. Onboarding saves the profile then redirects to `/r/{shortRef}`. (No `onboardedAt` flag in scope — returning users land on onboarding with their profile pre-filled and click 下一步 to their page. Deliberate MVP simplification; Manage/Slice 5 is the later edit surface.)
- **Out of scope (later slices):** any binding/verification, the Add Account wizard, platform adapters, slug *minting* (no main account settable yet), public Identity Card tab rendering, search.

## File structure

| File | Responsibility | Create/Modify |
|---|---|---|
| `prisma/schema.prisma` | citext extension + `slug`/`shortRef`/`updatedAt` on `User` | Modify |
| `prisma/migrations/<ts>_slice1_identity_fields/migration.sql` | hand-finalized migration (backfill before NOT NULL) | Create |
| `lib/identity/short-ref.ts` | base62 opaque `shortRef` generator | Create |
| `lib/identity/short-ref.test.ts` | unit tests | Create |
| `lib/identity/profile.ts` | display_name / bio sanitization + caps | Create |
| `lib/identity/profile.test.ts` | unit tests | Create |
| `lib/identity/avatar.ts` | `processAvatar` (sharp) + `storeAvatar` (Blob) | Create |
| `lib/identity/avatar.test.ts` | unit tests (sharp fixtures; no Blob) | Create |
| `lib/identity/repo.ts` | `findUserById/ByShortRef/BySlug`, `updateUserProfile` | Create |
| `lib/identity/repo.db.test.ts` | DB tests (gated on `DATABASE_URL`) | Create |
| `lib/identity/session.ts` | `getCurrentUser()` (auth() + repo) | Create |
| `lib/auth/adapter.ts` | generate `shortRef` + retry on collision in `createUser` | Modify |
| `lib/auth/adapter.test.ts` | update for new `buildCreateUserInput` arg + retry helper | Modify |
| `lib/auth/adapter.db.test.ts` | assert `shortRef`/`slug`/`updatedAt` on created row | Modify |
| `lib/auth/index.ts` | expose `session.user.id` (database-session callback) | Modify |
| `types/next-auth.d.ts` | augment `Session.user.id` type | Create |
| `app/onboarding/page.tsx` | 建立正身 server page (auth gate) | Create |
| `app/onboarding/OnboardingForm.tsx` | client form (`useActionState`) | Create |
| `app/onboarding/actions.ts` | `saveProfileAction` server action | Create |
| `app/r/[shortRef]/page.tsx` | pre-provisioned owner shell | Create |
| `app/gua/[slug]/page.tsx` | Identity Card resolver shell | Create |
| `app/not-found.tsx` | generic 404 (no register CTA, §1.3) | Create |
| `app/(auth)/login/page.tsx` | `redirectTo: "/onboarding"` | Modify |
| `app/page.tsx` | link to `/r/{shortRef}` when logged in | Modify |
| `app/globals.css` | form / banner / button styles | Modify |
| `package.json` | add `sharp`, `@vercel/blob` | Modify |
| `docs/services.md`, `docs/devlog.md` | Blob provisioned + session log | Modify |

---

## Task 1: Provision Blob + add dependencies

**Files:**
- Modify: `package.json`
- Modify: `docs/services.md:21`

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install @vercel/blob sharp
```
Expected: both added under `dependencies` in `package.json`; `package-lock.json` updated.

- [ ] **Step 2: Provision two Blob stores + pull the dev token for local dev**

One-time external setup (Blob is "Decided" in services.md but not yet wired). **Two stores** keep the readable Development token off production data (see rationale below). In the Vercel dashboard → Storage, create:

| Store | Connect to environments | "Add read-write token env var" |
|---|---|---|
| `guasi-avatars` | **Production + Preview** | ✅ checked |
| `guasi-avatars-dev` | **Development** only | ✅ checked |

Both connections inject the **same var name** `BLOB_READ_WRITE_TOKEN` with **different values, scoped by environment** — so the app code just reads `BLOB_READ_WRITE_TOKEN` and gets the right store per environment, no store selection in code.

**Why two stores:** Development env vars can't be marked *sensitive* (Vercel must hand the plaintext to `vercel env pull` / `vercel dev`), so the dev token is readable-back in the dashboard. Giving that readable token its own throwaway store means it can never write to or overwrite production avatars. Production/Preview share `guasi-avatars`; the `VERCEL_ENV` key-prefix (Task 6) keeps a Preview deploy — which clones prod user ids via Neon branching — from clobbering a prod avatar.

**Verify the scopes don't overlap** in Settings → Environment Variables: `BLOB_READ_WRITE_TOKEN` should appear once for Production+Preview and once for Development, with no duplicate in any single environment. Then:
```bash
npx vercel link    # if not already linked to guasi-app
npx vercel env pull .env.local
grep -c BLOB_READ_WRITE_TOKEN .env.local
```
Expected: `1` (the Development value = the `guasi-avatars-dev` token). On Vercel the right token is auto-injected per environment; only local dev needs the pull. `.env.local` is gitignored.

- [ ] **Step 3: Mark Blob provisioned in the service inventory**

In `docs/services.md` change the **Vercel Blob** row status from `Decided` to `Provisioned` and note its role "avatars (MVP); proof snapshots deferred".

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json docs/services.md
git commit -m "chore: add sharp + @vercel/blob, provision Blob store for avatars"
```

---

## Task 2: Prisma model + migration (slug citext, shortRef, updatedAt)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_slice1_identity_fields/migration.sql`

- [ ] **Step 1: Enable the citext extension in the schema**

Replace the `generator` and `datasource` blocks in `prisma/schema.prisma` with:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DATABASE_URL_UNPOOLED")
  extensions = [citext]
}
```

- [ ] **Step 2: Add the three columns to `User`**

In `model User`, add these fields (place `slug`/`shortRef` after `image`, `updatedAt` after `createdAt`):
```prisma
  // public URL (handle-derived, case-insensitive; minted at main-account designation — Slice 2)
  slug          String?   @unique @db.Citext
  // short opaque redirect token at /r/{shortRef}; NOT NULL from creation (§H.2)
  shortRef      String    @unique
```
and:
```prisma
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
```

- [ ] **Step 3: Generate the migration SQL only (do not apply yet)**

Run:
```bash
npx prisma migrate dev --create-only --name slice1_identity_fields
```
Expected: a new folder `prisma/migrations/<timestamp>_slice1_identity_fields/migration.sql` is written. It will add the columns as `NOT NULL` directly — which would fail on existing rows — so the next step replaces it.

- [ ] **Step 4: Replace the generated `migration.sql` with the backfill-safe version**

Overwrite the generated `migration.sql` with exactly:
```sql
-- citext for case-insensitive slug (handle-derived public URL, §A.2/§H.2)
CREATE EXTENSION IF NOT EXISTS "citext";

-- new columns added NULLABLE so existing 正身 rows can be backfilled before NOT NULL
ALTER TABLE "User" ADD COLUMN "slug" CITEXT;
ALTER TABLE "User" ADD COLUMN "shortRef" TEXT;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- backfill: every 正身 needs a shortRef + updatedAt before the NOT NULL constraint
UPDATE "User" SET "shortRef" = substr(md5(random()::text || "id"), 1, 10) WHERE "shortRef" IS NULL;
UPDATE "User" SET "updatedAt" = COALESCE("createdAt", now()) WHERE "updatedAt" IS NULL;

-- enforce NOT NULL now that every row has a value
ALTER TABLE "User" ALTER COLUMN "shortRef" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- unique indexes (slug is CI via citext; shortRef is the /r/ lookup key)
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");
CREATE UNIQUE INDEX "User_shortRef_key" ON "User"("shortRef");
```

- [ ] **Step 5: Apply the migration + regenerate the client**

Run:
```bash
npx prisma migrate dev
npx prisma generate
```
Expected: migration applies cleanly (`The following migration(s) have been applied`), Prisma Client regenerates with `slug`, `shortRef`, `updatedAt` on `User`.

- [ ] **Step 6: Verify the schema/DB are in sync**

Run:
```bash
npx prisma migrate status
```
Expected: `Database schema is up to date!` (no drift).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add slug (citext), shortRef, updatedAt to 正身 User"
```

---

## Task 3: `shortRef` generator

**Files:**
- Create: `lib/identity/short-ref.ts`
- Create: `lib/identity/short-ref.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/identity/short-ref.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateShortRef, SHORT_REF_ALPHABET } from "./short-ref";

describe("generateShortRef", () => {
  it("returns a 10-char token by default", () => {
    expect(generateShortRef()).toHaveLength(10);
  });

  it("honors a custom length", () => {
    expect(generateShortRef(6)).toHaveLength(6);
  });

  it("uses only the base62 alphabet", () => {
    const ref = generateShortRef(64);
    for (const ch of ref) expect(SHORT_REF_ALPHABET).toContain(ch);
  });

  it("is overwhelmingly unique across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShortRef());
    expect(seen.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/identity/short-ref.test.ts`
Expected: FAIL — cannot resolve `./short-ref`.

- [ ] **Step 3: Write the implementation**

Create `lib/identity/short-ref.ts`:
```ts
import { randomInt } from "node:crypto";

/** base62 — short, URL-safe, no ambiguous separators. */
export const SHORT_REF_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * A short, opaque, non-enumerable token for the /r/{shortRef} path (§H.2).
 * 10 base62 chars ≈ 59 bits — collisions are astronomically unlikely; the
 * unique index + retry in the adapter is the belt-and-suspenders guarantee.
 * `randomInt` is unbiased (rejection-sampled), unlike `% 62` on raw bytes.
 */
export function generateShortRef(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SHORT_REF_ALPHABET[randomInt(SHORT_REF_ALPHABET.length)];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/identity/short-ref.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/identity/short-ref.ts lib/identity/short-ref.test.ts
git commit -m "feat: base62 shortRef generator for /r/ redirect tokens"
```

---

## Task 4: Wire `shortRef` into the Auth.js `createUser` adapter

**Files:**
- Modify: `lib/auth/adapter.ts`
- Modify: `lib/auth/adapter.test.ts`
- Modify: `lib/auth/adapter.db.test.ts`

- [ ] **Step 1: Update the unit test for the new `buildCreateUserInput` signature + retry helper**

Replace `lib/auth/adapter.test.ts` with:
```ts
import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  buildCreateUserInput,
  isShortRefCollision,
  createUserWithRetry,
} from "./adapter";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo.Bar@Example.COM ")).toBe("foo.bar@example.com");
  });
});

describe("buildCreateUserInput", () => {
  it("normalizes the email, seeds profile, and attaches the shortRef", () => {
    const out = buildCreateUserInput(
      { email: " Alice@Example.com ", name: "Alice Wang", image: "https://x/a" },
      "ABC123xyz0",
    );
    expect(out.email).toBe("alice@example.com");
    expect(out.displayName).toBe("Alice Wang");
    expect(out.avatarUrl).toBe("https://x/a");
    expect(out.shortRef).toBe("ABC123xyz0");
  });

  it("leaves a missing email untouched and seeds nulls", () => {
    const out = buildCreateUserInput({ email: null, name: null, image: null }, "ref0000000");
    expect(out.email).toBeNull();
    expect(out.displayName).toBeNull();
    expect(out.avatarUrl).toBeNull();
    expect(out.shortRef).toBe("ref0000000");
  });
});

describe("isShortRefCollision", () => {
  it("is true for a P2002 on the shortRef target", () => {
    expect(isShortRefCollision({ code: "P2002", meta: { target: ["shortRef"] } })).toBe(true);
  });
  it("is false for a P2002 on another column (e.g. email)", () => {
    expect(isShortRefCollision({ code: "P2002", meta: { target: ["email"] } })).toBe(false);
  });
  it("is false for non-P2002 / non-error values", () => {
    expect(isShortRefCollision({ code: "P2025" })).toBe(false);
    expect(isShortRefCollision(null)).toBe(false);
  });
});

describe("createUserWithRetry", () => {
  it("regenerates the shortRef and retries on a shortRef collision", async () => {
    const refs: string[] = [];
    let calls = 0;
    const insert = async (input: { shortRef: string }) => {
      calls++;
      refs.push(input.shortRef);
      if (calls === 1) throw { code: "P2002", meta: { target: ["shortRef"] } };
      return input as never;
    };
    let seq = 0;
    const out = await createUserWithRetry(insert, { email: "a@b.com" } as never, () => `ref${seq++}`);
    expect(calls).toBe(2);
    expect(refs).toEqual(["ref0", "ref1"]); // a fresh ref on the retry
    expect((out as { shortRef: string }).shortRef).toBe("ref1");
  });

  it("rethrows a non-shortRef unique violation immediately (no retry)", async () => {
    let calls = 0;
    const insert = async () => {
      calls++;
      throw { code: "P2002", meta: { target: ["email"] } };
    };
    await expect(
      createUserWithRetry(insert, { email: "a@b.com" } as never, () => "ref"),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/adapter.test.ts`
Expected: FAIL — `isShortRefCollision` / `createUserWithRetry` not exported; `buildCreateUserInput` arity changed.

- [ ] **Step 3: Update the adapter implementation**

Replace `lib/auth/adapter.ts` with:
```ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { generateShortRef } from "@/lib/identity/short-ref";

/** Canonicalize an email so the stored User.email is the stable join key (spec §4). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Fold normalization + one-time profile seeding + the shortRef into the User insert.
 * `displayName`/`avatarUrl` seed from Google as EDITABLE defaults (createUser fires once).
 * `shortRef` is the /r/{shortRef} token — every 正身 gets one at creation (§H.2).
 */
export function buildCreateUserInput<
  T extends { email?: string | null; name?: string | null; image?: string | null },
>(
  data: T,
  shortRef: string,
): T & { email: string | null; displayName: string | null; avatarUrl: string | null; shortRef: string } {
  return {
    ...data,
    email: data.email ? normalizeEmail(data.email) : (data.email ?? null),
    displayName: data.name ?? null,
    avatarUrl: data.image ?? null,
    shortRef,
  };
}

/** True only for a Prisma unique-violation (P2002) on the shortRef index. */
export function isShortRefCollision(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const s = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return s.toLowerCase().includes("shortref");
}

/**
 * Insert a user, regenerating the shortRef and retrying ONLY on a shortRef
 * collision (any other unique violation — e.g. email — rethrows immediately).
 */
export async function createUserWithRetry(
  insert: (input: AdapterUser) => Promise<AdapterUser>,
  data: AdapterUser,
  genRef: () => string,
  maxAttempts = 5,
): Promise<AdapterUser> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await insert(buildCreateUserInput(data, genRef()) as AdapterUser);
    } catch (e) {
      if (isShortRefCollision(e) && attempt < maxAttempts) continue;
      throw e;
    }
  }
  throw new Error("createUser: exhausted shortRef attempts");
}

/** PrismaAdapter with a createUser wrapper (normalize email + seed profile + shortRef). */
export function createAuthAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    createUser: (data) => createUserWithRetry(base.createUser!, data, generateShortRef),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth/adapter.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Update the DB test to assert the new columns**

In `lib/auth/adapter.db.test.ts`, after the existing `expect(row.bio).toBeNull();`, add:
```ts
    expect(row.shortRef).toHaveLength(10); // base62 token minted at creation
    expect(row.slug).toBeNull(); // not minted until main-account designation (Slice 2)
    expect(row.updatedAt).toBeInstanceOf(Date);
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. (The `.db.test.ts` block runs only if `DATABASE_URL` is set — with `.env.local` present, run `npx dotenv -e .env.local -- npm test` if your shell doesn't auto-load it, or rely on the `skipIf` guard otherwise.)

- [ ] **Step 7: Commit**

```bash
git add lib/auth/adapter.ts lib/auth/adapter.test.ts lib/auth/adapter.db.test.ts
git commit -m "feat(auth): mint a shortRef for every 正身 in createUser (retry on collision)"
```

---

## Task 5: Profile sanitization (display_name / bio)

**Files:**
- Create: `lib/identity/profile.ts`
- Create: `lib/identity/profile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/identity/profile.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  sanitizeDisplayName,
  sanitizeBio,
  DISPLAY_NAME_MAX,
  BIO_MAX,
} from "./profile";

describe("sanitizeDisplayName", () => {
  it("trims and accepts a normal name", () => {
    expect(sanitizeDisplayName("  Alice Wang  ")).toEqual({ ok: true, value: "Alice Wang" });
  });
  it("strips control chars (incl. newlines/tabs — names are single-line)", () => {
    expect(sanitizeDisplayName("Al ice\tWang\n")).toEqual({ ok: true, value: "AliceWang" });
  });
  it("rejects an empty / whitespace-only name", () => {
    expect(sanitizeDisplayName("   ")).toEqual({ ok: false, error: "請輸入顯示名稱" });
  });
  it("rejects HTML markup", () => {
    expect(sanitizeDisplayName("<script>x</script>").ok).toBe(false);
  });
  it("rejects an over-length name", () => {
    expect(sanitizeDisplayName("a".repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false);
  });
  it("accepts exactly the max length", () => {
    expect(sanitizeDisplayName("a".repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
  });
});

describe("sanitizeBio", () => {
  it("returns null for an empty bio (optional field)", () => {
    expect(sanitizeBio("")).toEqual({ ok: true, value: null });
  });
  it("keeps newlines but strips other control chars", () => {
    expect(sanitizeBio("line1\nline2 ")).toEqual({ ok: true, value: "line1\nline2" });
  });
  it("normalizes CRLF to LF and trims trailing spaces before newlines", () => {
    expect(sanitizeBio("a  \r\nb")).toEqual({ ok: true, value: "a\nb" });
  });
  it("rejects HTML markup", () => {
    expect(sanitizeBio("<b>hi</b>").ok).toBe(false);
  });
  it("rejects an over-length bio", () => {
    expect(sanitizeBio("a".repeat(BIO_MAX + 1)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/identity/profile.test.ts`
Expected: FAIL — cannot resolve `./profile`.

- [ ] **Step 3: Write the implementation**

Create `lib/identity/profile.ts`:
```ts
// Input-safety for the public 驗明正身 page (§B / §D.1): plain text only, capped.
// XSS defense is layered — these strip/reject on input AND React escapes on render.

export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 160;

// C0/C1 control chars and DEL. For names we strip ALL of them (incl. \t \n).
const ALL_CONTROL = /[ -]/g;
// For bios we keep \n (0A) but strip the rest, incl. \t and \r (handled separately).
const CONTROL_EXCEPT_LF = /[ -	-]/g;
// Conservative HTML-tag detector — rejects <script>, <b>, <img …> while allowing a lone "<".
const HTML_TAG = /<[a-z/!][^>]*>/i;

export type TextResult = { ok: true; value: string } | { ok: false; error: string };
export type BioResult = { ok: true; value: string | null } | { ok: false; error: string };

export function sanitizeDisplayName(raw: string): TextResult {
  const value = (raw ?? "").replace(ALL_CONTROL, "").trim();
  if (value.length === 0) return { ok: false, error: "請輸入顯示名稱" };
  if (HTML_TAG.test(value)) return { ok: false, error: "顯示名稱不可包含 HTML 標記" };
  if (value.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `顯示名稱不可超過 ${DISPLAY_NAME_MAX} 字` };
  }
  return { ok: true, value };
}

export function sanitizeBio(raw: string): BioResult {
  const value = (raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(CONTROL_EXCEPT_LF, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (value.length === 0) return { ok: true, value: null };
  if (HTML_TAG.test(value)) return { ok: false, error: "簡介不可包含 HTML 標記" };
  if (value.length > BIO_MAX) return { ok: false, error: `簡介不可超過 ${BIO_MAX} 字` };
  return { ok: true, value };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/identity/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/identity/profile.ts lib/identity/profile.test.ts
git commit -m "feat: plain-text sanitization + caps for display_name/bio (§B input safety)"
```

---

## Task 6: Avatar processing (sharp) + Blob storage

**Files:**
- Create: `lib/identity/avatar.ts`
- Create: `lib/identity/avatar.test.ts`

- [ ] **Step 1: Write the failing test (processAvatar only — no Blob)**

Create `lib/identity/avatar.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processAvatar, AvatarError, AVATAR_MAX_BYTES } from "./avatar";

async function makePng(size = 40): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();
}

describe("processAvatar", () => {
  it("re-encodes a valid PNG to a <=512px WebP", async () => {
    const out = await processAvatar(await makePng(800), "image/png");
    expect(out.contentType).toBe("image/webp");
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
  });

  it("rejects an SVG by declared MIME (SVG can carry scripts)", async () => {
    await expect(
      processAvatar(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml"),
    ).rejects.toBeInstanceOf(AvatarError);
  });

  it("rejects an oversized payload before decoding", async () => {
    const big = Buffer.alloc(AVATAR_MAX_BYTES + 1);
    await expect(processAvatar(big, "image/png")).rejects.toBeInstanceOf(AvatarError);
  });

  it("rejects bytes that are not a real image even if MIME claims PNG", async () => {
    await expect(
      processAvatar(Buffer.from("definitely not an image"), "image/png"),
    ).rejects.toBeInstanceOf(AvatarError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/identity/avatar.test.ts`
Expected: FAIL — cannot resolve `./avatar`.

- [ ] **Step 3: Write the implementation**

Create `lib/identity/avatar.ts`:
```ts
import sharp from "sharp";
import { put } from "@vercel/blob";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // ~2 MB (§D.1)
const AVATAR_DIM = 512;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]); // sharp's detected format

/** User-facing, safe-to-display avatar validation failure (繁中 message). */
export class AvatarError extends Error {}

/**
 * Validate + re-encode an uploaded avatar (§D.1). Declared MIME is a first gate,
 * but the real defense is sharp re-decoding the bytes: a spoofed content-type
 * (e.g. an SVG renamed .png) is caught by the format check. Re-encoding to WebP
 * strips EXIF/any embedded payload and normalizes dimensions. SVG/GIF are rejected.
 */
export async function processAvatar(
  buffer: Buffer,
  declaredMime: string,
): Promise<{ data: Buffer; contentType: string }> {
  if (!ALLOWED_MIME.has(declaredMime)) {
    throw new AvatarError("不支援的圖片格式，請使用 JPEG / PNG / WebP");
  }
  if (buffer.byteLength > AVATAR_MAX_BYTES) {
    throw new AvatarError("圖片太大，請小於 2MB");
  }

  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    throw new AvatarError("圖片無法處理");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new AvatarError("圖片格式無法辨識");
  }

  const data = await sharp(buffer)
    .rotate() // honor EXIF orientation before it is stripped
    .resize(AVATAR_DIM, AVATAR_DIM, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  return { data, contentType: "image/webp" };
}

/**
 * Store a processed avatar in Vercel Blob at a stable per-user path so a
 * re-upload overwrites the old one. Returns the public URL for `User.avatarUrl`.
 *
 * - `access: "public"` — avatars render on the public 驗明正身 page; a private
 *   blob would need per-view signed URLs for content that's meant to be seen.
 * - `addRandomSuffix: false` + `allowOverwrite: true` — stable key, no orphaned
 *   objects on re-upload. The URL is therefore predictable, which is fine for a
 *   non-sensitive avatar keyed by an opaque cuid.
 * - `VERCEL_ENV` key-prefix — Production + Preview share one store, and Neon
 *   preview branches clone prod user ids; the prefix stops a Preview upload from
 *   overwriting a prod avatar at the same key. (Development uses a separate store.)
 *
 * Requires BLOB_READ_WRITE_TOKEN (auto-injected per env on Vercel; `vercel env
 * pull` locally → the dev store's token).
 */
export async function storeAvatar(
  userId: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const env = process.env.VERCEL_ENV ?? "development"; // production | preview | development
  const { url } = await put(`${env}/avatars/${userId}.webp`, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/identity/avatar.test.ts`
Expected: PASS (4 tests). `storeAvatar` is intentionally not unit-tested (it hits Blob); it is exercised in manual verification (Task 9).

- [ ] **Step 5: Commit**

```bash
git add lib/identity/avatar.ts lib/identity/avatar.test.ts
git commit -m "feat: avatar validate/re-encode (sharp) + Blob storage"
```

---

## Task 7: Identity repo, session helper, and `session.user.id`

**Files:**
- Create: `lib/identity/repo.ts`
- Create: `lib/identity/repo.db.test.ts`
- Create: `lib/identity/session.ts`
- Modify: `lib/auth/index.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Write the repo (DB access)**

Create `lib/identity/repo.ts`:
```ts
import { prisma } from "@/lib/db/client";

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByShortRef(shortRef: string) {
  return prisma.user.findUnique({ where: { shortRef } });
}

/** Case-insensitive by virtue of the `slug` citext column (§H.2). */
export function findUserBySlug(slug: string) {
  return prisma.user.findUnique({ where: { slug } });
}

export function updateUserProfile(
  id: string,
  data: { displayName: string; bio: string | null; avatarUrl?: string },
) {
  return prisma.user.update({ where: { id }, data });
}
```

- [ ] **Step 2: Write the failing DB test**

Create `lib/identity/repo.db.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  findUserByShortRef,
  findUserBySlug,
  updateUserProfile,
} from "./repo";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("identity repo (DB)", () => {
  it("finds by shortRef and looks up slug case-insensitively", async () => {
    const u = await prisma.user.create({
      data: { email: "repo-test@example.com", shortRef: "RepoTest01", slug: "AliceCase" },
    });
    createdIds.push(u.id);

    expect((await findUserByShortRef("RepoTest01"))?.id).toBe(u.id);
    expect((await findUserBySlug("alicecase"))?.id).toBe(u.id); // citext → CI match
    expect(await findUserBySlug("nope-not-here")).toBeNull();
  });

  it("updateUserProfile writes fields and bumps updatedAt", async () => {
    const u = await prisma.user.create({
      data: { email: "repo-update@example.com", shortRef: "RepoUpd001" },
    });
    createdIds.push(u.id);
    const before = u.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateUserProfile(u.id, {
      displayName: "Bob",
      bio: "hi",
      avatarUrl: "https://blob/x.webp",
    });
    expect(updated.displayName).toBe("Bob");
    expect(updated.bio).toBe("hi");
    expect(updated.avatarUrl).toBe("https://blob/x.webp");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
```

- [ ] **Step 3: Run the DB test**

Run: `npx vitest run lib/identity/repo.db.test.ts` (with `DATABASE_URL` available, e.g. `npx dotenv -e .env.local -- npx vitest run lib/identity/repo.db.test.ts`)
Expected: PASS (or SKIPPED if no `DATABASE_URL` — both acceptable in CI; run it at least once locally against the DB to prove citext CI lookup works).

- [ ] **Step 4: Expose `session.user.id` (database-session callback)**

In `lib/auth/index.ts`, replace the `callbacks` line with:
```ts
  callbacks: {
    signIn: signInCallback,
    session({ session, user }) {
      // database strategy: `user` is the adapter row — surface its id to the app.
      session.user.id = user.id;
      return session;
    },
  },
```

- [ ] **Step 5: Augment the Session type**

Create `types/next-auth.d.ts`:
```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
```

- [ ] **Step 6: Write the session helper**

Create `lib/identity/session.ts`:
```ts
import { auth } from "@/lib/auth";
import { findUserById } from "./repo";

/** The full 正身 row for the logged-in viewer, or null if not signed in. */
export async function getCurrentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return findUserById(id);
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `session.user.id` augmentation resolves; repo/session typecheck).

- [ ] **Step 8: Commit**

```bash
git add lib/identity/repo.ts lib/identity/repo.db.test.ts lib/identity/session.ts lib/auth/index.ts types/next-auth.d.ts
git commit -m "feat: identity repo + getCurrentUser + session.user.id"
```

---

## Task 8: 建立正身 onboarding page + form + server action

**Files:**
- Create: `app/onboarding/actions.ts`
- Create: `app/onboarding/OnboardingForm.tsx`
- Create: `app/onboarding/page.tsx`

- [ ] **Step 1: Write the server action**

Create `app/onboarding/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { sanitizeDisplayName, sanitizeBio } from "@/lib/identity/profile";
import { processAvatar, storeAvatar, AvatarError } from "@/lib/identity/avatar";
import { updateUserProfile } from "@/lib/identity/repo";

export type OnboardingState = {
  errors?: { displayName?: string; bio?: string; avatar?: string };
};

export async function saveProfileAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const nameRes = sanitizeDisplayName(String(formData.get("displayName") ?? ""));
  const bioRes = sanitizeBio(String(formData.get("bio") ?? ""));
  const errors: NonNullable<OnboardingState["errors"]> = {};
  if (!nameRes.ok) errors.displayName = nameRes.error;
  if (!bioRes.ok) errors.bio = bioRes.error;

  let avatarUrl: string | undefined;
  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const processed = await processAvatar(buf, file.type);
      avatarUrl = await storeAvatar(user.id, processed.data, processed.contentType);
    } catch (e) {
      errors.avatar = e instanceof AvatarError ? e.message : "頭像處理失敗，請再試一次";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  // Both results are ok here (errors empty); narrow for TS.
  await updateUserProfile(user.id, {
    displayName: nameRes.ok ? nameRes.value : "",
    bio: bioRes.ok ? bioRes.value : null,
    ...(avatarUrl ? { avatarUrl } : {}),
  });

  redirect(`/r/${user.shortRef}`);
}
```

- [ ] **Step 2: Write the client form**

Create `app/onboarding/OnboardingForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { saveProfileAction, type OnboardingState } from "./actions";
import { DISPLAY_NAME_MAX, BIO_MAX } from "@/lib/identity/profile";

type Initial = { displayName: string; bio: string; avatarUrl: string | null };

export function OnboardingForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    saveProfileAction,
    {},
  );

  return (
    <form action={action} className="form">
      <div className="field">
        <label className="label" htmlFor="avatar">頭像</label>
        {initial.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.avatarUrl} alt="目前頭像" className="avatar-preview" />
        ) : null}
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="input"
        />
        <p className="hint">JPEG / PNG / WebP，小於 2MB。上傳後會自動裁切與重新編碼。</p>
        {state.errors?.avatar ? <p className="error">{state.errors.avatar}</p> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="displayName">顯示名稱</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          maxLength={DISPLAY_NAME_MAX}
          defaultValue={initial.displayName}
          required
          className="input"
        />
        {state.errors?.displayName ? <p className="error">{state.errors.displayName}</p> : null}
      </div>

      <div className="field">
        <label className="label" htmlFor="bio">一句話簡介</label>
        <textarea
          id="bio"
          name="bio"
          maxLength={BIO_MAX}
          defaultValue={initial.bio}
          rows={3}
          className="textarea"
        />
        {state.errors?.bio ? <p className="error">{state.errors.bio}</p> : null}
      </div>

      <p className="hint permanence">
        接下來你會驗證<strong>主要帳號</strong>，它的帳號名稱會成為你的
        <strong>永久公開網址</strong> guasi.tw/gua/… —— <strong>之後無法更改</strong>。
      </p>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "儲存中…" : "下一步：設定主要帳號 →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write the server page (auth gate)**

Create `app/onboarding/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="wrap onboarding">
      <h1 className="wordmark sm">建立你的正身</h1>
      <p className="lede">設定你的頭像、顯示名稱與簡介。</p>
      <OnboardingForm
        initial={{
          displayName: user.displayName ?? "",
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl,
        }}
      />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/onboarding
git commit -m "feat: 建立正身 onboarding (avatar/name/bio with input safety)"
```

---

## Task 9: Pre-provisioned owner page `/r/[shortRef]`

**Files:**
- Create: `app/r/[shortRef]/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/r/[shortRef]/page.tsx`:
```tsx
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { findUserByShortRef } from "@/lib/identity/repo";

export default async function PreProvisionedPage({
  params,
}: {
  params: Promise<{ shortRef: string }>;
}) {
  const { shortRef } = await params;

  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const owner = await findUserByShortRef(shortRef);
  // Owner-only pre-provisioning page → generic 404 to anyone else (§1.3 / §D.5).
  if (!owner || owner.id !== viewer.id) notFound();

  // Once a slug is minted (Slice 2), /r/ permanently redirects to the public URL (§H.2).
  if (owner.slug) permanentRedirect(`/gua/${owner.slug}`);

  return (
    <main className="wrap preprov">
      <div className="banner">🔒 你的正身頁尚未公開（只有你看得到）</div>

      <div className="identity-summary">
        {owner.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.avatarUrl} alt="頭像" className="avatar-preview" />
        ) : null}
        <h1 className="wordmark sm">{owner.displayName ?? "（未命名）"}</h1>
        {owner.bio ? <p className="lede">{owner.bio}</p> : null}
      </div>

      <div className="slot empty">
        <span className="slot-label">主要帳號 · 尚未設定</span>
        {/* Stub — Slice 2 wires this to the Add Account / slug-confirm flow. */}
        <button type="button" className="btn-stub" disabled>
          設定主要帳號並開通公開網址 →（即將推出）
        </button>
      </div>

      <p className="hint">
        <a href="/onboarding">編輯個人資料</a>
      </p>
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification (the avatar pipeline + flow end-to-end)**

Run: `npx vercel env pull .env.local` (if not done) then `npm run dev`. In a browser:
1. Visit `/onboarding` while logged out → redirected to `/login`.
2. Log in with Google → land on `/onboarding`.
3. Upload a real JPEG/PNG, set a name + bio, submit → redirected to `/r/{shortRef}`; the avatar renders (served from Blob — URL contains `blob.vercel-storage.com`).
4. Try uploading a `.svg` (rename or pick one) → see the format error, no crash.
5. Copy your `/r/{shortRef}` URL, open it in a logged-out/incognito window → generic 404 (not a redirect to login that reveals the page).

Expected: all five behave as described. Note any deviation before committing.

- [ ] **Step 4: Commit**

```bash
git add "app/r/[shortRef]/page.tsx"
git commit -m "feat: pre-provisioned owner page at /r/{shortRef} (owner-gated, §D.5 shell)"
```

---

## Task 10: `/gua/[slug]` resolver shell + generic 404

**Files:**
- Create: `app/gua/[slug]/page.tsx`
- Create: `app/not-found.tsx`

- [ ] **Step 1: Write the generic 404 (no register CTA — §1.3)**

Create `app/not-found.tsx`:
```tsx
export default function NotFound() {
  return (
    <main className="wrap">
      <h1 className="wordmark">404</h1>
      <p className="lede">找不到這個頁面。</p>
      <p className="status">
        <a href="/">回首頁</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Write the resolver shell**

Create `app/gua/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { findUserBySlug } from "@/lib/identity/repo";

export default async function IdentityCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Case-insensitive lookup via the citext slug column. In Slice 1 no slug is ever
  // minted (binding lands in Slice 2), so this always 404s today — the lookup wiring
  // is here so Slice 3 only has to fill in the Identity Card render.
  const user = await findUserBySlug(slug);
  if (!user) notFound();

  return (
    <main className="wrap">
      <h1 className="wordmark sm">{user.displayName ?? slug}</h1>
      <p className="lede">正身頁建置中（Slice 3）。</p>
      <footer className="foot">guasi.tw/gua/{slug}</footer>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + manual check**

Run: `npx tsc --noEmit` (expect no errors). With `npm run dev`, visit `/gua/anything` → generic 404 (no slugs exist yet). Visit `/definitely-not-a-route` → same generic 404.

- [ ] **Step 4: Commit**

```bash
git add "app/gua/[slug]/page.tsx" app/not-found.tsx
git commit -m "feat: /gua/{slug} resolver shell + generic 404 (§1.3)"
```

---

## Task 11: Wire login redirect, Home link, and styles

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Send post-login users to onboarding**

In `app/(auth)/login/page.tsx`, change the sign-in call:
```tsx
          await signIn("google", { redirectTo: "/onboarding" });
```

- [ ] **Step 2: Link Home to the owner's page when logged in**

Replace `app/page.tsx` with:
```tsx
import { signOut } from "@/lib/auth";
import { getCurrentUser } from "@/lib/identity/session";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="wrap">
      <h1 className="wordmark">我是 · guasi</h1>
      <p className="lede">
        我是正身 —— 主動驗證並串連你擁有的社群帳號，讓某個帳號被封時，存活的帳號能為你證明。
      </p>
      {user ? (
        <div className="status">
          <a href={`/r/${user.shortRef}`}>前往我的正身頁 →</a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit">登出</button>
          </form>
        </div>
      ) : (
        <p className="status">
          <a href="/login">建立你的正身 · 登入</a>
        </p>
      )}
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 3: Add the form / banner / button styles**

Append to `app/globals.css`:
```css
/* --- Slice 1: onboarding + pre-provisioned --- */
.wordmark.sm {
  font-size: clamp(1.75rem, 7vw, 2.75rem);
}

.form {
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.label {
  font-size: 0.9rem;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.input,
.textarea {
  width: 100%;
  padding: 0.7rem 0.85rem;
  background: #15151c;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
  color: var(--fg);
  font: inherit;
}

.textarea {
  resize: vertical;
  min-height: 4.5rem;
}

.input:focus,
.textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--muted);
}

.hint.permanence {
  padding: 0.75rem 0.85rem;
  background: #1a160b;
  border: 1px solid #3a2f10;
  border-radius: 0.6rem;
}

.error {
  margin: 0;
  font-size: 0.8rem;
  color: #ff6b6b;
}

.avatar-preview {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #2a2a33;
}

.btn-primary {
  padding: 0.8rem 1rem;
  background: var(--accent);
  color: #1a1500;
  font-weight: 700;
  border: none;
  border-radius: 0.6rem;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.banner {
  width: 100%;
  max-width: 28rem;
  padding: 0.7rem 0.9rem;
  background: #15151c;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.slot {
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border: 1px dashed #34343f;
  border-radius: 0.6rem;
}

.slot-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.btn-stub {
  padding: 0.7rem 0.9rem;
  background: transparent;
  border: 1px solid #34343f;
  border-radius: 0.6rem;
  color: var(--muted);
  cursor: not-allowed;
}

.identity-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}
```

- [ ] **Step 4: Typecheck + production build (the real gate for the UI tasks)**

Run: `npm run build`
Expected: build succeeds (`prisma migrate deploy` runs against the DB, then `next build` compiles all routes with no type errors). If `prisma migrate deploy` can't reach a DB locally, run `npx next build` alone to verify the compile.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/login/page.tsx" app/page.tsx app/globals.css
git commit -m "feat: route login→onboarding, Home→/r link, Slice 1 styles"
```

---

## Task 12: Full-suite green + devlog

**Files:**
- Modify: `docs/devlog.md`

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all `lib/**` unit tests PASS; `.db.test.ts` blocks PASS (with `DATABASE_URL`) or SKIP.

- [ ] **Step 2: Add the devlog entry**

Add a new newest-first entry to `docs/devlog.md` under heading `## v0.8.0 — Slice 1: Foundation + Create Identity (YYYY-MM-DD HH:MM)` (use the timestamp of the final commit from `git log`), with `**Review:** not yet`, a `**What was built:**` bullet list (User model delta + citext slug; shortRef in createUser; avatar pipeline via sharp+Blob; onboarding; /r and /gua shells), and tagged `**Key technical learnings:**` bullets (e.g. `` `[gotcha]` `` NOT NULL column on a populated table needs a nullable-add → backfill → SET NOT NULL migration; `` `[insight]` `` sharp re-decode is the real avatar gate, declared MIME is only the first filter). Also update the **TL;DR table** at the top with a one-line v0.8.0 row linking to the new section anchor.

- [ ] **Step 3: Commit**

```bash
git add docs/devlog.md
git commit -m "docs: devlog v0.8.0 — Slice 1 foundation + create identity"
```

---

## Self-review (completed against the spec §I scope)

**Spec coverage:**
- `users` model extension (slug citext / shortRef NOT NULL / updatedAt) → Task 2. ✓ (`bio`/`avatar_url` already existed — noted.)
- shortRef generation in the existing Auth.js `createUser` wrapper → Task 4. ✓
- 建立正身 onboarding (avatar + name + bio, input sanitization + caps, permanence copy) → Tasks 5, 6, 8. ✓
- Pre-provisioned owner shell at `/r/{shortRef}` (banner + gray main slot + stub CTA) → Task 9. ✓
- Routing: `/r/{shortRef}` owner-only + `/gua/{slug}` resolver shell + generic 404 → Tasks 9, 10. ✓
- Out-of-scope items (binding, Add Account, slug minting, Identity Card tabs, search) → none implemented; `/gua` and the main-account slot are explicit shells/stubs. ✓

**Out-of-scope guard:** No `binding_requests` / `linked_accounts` / `binding_events` / `proof_records` tables, no platform adapter, no slug *write* path. The only place a slug is read (`/gua`) always 404s in this slice. ✓

**Type consistency:** `OnboardingState`, `processAvatar`/`storeAvatar`, `sanitizeDisplayName`/`sanitizeBio`, `findUserByShortRef`/`findUserBySlug`/`updateUserProfile`, `getCurrentUser`, `generateShortRef`, `createUserWithRetry`/`isShortRefCollision`/`buildCreateUserInput(data, shortRef)` are named identically wherever referenced across tasks. `User` fields used in code (`slug`/`shortRef`/`updatedAt`/`displayName`/`avatarUrl`/`bio`) match the Task 2 schema. ✓

**Placeholder scan:** no TBD/"add validation"/"handle edge cases" — every code step carries complete code. ✓
