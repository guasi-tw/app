# Slice 2 — Add Account (註冊分身) + Binding Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core binding vertical — a person verifies ownership of **one Threads account** via a public post + scoped auth code, commits the binding on confirm, and (for their first/main account) mints the permanent `/gua/{slug}` public URL.

**Architecture:** Four new Prisma models (`BindingRequest`, `LinkedAccount`, `ProofRecord`, `BindingEvent`) implement the **commit-on-confirm** lifecycle (§H): the request row carries all pending state (incl. the 6-digit code + resolved author); durable artifacts are written only at the terminal confirm. A `PlatformAdapter` seam isolates per-platform read mechanics — **only the Threads adapter ships this slice** (tokenless crawler-UA SSR + the compose intent). The Add Account wizard (`/add/{platform}`) → success/visibility step (§D.3) → slug-confirm/provisioning (§D.4) drive the flow; the pre-provisioned page (`/r/{shortRef}`, from Slice 1) gets its main-account CTA + setup picker wired up (§D.5).

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), React 19 (`useActionState`), Prisma 6 on Neon Postgres, Vitest 4. Builds directly on Slice 1 (`User.slug`/`shortRef`/`updatedAt`, `lib/identity/*`, `/r/[shortRef]` + `/gua/[slug]` shells).

**Prerequisites (do this before Task 1):**
- **A writable dev/preview Postgres** — `Task 1`'s `prisma migrate dev` and the `*.db.test.ts` suites need `DATABASE_URL` + `DATABASE_URL_UNPOOLED` set (run `vercel env pull`, or point at a Neon preview branch). Without a DB, Task 1 cannot proceed (migration can't be skipped); the `*.db.test.ts` suites self-skip but then prove nothing.
- **Type/lint gate = `npx tsc --noEmit` only.** This repo has **no ESLint installed** and Next 16 removed `next lint` (it errors out). Do **not** run `next lint` anywhere. `npx next build` runs `prisma migrate deploy` first (needs the DB); for a DB-less local check use `npx prisma generate && npx tsc --noEmit`.

**Scope guardrails (from the spec §I + todo.md):**
- **One platform only — Threads.** Instagram + miin adapters are explicitly later (`/add/instagram`, `/add/miin` resolve to a generic 404 this slice — the registry returns no adapter).
- **No snapshots** (§A.1) — `ProofRecord` stores the live `proofPostUrl`; snapshot columns exist but stay nullable.
- **No self-service unbind** (§A.5) — only `bound` events are written this slice; `re_verified`/condition flags are Slice 5.
- **No uniqueness lock** (§A.6) — uniqueness is per-owner `(userId, platform, accountId)`, never global.
- The public Identity Card render is **Slice 3** — after provisioning, `/gua/{slug}` still shows the Slice 1 stub. That is expected and noted.

**Decisions confirmed for this slice (2026-06-16):**
- **Auth-code TTL = 5 minutes** (resolves spec §F TBD). `BINDING_CODE_TTL_MINUTES = 5` (Task 2).
- **Verify-attempt rate-limiting is deferred** to a later hardening pass (spec §6.2). The gate is author-match (nothing to brute-force) + failed attempts don't consume the code; the only residual concern (using us as a fetch proxy) is mild. Not built this slice.
- **No UI entry point to add a 2nd account for an already-provisioned user** this slice — the §D.3 ordinary-bind path is built, tested, and reachable via `/add/threads` directly; the owner-facing `＋ 註冊分身` CTA officially lands with the **Manage tab (Slice 5)**. Provisioned users meanwhile see the Slice 3 `/gua` stub.
- **keep-as-分身 honors a 私密/公開 choice** (spec-faithful §D.3): the slug-confirm page (§D.4) shows the visibility radio for the keep-as-分身 action (default 私密); confirm-as-slug still forces 公開 (Task 9).
- **Proof URL = the query-free canonical** (decided 2026-06-16). Threads share URLs carry a per-share `?xmt=…&slof=1` tracking token; we **strip it** and store the reconstructed canonical `https://www.threads.com/@{handle}/post/{postId}` (handle from authority) as `proof_records.proof_post_url` — no tracking token persisted (Task 5/8).
- **Threads template omits the hashtag** (decided 2026-06-16, supersedes §D.2.1's `#guasi` [DECIDED]). Threads uses "topics," which a pasted `#tag` does not create; the post leads with `@gua.si.tw` + the profile link. The hashtag is per-platform (`adapter.hashtag`) so IG can keep `#guasi` later (Tasks 3–5).
- **Empirical reference post:** `https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2` — confirmed **live end-to-end** (200, bare `og:title` `@gua.si.tw on Threads`, no `og:description`, code `ABCDEF` body-scanned). Task 5 fixtures mirror it. **Note: editing a Threads post mints a NEW URL/shortcode** — an earlier capture `DZqu0RjGmZr` became invalid (`302 → /?error=invalid_post`) once the post was edited (see `platform-verification.md` §3.1).
- **Re-validating an already-bound account → NOTIFY only in Slice 2** (decided 2026-06-16). The confirm step detects when the resolved account is already bound by this 正身 (`findLinkedAccount`), and shows an on-screen "已綁定" message + a route back to the profile — **no duplicate row, no write** (uniqueness on `(userId, platform, accountId)` holds; the late `duplicate_binding` commit guard stays as a race backstop). The actual **re-verify refresh — append a new immutable `proof_record` + a `re_verified` ledger event, bump `updated_at`, and (if `banned`/`hacked`) restore `condition → active` — is DEFERRED to Slice 5** with the Manage tab's 恢復·重新驗證 action. (Append-only: re-verify never overwrites the old proof, per the §6.6 / immutable-proof locked decision. For an already-`active` account, re-verify is simply "verified again" — fresh proof, no condition change.) "Notify" = **on-screen only** (transactional email is deferred to the email-login milestone).
- **Warn that editing/deleting the proof post breaks the proof link** (decided 2026-06-16). Both the wizard (pre-post credibility hint) and the §D.3 success/confirm copy state that **編輯或刪除** the post makes the "查看貼文 ↗" proof link fail — **editing changes the post's URL**, deleting removes it — while the **binding itself is unaffected** (§A.1 accepts a dead proof link). Tasks 8–9.

---

## File Structure

**New (`lib/binding/`):**
- `lib/binding/constants.ts` — TTL, site origin, crawler UA, code label.
- `lib/binding/code.ts` — 6-digit code generation + namespaced code matcher.
- `lib/binding/template.ts` — the §D.2.1 verification-post template builder.
- `lib/binding/slug.ts` — derive slug from a proven handle + availability check.
- `lib/binding/platforms/types.ts` — `PlatformAdapter` interface + shared types.
- `lib/binding/platforms/threads.ts` — the Threads adapter (parse + fetch author).
- `lib/binding/platforms/index.ts` — adapter registry (`getAdapter`, `listSlugEligible`).
- `lib/binding/repo.ts` — all binding DB access (requests, transactional commit, provisioning).

**New (routes):**
- `app/add/[platform]/page.tsx` — the wizard (server component).
- `app/add/[platform]/AddAccountWizard.tsx` — client: copy/compose + paste-URL form.
- `app/add/[platform]/actions.ts` — `createRequestAction`, `submitProofUrlAction`.
- `app/add/[platform]/confirm/page.tsx` — success/visibility (§D.3) + slug-confirm (§D.4) branch.
- `app/add/[platform]/confirm/ConfirmForms.tsx` — client: visibility radios, permanence gate.
- `app/add/[platform]/confirm/actions.ts` — `confirmOrdinaryAction`, `confirmAsSlugAction`, `keepAsAccountAction`, `cancelRequestAction`.
- `app/r/[shortRef]/actions.ts` — `provisionExistingAction` (§D.5 picker).

**Modified:**
- `prisma/schema.prisma` — 5 enums + 4 models + 3 `User` back-relations.
- `app/r/[shortRef]/page.tsx` — replace the Slice 1 stub CTA with the real setup picker + slug-confirm panel.
- `app/globals.css` — a few classes for the new surfaces (additive).

**Tests (Vitest, colocated `*.test.ts` / `*.db.test.ts` per the Slice 1 convention):**
- `lib/binding/code.test.ts`, `template.test.ts`, `slug.test.ts` (+ `slug.db.test.ts`).
- `lib/binding/platforms/threads.test.ts`, `index.test.ts`.
- `lib/binding/repo.db.test.ts` (self-skipping on no `DATABASE_URL`, per `repo.db.test.ts`).

Pages/actions follow the Slice 1 precedent of **no RSC page unit tests** (the vitest harness is `environment: "node"` with no React renderer); they are covered by `npx tsc --noEmit`, `next build`, and the manual smoke in Task 12. **Note:** this repo has **no ESLint installed** and Next 16 removed `next lint` — `npx tsc --noEmit` is the type/lint gate; never run `next lint`.

---

## Task 1: Prisma binding model — enums, 4 models, migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>/migration.sql` (via `prisma migrate dev`)

- [ ] **Step 1: Add enums + models to the schema**

Append to `prisma/schema.prisma` (after the existing `VerificationToken` model):

```prisma
// --- 正身 binding model — Slice 2 (§H of mvp-wireframes-design) ---
// commit-on-confirm: BindingRequest holds pending state; LinkedAccount + ProofRecord
// + BindingEvent(bound) + (for a provisioning bind) User.slug are written only at the
// terminal confirm. No snapshots (§A.1), no global uniqueness lock (§A.6), no unbind (§A.5).

enum Platform {
  threads
  instagram
  miin
}

enum BindingRequestStatus {
  pending   // code issued, awaiting post + URL paste-back
  resolved  // code matched + author resolved; awaiting user confirm
  verified  // committed → LinkedAccount + ProofRecord + bound event
  cancelled // user hit a real cancel — nothing to reverse
  expired   // TTL passed with no confirm/cancel
}

enum LinkedAccountStatus {
  verified
  unbound // reserved for a future/admin path (§A.5); no MVP UI writes it
}

enum AccountCondition {
  active
  banned
  hacked
}

enum Visibility {
  public
  private
}

enum BindingEventType {
  bound
  unbound
  reported_banned
  reported_hacked
  re_verified
}

model BindingRequest {
  id                  String               @id @default(cuid())
  userId              String
  platform            Platform
  code                String               // 6-digit, scoped to THIS request (§6.2)
  status              BindingRequestStatus @default(pending)

  // resolved-author fields — set when status flips to `resolved` (§H.2)
  resolvedAccountId   String?
  resolvedHandle      String?
  resolvedDisplayName String?
  proofPostUrl        String?

  expiresAt           DateTime
  consumedAt          DateTime?            // single-use — set on commit
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, platform, status])
}

model LinkedAccount {
  id          String              @id @default(cuid())
  userId      String
  platform    Platform
  accountId   String              // platform's authoritative id (lowercased handle for Threads)
  handle      String
  displayName String?
  status      LinkedAccountStatus @default(verified)
  condition   AccountCondition    @default(active)
  visibility  Visibility          @default(private)
  isMain      Boolean             @default(false)
  createdAt   DateTime            @default(now())
  verifiedAt  DateTime            @default(now())
  updatedAt   DateTime            @updatedAt // for the FUTURE search feature (§C/§H.2), not the timeline

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  proofRecords ProofRecord[]

  @@unique([userId, platform, accountId]) // per-正身 uniqueness (§A.6) — NOT global
  @@index([platform, accountId])          // search-by-account (§C)
}

model ProofRecord {
  id                String   @id @default(cuid())
  linkedAccountId   String
  proofPostUrl      String   // the "查看貼文 ↗" target (§E.2) — live URL, no snapshot (§A.1)
  authCode          String
  authorHandle      String
  authorDisplayName String?
  // snapshot columns — nullable/unused in MVP (§A.1); Phase 2 fills them (additive)
  snapshotContent   String?  @db.Text
  snapshotImage     String?
  archiveUrl        String?
  capturedAt        DateTime @default(now())
  verifiedAt        DateTime @default(now())

  linkedAccount LinkedAccount @relation(fields: [linkedAccountId], references: [id], onDelete: Cascade)
}

model BindingEvent {
  id            String           @id @default(cuid())
  userId        String
  platform      Platform
  accountId     String
  eventType     BindingEventType
  reason        String?
  proofRecordId String?          // set for `bound` / `re_verified`
  createdAt     DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt]) // timeline read path (Slice 4), newest-first
}
```

- [ ] **Step 2: Add the three back-relations to `User`**

In `prisma/schema.prisma`, inside `model User`, add after the existing `sessions Session[]` line:

```prisma
  bindingRequests BindingRequest[]
  linkedAccounts  LinkedAccount[]
  bindingEvents   BindingEvent[]
```

- [ ] **Step 3: Generate the migration**

Run: `npx prisma migrate dev --name slice2_binding_model`
Expected: a new folder `prisma/migrations/<timestamp>_slice2_binding_model/` with `migration.sql` creating the 5 enum types + 4 tables + indexes; `prisma generate` re-runs; output ends `Your database is now in sync with your schema.`

- [ ] **Step 4: Sanity-check the generated client compiles**

Run: `npx tsc --noEmit`
Expected: exits 0 (the new Prisma types resolve).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): Slice 2 binding model — BindingRequest/LinkedAccount/ProofRecord/BindingEvent"
```

---

## Task 2: Constants, auth-code generation + matcher

**Files:**
- Create: `lib/binding/constants.ts`
- Create: `lib/binding/code.ts`
- Test: `lib/binding/code.test.ts`

- [ ] **Step 1: Write `constants.ts`**

```typescript
// lib/binding/constants.ts
// Shared binding constants. Kept tiny + dependency-free so both server actions
// and the platform adapters can import them.

/**
 * Auth-code TTL (§H.1 `expired`). 5 min — the whole compose→post→paste-back flow is seconds,
 * so a short live-code window is plenty (decided 2026-06-16). Failed attempts don't consume the
 * code, and the user can regenerate a fresh request anytime, so a tight window costs little.
 */
export const BINDING_CODE_TTL_MINUTES = 5;

/** Public origin used to build the profile URL embedded in the verification post (§D.2.1). */
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://guasi.tw";

/** Meta's crawler UA — triggers Threads/IG server-side OG rendering (platform-verification §3.1). */
export const FB_CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

/**
 * The Chinese label that namespaces the 6-digit code in the post (§D.2.1). The verifier
 * matches `CODE_LABEL` + digits, so an arbitrary 6-digit number elsewhere never false-matches.
 */
export const CODE_LABEL = "我是分身驗證碼：";
```

- [ ] **Step 2: Write the failing test for `code.ts`**

```typescript
// lib/binding/code.test.ts
import { describe, it, expect } from "vitest";
import { generateCode, textHasCode } from "./code";
import { CODE_LABEL } from "./constants";

describe("generateCode", () => {
  it("returns exactly 6 digits", () => {
    expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("can produce leading zeros (full 000000–999999 range)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateCode());
    // Every value is a 6-char digit string even when numerically small.
    for (const c of seen) expect(c).toHaveLength(6);
  });
});

describe("textHasCode", () => {
  it("matches only when the namespaced label precedes the exact code", () => {
    const text = `我是分身認證貼文\n\n${CODE_LABEL}123456`;
    expect(textHasCode(text, "123456")).toBe(true);
  });

  it("rejects the bare code without the label", () => {
    expect(textHasCode("my lucky number is 123456", "123456")).toBe(false);
  });

  it("rejects a different code even if present unlabeled", () => {
    expect(textHasCode(`${CODE_LABEL}999999 and 123456`, "123456")).toBe(false);
  });

  it("tolerates surrounding whitespace after the label", () => {
    expect(textHasCode(`${CODE_LABEL} 123456`, "123456")).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/binding/code.test.ts`
Expected: FAIL — `Failed to resolve import "./code"`.

- [ ] **Step 4: Implement `code.ts`**

```typescript
// lib/binding/code.ts
import { randomInt } from "node:crypto";
import { CODE_LABEL } from "./constants";

/**
 * A scoped, single-use 6-digit code (§6.2). Security comes from author-match + scope +
 * expiry, NOT entropy — so 6 digits (incl. leading zeros) is plenty. `randomInt` is
 * unbiased (rejection-sampled). `padStart` keeps small numbers 6 chars wide.
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** True iff `text` contains the namespaced label immediately followed by exactly `code` (§D.2.1). */
export function textHasCode(text: string, code: string): boolean {
  // Label, optional whitespace, then the exact code as a standalone digit run.
  const escapedLabel = CODE_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escapedLabel}\\s*${code}(?!\\d)`);
  return re.test(text);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/binding/code.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 6: Commit**

```bash
git add lib/binding/constants.ts lib/binding/code.ts lib/binding/code.test.ts
git commit -m "feat(binding): auth-code generation + namespaced code matcher"
```

---

## Task 3: Verification-post template builder (§D.2.1)

**Files:**
- Create: `lib/binding/template.ts`
- Test: `lib/binding/template.test.ts`

> `service_tag` is **per-platform** (the adapter supplies it, §D.2.1) — `buildVerificationPost` takes it as a parameter and never hardcodes a handle. **For Threads the value is `@gua.si.tw`** (the registered IG/Threads handle, set on `threadsAdapter.serviceTag` in Task 5). The test fixtures below use `"@gua.si.tw"` precisely so they match what the Threads adapter feeds in production.
>
> **The leading hashtag is now per-platform + OPTIONAL** (decided 2026-06-16, supersedes §D.2.1's `#guasi` [DECIDED]). **Threads has no hashtags — it uses "topics," which a pasted `#tag` does not create** (a topic must be added through the composer UI, which a copy-paste template can't drive). So the Threads adapter passes `hashtag: null` and the post leads with the `@gua.si.tw` service tag + the profile link for discovery. IG (a later slice) can pass `"#guasi"` since IG hashtags work. `buildVerificationPost` therefore takes `hashtag: string | null` and omits the line when null.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/binding/template.test.ts
import { describe, it, expect } from "vitest";
import { buildVerificationPost, profileUrlFor } from "./template";
import { SITE_ORIGIN, CODE_LABEL } from "./constants";

describe("profileUrlFor", () => {
  it("uses the /r/{shortRef} short link when no slug is minted yet (§D.2.1)", () => {
    expect(profileUrlFor({ slug: null, shortRef: "Ab12Cd34Ef" })).toBe(
      `${SITE_ORIGIN}/r/Ab12Cd34Ef`,
    );
  });

  it("uses the clean /gua/{slug} URL once provisioned", () => {
    expect(profileUrlFor({ slug: "alice", shortRef: "Ab12Cd34Ef" })).toBe(
      `${SITE_ORIGIN}/gua/alice`,
    );
  });
});

describe("buildVerificationPost", () => {
  // Threads: no hashtag (topics aren't created by a pasted #tag) — lead with the service tag.
  const threadsPost = buildVerificationPost({
    hashtag: null,
    serviceTag: "@gua.si.tw",
    profileUrl: `${SITE_ORIGIN}/r/Ab12Cd34Ef`,
    code: "012345",
  });

  it("omits the hashtag when null and leads with the service tag (Threads)", () => {
    expect(threadsPost.startsWith("@gua.si.tw")).toBe(true);
    expect(threadsPost).not.toContain("#");
  });

  it("includes the service tag, profile URL, and namespaced code", () => {
    expect(threadsPost).toContain("@gua.si.tw");
    expect(threadsPost).toContain(`${SITE_ORIGIN}/r/Ab12Cd34Ef`);
    expect(threadsPost).toContain(`${CODE_LABEL}012345`);
  });

  it("leads with the hashtag when one is supplied (e.g. IG in a later slice)", () => {
    const igStyle = buildVerificationPost({
      hashtag: "#guasi",
      serviceTag: "@gua.si",
      profileUrl: `${SITE_ORIGIN}/gua/alice`,
      code: "012345",
    });
    expect(igStyle.startsWith("#guasi")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/binding/template.test.ts`
Expected: FAIL — `Failed to resolve import "./template"`.

- [ ] **Step 3: Implement `template.ts`**

```typescript
// lib/binding/template.ts
import { SITE_ORIGIN, CODE_LABEL } from "./constants";

/** The profile URL embedded in the post: short /r/ link pre-provisioning, /gua/ once minted (§D.2.1). */
export function profileUrlFor(user: { slug: string | null; shortRef: string }): string {
  return user.slug ? `${SITE_ORIGIN}/gua/${user.slug}` : `${SITE_ORIGIN}/r/${user.shortRef}`;
}

/**
 * The copy-able verification post (§D.2.1) — doubles as the growth engine.
 * `hashtag` is per-platform + OPTIONAL: Threads passes `null` (it uses "topics", which a pasted
 * `#tag` does not create — decided 2026-06-16) so the post leads with the `serviceTag` (@gua.si.tw);
 * IG (later) can pass "#guasi". `service_tag` is per-platform (the adapter supplies it). The code is
 * namespaced by `CODE_LABEL` so the verifier never false-matches a stray number, and placed early as
 * belt-and-suspenders (we scan the full SSR body for the code, not the truncatable og:description).
 */
export function buildVerificationPost(params: {
  hashtag: string | null;
  serviceTag: string;
  profileUrl: string;
  code: string;
}): string {
  const { hashtag, serviceTag, profileUrl, code } = params;
  const lines = [
    serviceTag,
    "我是分身認證貼文",
    "",
    "點此觀看此帳號的正身：",
    profileUrl,
    "",
    `${CODE_LABEL}${code}`,
  ];
  return (hashtag ? [hashtag, "", ...lines] : lines).join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/binding/template.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/template.ts lib/binding/template.test.ts
git commit -m "feat(binding): verification-post template (§D.2.1 growth engine)"
```

---

## Task 4: PlatformAdapter interface + registry

**Files:**
- Create: `lib/binding/platforms/types.ts`
- Create: `lib/binding/platforms/index.ts`
- Test: `lib/binding/platforms/index.test.ts`

> The Threads adapter implementation is Task 5. This task defines the seam + registry and proves only Threads is wired (Instagram/miin resolve to no adapter → 404).

- [ ] **Step 1: Write `types.ts`**

```typescript
// lib/binding/platforms/types.ts
// The PlatformAdapter seam (§D.2). Each platform declares its URL pattern, its read
// mechanism, its compose affordance, and whether it can mint a slug. Only Threads ships
// in Slice 2; IG/miin slot in later without touching the rest of the system.

/** Matches the Prisma `Platform` enum values. */
export type PlatformKey = "threads" | "instagram" | "miin";

/** A canonical post URL parsed into the bits we trust: platform + an authoritative fetch URL. */
export type ParsedPostUrl = {
  postId: string;
  /** A canonical URL on the REAL platform domain to read the author from (host already validated). */
  fetchUrl: string;
};

/**
 * The resolved post — author + code-presence + canonical URL, all from PLATFORM AUTHORITY
 * (never user page content, §6.3). One fetch produces all of it (see `resolvePost`).
 */
export type ResolvedPost = {
  /** Authoritative account id (lowercased handle for Threads). Becomes LinkedAccount.accountId. */
  accountId: string;
  handle: string;
  displayName: string | null;
  /** Whether the post's text contains this binding request's namespaced code (scanned by the adapter). */
  codePresent: boolean;
  /** The clean, query-free canonical post URL (stored as `proof_records.proof_post_url`, §E.2). */
  canonicalUrl: string;
};

export interface PlatformAdapter {
  readonly key: PlatformKey;
  /** UI label, e.g. "Threads". */
  readonly label: string;
  /** Per-platform official guasi handle for the post template (§D.2.1) — growth, NOT a security check. */
  readonly serviceTag: string;
  /**
   * Per-platform leading hashtag for the template, or `null` to omit it (§D.2.1, revised 2026-06-16).
   * Threads = `null` (it uses topics, not pasteable hashtags); IG (later) = "#guasi".
   */
  readonly hashtag: string | null;
  /** Whether a slug may be minted from a handle proven here (§A.4 — IG/Threads yes, miin no). */
  readonly slugEligible: boolean;

  /**
   * Validate the pasted URL against THIS platform + parse out the post id (§D.2 security gate).
   * Returns null for wrong-platform domains, look-alike hosts, non-HTTPS, or non-canonical paths.
   */
  parsePostUrl(url: string): ParsedPostUrl | null;

  /**
   * One fetch from platform authority (§6.3): resolve the author, check whether the post text
   * contains `code`, and return the clean canonical URL. Throws on fetch/parse failure.
   * (The author always comes from authority — og:title for Threads; the code is scanned from the
   * SSR'd post body, NOT og:description, which Threads omits when the post contains a link.)
   */
  resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost>;

  /** A prefilled compose-intent URL if the platform has one (Threads does; IG/miin don't). */
  composeIntentUrl?(text: string): string;
}
```

- [ ] **Step 2: Write the failing test for the registry**

```typescript
// lib/binding/platforms/index.test.ts
import { describe, it, expect } from "vitest";
import { getAdapter, listSlugEligible } from "./index";

describe("platform registry (Slice 2 — Threads only)", () => {
  it("returns the Threads adapter", () => {
    expect(getAdapter("threads")?.key).toBe("threads");
  });

  it("returns undefined for not-yet-built platforms (IG/miin land later)", () => {
    expect(getAdapter("instagram")).toBeUndefined();
    expect(getAdapter("miin")).toBeUndefined();
  });

  it("returns undefined for an unknown platform string", () => {
    expect(getAdapter("myspace")).toBeUndefined();
  });

  it("lists Threads as slug-eligible", () => {
    expect(listSlugEligible().map((a) => a.key)).toContain("threads");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/binding/platforms/index.test.ts`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 4: Implement `index.ts`**

```typescript
// lib/binding/platforms/index.ts
import type { PlatformAdapter } from "./types";
import { threadsAdapter } from "./threads";

// Slice 2: Threads only. Adding IG/miin later = add their adapter to this map; nothing else changes.
const ADAPTERS: Partial<Record<string, PlatformAdapter>> = {
  threads: threadsAdapter,
};

/** Look up an adapter by route param. Returns undefined for unknown/not-yet-built platforms (→ 404). */
export function getAdapter(platform: string): PlatformAdapter | undefined {
  return ADAPTERS[platform];
}

/** Adapters whose handles can mint a slug (§A.4) — used by the §D.5 setup picker. */
export function listSlugEligible(): PlatformAdapter[] {
  return Object.values(ADAPTERS).filter(
    (a): a is PlatformAdapter => !!a && a.slugEligible,
  );
}
```

> This import of `./threads` will fail to resolve until Task 5 creates it. Implement Task 5 next; run this test at the end of Task 5.

- [ ] **Step 5: Commit (after Task 5 makes the import resolvable — see Task 5 Step 7)**

(No standalone commit here; the registry is committed together with the Threads adapter in Task 5 so the import resolves.)

---

## Task 5: Threads adapter — URL parse + post resolution

**Files:**
- Create: `lib/binding/platforms/threads.ts`
- Test: `lib/binding/platforms/threads.test.ts`

> Empirical basis: platform-verification §3.1 + §4, **confirmed live end-to-end 2026-06-16** against a real post (`https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2` → 200, parses author `@gua.si.tw` + code `ABCDEF`). Five behaviors are baked in below — the last two are new and would have broken a naive parser:
> 1. **Follow redirects, then re-validate the final host.** A `threads.net` URL 301s to `threads.com`, and any wrong/placeholder path handle 301s to the canonical true-author URL. So `redirect: "follow"` (not `"error"`), then assert the *final* `response.url` host is on the allowlist (§6.3).
> 2. **HTML-decode all OG content.** It's entity-encoded (`&#064;` = `@`, hex for CJK). Decode before parsing the handle AND before scanning for the code.
> 3. **Compose intent** = `https://www.threads.com/intent/post?text=…` (verified 200; logged-out users go to `/login?next=…` with the text preserved — expected).
> 4. **`og:title` has TWO shapes:** `<name> (@<handle>) on Threads` *and*, when the account has no separate display name, the bare `@<handle> on Threads` (the real `@gua.si.tw` post returns the bare form). Parse both; `displayName` is `null` for the bare form.
> 5. **The code text is NOT in `og:description`.** Every verification post contains a link (the profile URL), and a Threads post with a link renders a summary card with **no `og:description`** — but the caption *is* in the SSR'd body. So scan the **decoded full HTML body** for the namespaced code, not `og:description`. (Bonus: the body is untruncated, so the OG-truncation gotcha no longer applies.) The **author still comes from `og:title`** (authority); only the *code presence* is read from the body.
> 6. **Editing a Threads post CHANGES its URL — the old shortcode dies (verified 2026-06-16).** When the user edits a post, Threads mints a **new shortcode**; the previous URL then **302-redirects to `/?error=invalid_post`** (a login/home page with `og:title = "Threads • Log in"`). This — not throttling — is what made an earlier capture (`DZqu0RjGmZr`) fail; the re-posted URL (`DZqwB3Imnp2`) resolves cleanly. The adapter **fails closed** either way: the login page's `og:title` matches neither author shape → `resolvePost` throws → the user sees "無法讀取該貼文…請再試一次". **Implications:** (a) the user must paste the **current** URL (after any edit, the URL changed — re-copy it); (b) the stored proof URL can later go stale if the user edits/deletes the post — already the accepted MVP trade-off (a dead proof link is OK, §A.1, no snapshots).
>
> **Testing strategy (decided 2026-06-16): unit tests MOCK saved responses; never fetch the live post.** A live post URL is **mutable** (an edit changes the shortcode) and deletable, plus network-bound — an unstable, CI-hostile fixture. The tests below feed Response-shaped mocks built from the **real captured bytes** of the `@gua.si.tw` post (one test asserts author `@gua.si.tw` + code `ABCDEF` against the exact observed HTML). A *live* end-to-end check belongs only in the human-run manual smoke (Task 12).
>
> Because resolving the author and matching the code share one fetch, the adapter exposes a single `resolvePost(parsed, code)` returning `{accountId, handle, displayName, codePresent, canonicalUrl}` (the `ResolvedPost` type from Task 4). The **canonical URL is reconstructed** from the authoritative handle + post id (`https://www.threads.com/@{handle}/post/{postId}`) — query-free and authoritative, so the stored proof URL never carries the pasted `?xmt=…` tracking token.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/binding/platforms/threads.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { threadsAdapter } from "./threads";

afterEach(() => vi.unstubAllGlobals());

// The fetch mock returns a Response-shaped object: real fetch follows redirects and exposes
// the FINAL `url` + `text()`; we mock both so the §6.3 final-host guard is exercised.
function mockFetch(html: string, url = "https://www.threads.com/@live.defrag/post/X") {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, url, text: async () => html });
}

// A realistic page: og:title only (no og:description — Threads omits it when the post has a link),
// with the entity-encoded caption embedded in the BODY. `&#064;`=@, `&#xff1a;`=：(full-width colon).
const page = (title: string, bodyCaption: string) =>
  `<html><head><meta property="og:title" content="${title}"></head><body>${bodyCaption}</body></html>`;

describe("threadsAdapter.parsePostUrl", () => {
  it("accepts canonical threads.net + threads.com post URLs (and tolerates query params)", () => {
    expect(threadsAdapter.parsePostUrl("https://www.threads.net/@live.defrag/post/DZmmGyIGe3g")?.postId).toBe("DZmmGyIGe3g");
    expect(threadsAdapter.parsePostUrl("https://threads.com/@x/post/ABC123")?.postId).toBe("ABC123");
    // Real shares carry ?xmt=…&slof=1 — the postId still parses from the path.
    expect(threadsAdapter.parsePostUrl("https://www.threads.com/@gua.si.tw/post/DZqu0RjGmZr?xmt=AQG0&slof=1")?.postId).toBe("DZqu0RjGmZr");
  });

  it("rejects non-Threads, non-HTTPS, look-alike host, and non-post paths", () => {
    expect(threadsAdapter.parsePostUrl("https://instagram.com/p/DZmqdCog-Vm/")).toBeNull();
    expect(threadsAdapter.parsePostUrl("http://www.threads.net/@x/post/ABC123")).toBeNull();
    expect(threadsAdapter.parsePostUrl("https://threads.net.evil.com/@x/post/ABC123")).toBeNull();
    expect(threadsAdapter.parsePostUrl("https://www.threads.net/@x")).toBeNull();
  });
});

describe("threadsAdapter.resolvePost", () => {
  it("parses the PARENS og:title form (name + handle) and finds the code in the body", async () => {
    vi.stubGlobal("fetch", mockFetch(page("Defrag (&#064;live.defrag) on Threads", "hi &#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;012345")));
    const res = await threadsAdapter.resolvePost({ postId: "DZmmGyIGe3g", fetchUrl: "https://www.threads.com/@x/post/DZmmGyIGe3g" }, "012345");
    expect(res.handle).toBe("live.defrag");
    expect(res.accountId).toBe("live.defrag"); // lowercased authoritative id
    expect(res.displayName).toBe("Defrag");
    expect(res.codePresent).toBe(true);
    // Canonical URL reconstructed from authoritative handle + postId — query-free, no tracking token.
    expect(res.canonicalUrl).toBe("https://www.threads.com/@live.defrag/post/DZmmGyIGe3g");
  });

  // REAL CAPTURED RESPONSE (2026-06-16) from https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2 —
  // confirmed LIVE end-to-end (200), then captured as a fixture. Exact entity-encoded bytes: bare
  // og:title + the code label in the body as `…&#x9a57;&#x8b49;&#x78bc;&#xff1a;ABCDEF`. We MOCK it
  // (not fetch live) because a post URL is mutable — editing the post mints a new shortcode (an earlier
  // capture DZqu0RjGmZr 302'd to /?error=invalid_post after an edit) — so a live URL is an unstable fixture.
  it("parses the real @gua.si.tw/DZqwB3Imnp2 response: author @gua.si.tw + code ABCDEF", async () => {
    const realHtml = page(
      "&#064;gua.si.tw on Threads",
      "&#x6211;&#x662f;&#x5206;&#x8eab;&#x8a8d;&#x8b49;&#x8cbc;&#x6587;\n&#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;ABCDEF",
    );
    vi.stubGlobal("fetch", mockFetch(realHtml));
    const res = await threadsAdapter.resolvePost(
      { postId: "DZqwB3Imnp2", fetchUrl: "https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2" },
      "ABCDEF",
    );
    expect(res.handle).toBe("gua.si.tw");
    expect(res.accountId).toBe("gua.si.tw");
    expect(res.displayName).toBeNull(); // bare og:title → no display name
    expect(res.codePresent).toBe(true); // code scanned from the decoded body, not og:description
    expect(res.canonicalUrl).toBe("https://www.threads.com/@gua.si.tw/post/DZqwB3Imnp2"); // query-free
  });

  it("reports codePresent=false when the code is absent or wrong", async () => {
    vi.stubGlobal("fetch", mockFetch(page("&#064;gua.si.tw on Threads", "&#x6211;&#x662f;&#x5206;&#x8eab;&#x9a57;&#x8b49;&#x78bc;&#xff1a;000000")));
    const res = await threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "999999");
    expect(res.codePresent).toBe(false); // author still resolved; only the code didn't match
    expect(res.handle).toBe("gua.si.tw");
  });

  it("reads the TRUE author regardless of the pasted path handle (spoof defense, §6.3)", async () => {
    vi.stubGlobal("fetch", mockFetch(page("&#064;live.defrag on Threads", "x")));
    const res = await threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@zuck/post/X" }, "012345");
    expect(res.handle).toBe("live.defrag");
  });

  it("retries once when og:title is missing on the first fetch", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, url: "", text: async () => "<html></html>" })
      .mockResolvedValueOnce({ ok: true, status: 200, url: "", text: async () => page("&#064;h on Threads", "t") });
    vi.stubGlobal("fetch", f);
    const res = await threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "012345");
    expect(f).toHaveBeenCalledTimes(2);
    expect(res.handle).toBe("h");
  });

  it("throws when the author cannot be resolved after retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, url: "", text: async () => "<html></html>" }));
    await expect(
      threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "012345"),
    ).rejects.toThrow();
  });

  it("throws when a redirect lands off-platform (§6.3 final-host guard)", async () => {
    vi.stubGlobal("fetch", mockFetch(page("&#064;h on Threads", "t"), "https://evil.com/fake"));
    await expect(
      threadsAdapter.resolvePost({ postId: "X", fetchUrl: "https://www.threads.com/@x/post/X" }, "012345"),
    ).rejects.toThrow(/off-platform/);
  });
});

describe("threadsAdapter.composeIntentUrl + hashtag", () => {
  it("builds a prefilled threads.com compose intent", () => {
    const url = threadsAdapter.composeIntentUrl!("hello world");
    expect(url.startsWith("https://www.threads.com/intent/post?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("hello world");
  });

  it("declares no hashtag (Threads uses topics, not pasteable #tags)", () => {
    expect(threadsAdapter.hashtag).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/binding/platforms/threads.test.ts`
Expected: FAIL — `Failed to resolve import "./threads"`.

- [ ] **Step 3: Implement `threads.ts`**

```typescript
// lib/binding/platforms/threads.ts
import { FB_CRAWLER_UA } from "../constants";
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

// Threads migrated threads.net → threads.com; accept BOTH (+ www). A pasted threads.net URL
// 301-redirects to threads.com, and any wrong path handle 301-redirects to the canonical
// true-author URL (verified 2026-06-16) — so we FOLLOW redirects and re-validate the final host.
const ALLOWED_HOSTS = new Set([
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
]);

// Canonical post path: /@{handle}/post/{postId}. The handle is parsed but NOT trusted — the
// author comes from og:title (platform authority); a spoofed path canonicalizes to the real author.
const POST_PATH = /^\/@[^/]+\/post\/([A-Za-z0-9_-]+)\/?$/;

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname);
}

function parsePostUrl(raw: string): ParsedPostUrl | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!isAllowedHost(u.hostname)) return null;
  const m = u.pathname.match(POST_PATH);
  if (!m) return null;
  // Fetch the validated pasted URL and FOLLOW the redirect to the canonical author URL;
  // resolvePost re-validates the FINAL host so we never read an author off a non-platform page.
  // `u.toString()` keeps any ?xmt=… query — harmless for fetching (200 either way); the STORED
  // proof URL is reconstructed query-free from the authoritative handle (see resolvePost).
  return { postId: m[1], fetchUrl: u.toString() };
}

// Minimal HTML-entity decode — Threads OG content is entity-encoded (`&#064;` = @, hex for CJK).
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

function metaContent(html: string, property: string): string | null {
  // Tolerate attribute order: property before OR after content. Decode entities on the way out.
  const a = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  );
  if (a) return decodeEntities(a[1]);
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  );
  return b ? decodeEntities(b[1]) : null;
}

async function fetchHtml(fetchUrl: string): Promise<string> {
  const resp = await fetch(fetchUrl, {
    headers: { "User-Agent": FB_CRAWLER_UA },
    redirect: "follow", // .net→.com and spoofed-handle→canonical are legitimate 301s
  });
  if (!resp.ok) throw new Error(`Threads fetch failed: ${resp.status}`);
  // Re-validate the FINAL host after following redirects — author must come from a platform domain (§6.3).
  let finalHost = "";
  try {
    finalHost = new URL(resp.url).hostname;
  } catch {
    /* resp.url empty (constructed/mock with no redirect) → skip the off-platform guard */
  }
  if (resp.url && !isAllowedHost(finalHost)) {
    throw new Error(`Threads fetch redirected off-platform: ${resp.url}`);
  }
  return resp.text();
}

// og:title has TWO shapes (after entity-decode), verified 2026-06-16:
//   "<name> (@<handle>) on Threads"  — when the account has a display name
//   "@<handle> on Threads"           — bare form when it doesn't (e.g. @gua.si.tw)
const OG_TITLE_NAMED = /^(.*?)\s*\(@([^)]+)\)\s*on Threads$/;
const OG_TITLE_BARE = /^@(\S+)\s+on Threads$/;

/** Parse author handle + optional display name from a decoded og:title. */
function parseAuthor(title: string): { handle: string; displayName: string | null } | null {
  const named = title.match(OG_TITLE_NAMED);
  if (named) return { displayName: named[1].trim() || null, handle: named[2].trim().toLowerCase() };
  const bare = title.match(OG_TITLE_BARE);
  if (bare) return { displayName: null, handle: bare[1].trim().toLowerCase() };
  return null;
}

async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  let html = await fetchHtml(parsed.fetchUrl);
  let title = metaContent(html, "og:title");
  if (!title) {
    // Threads SSR is occasionally flaky — retry once (platform-verification §3.2 gotcha).
    html = await fetchHtml(parsed.fetchUrl);
    title = metaContent(html, "og:title");
  }
  const author = title ? parseAuthor(title) : null;
  if (!author) throw new Error("Threads: could not resolve author from og:title");

  // The caption is NOT in og:description when the post contains a link (verified 2026-06-16) —
  // it lives in the SSR'd body. Decode the whole body and scan for the namespaced code. The author
  // is still pinned by og:title (authority), so scanning the body for the scoped code is safe.
  const body = decodeEntities(html);
  const codePresent = textHasCode(body, code);

  // Reconstruct the canonical URL from the AUTHORITATIVE handle + postId — query-free (drops the
  // pasted ?xmt=… tracking token) and not derived from the user-supplied path.
  const canonicalUrl = `https://www.threads.com/@${author.handle}/post/${parsed.postId}`;

  return { accountId: author.handle, handle: author.handle, displayName: author.displayName, codePresent, canonicalUrl };
}

export const threadsAdapter: PlatformAdapter = {
  key: "threads",
  label: "Threads",
  // The official guasi handle on Threads — the registered IG/Threads handle `@gua.si.tw`
  // (CLAUDE.md "Name" locked decision). Appears verbatim in the post template as the
  // per-platform `service_tag` (§D.2.1) — a growth/discoverability tag, NOT a security check.
  serviceTag: "@gua.si.tw",
  hashtag: null, // Threads uses topics, not pasteable #tags (decided 2026-06-16) — omit it
  slugEligible: true, // §A.4 — IG/Threads may mint a slug
  parsePostUrl,
  resolvePost,
  composeIntentUrl: (text: string) =>
    `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`,
};
```

- [ ] **Step 4: Run the Threads test to verify it passes**

Run: `npx vitest run lib/binding/platforms/threads.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the registry test (now its `./threads` import resolves)**

Run: `npx vitest run lib/binding/platforms/index.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 7: Commit the seam + adapter + registry together**

```bash
git add lib/binding/platforms
git commit -m "feat(binding): PlatformAdapter seam + Threads adapter (parse + author resolution)"
```

---

## Task 6: Slug helpers (derive + availability)

**Files:**
- Create: `lib/binding/slug.ts`
- Test: `lib/binding/slug.test.ts`
- Test: `lib/binding/slug.db.test.ts`

- [ ] **Step 1: Write the pure-logic failing test**

```typescript
// lib/binding/slug.test.ts
import { describe, it, expect } from "vitest";
import { deriveSlug } from "./slug";

describe("deriveSlug", () => {
  it("returns the proven handle verbatim — never a synthesized variant (§D.4/§3)", () => {
    expect(deriveSlug("alice")).toBe("alice");
  });

  it("trims surrounding whitespace", () => {
    expect(deriveSlug("  alice  ")).toBe("alice");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/binding/slug.test.ts`
Expected: FAIL — `Failed to resolve import "./slug"`.

- [ ] **Step 3: Implement `slug.ts`**

```typescript
// lib/binding/slug.ts
import { findUserBySlug } from "@/lib/identity/repo";

/**
 * The slug IS exactly a proven handle (§3) — NEVER a guasi-synthesized string (§D.4 resolves §4.3):
 * synthesizing `{handle}-ig`/`{handle}2` would break the handle-derived anti-squatting invariant.
 * So this is just a trim; the only legitimate slug source is a handle the user proved.
 */
export function deriveSlug(handle: string): string {
  return handle.trim();
}

/**
 * UX pre-check for §D.4 (case-insensitive via the citext slug column, §H.2). This is advisory only —
 * the real first-claim-wins guarantee is the `User.slug` unique index, enforced at commit (Task 9).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  return (await findUserBySlug(slug)) === null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/binding/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the DB availability test (self-skipping, per the Slice 1 convention)**

```typescript
// lib/binding/slug.db.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { isSlugAvailable } from "./slug";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("isSlugAvailable (DB)", () => {
  it("is false when a slug is taken (case-insensitive) and true otherwise", async () => {
    const u = await prisma.user.create({
      data: { email: "slug-avail@example.com", shortRef: "SlugAvail1", slug: "TakenName" },
    });
    createdIds.push(u.id);
    expect(await isSlugAvailable("takenname")).toBe(false); // citext CI match
    expect(await isSlugAvailable("a-free-name-xyz")).toBe(true);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run lib/binding/slug.db.test.ts`
Expected: PASS if `DATABASE_URL` is set; SKIPPED otherwise (both acceptable).

- [ ] **Step 7: Commit**

```bash
git add lib/binding/slug.ts lib/binding/slug.test.ts lib/binding/slug.db.test.ts
git commit -m "feat(binding): slug derive (proven-handle-only) + availability pre-check"
```

---

## Task 7: Binding repo — requests, transactional commit, provisioning

**Files:**
- Create: `lib/binding/repo.ts`
- Test: `lib/binding/repo.db.test.ts`

> This is the heart of commit-on-confirm (§H). All writes are owner-scoped; the commit is a single transaction. The DB test exercises every branch.

- [ ] **Step 1: Implement `repo.ts`**

```typescript
// lib/binding/repo.ts
import type { Platform, Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { BINDING_CODE_TTL_MINUTES } from "./constants";
import { deriveSlug } from "./slug";

/** Create a fresh pending request with a scoped code + TTL (§H.1). */
export function createBindingRequest(params: {
  userId: string;
  platform: Platform;
  code: string;
}) {
  const expiresAt = new Date(Date.now() + BINDING_CODE_TTL_MINUTES * 60_000);
  return prisma.bindingRequest.create({
    data: { userId: params.userId, platform: params.platform, code: params.code, expiresAt },
  });
}

/** Newest live (pending, unexpired) request for this user+platform — reused so the wizard is idempotent. */
export function findActiveRequest(userId: string, platform: Platform) {
  return prisma.bindingRequest.findFirst({
    where: { userId, platform, status: "pending", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export function findRequestById(id: string) {
  return prisma.bindingRequest.findUnique({ where: { id } });
}

/** The current binding for (正身, platform, account), if any — used to detect a re-validate (§A.6). */
export function findLinkedAccount(userId: string, platform: Platform, accountId: string) {
  return prisma.linkedAccount.findUnique({
    where: { userId_platform_accountId: { userId, platform, accountId } },
  });
}

/** Flip pending → resolved, stamping the platform-resolved author (§H.1). */
export function markResolved(
  id: string,
  resolved: {
    resolvedAccountId: string;
    resolvedHandle: string;
    resolvedDisplayName: string | null;
    proofPostUrl: string;
  },
) {
  return prisma.bindingRequest.update({
    where: { id },
    data: { status: "resolved", ...resolved },
  });
}

/** A real cancel (§D.3 wrong-account / §D.4 取消) — commit nothing. */
export function cancelRequest(id: string) {
  return prisma.bindingRequest.update({ where: { id }, data: { status: "cancelled" } });
}

export function isExpired(req: { expiresAt: Date; status: string }): boolean {
  return req.status === "expired" || req.expiresAt.getTime() <= Date.now();
}

export type CommitResult =
  | { ok: true; linkedAccountId: string; slug: string | null }
  | { ok: false; error: "slug_taken" | "duplicate_binding" | "not_resolvable" };

/**
 * Commit-on-confirm (§H): write LinkedAccount + ProofRecord + bound BindingEvent and mark the
 * request verified — all in ONE transaction. For a provisioning bind (`mintSlug`), also set
 * User.slug (first-claim-wins enforced by the unique index) + force isMain/public.
 */
export async function commitBinding(params: {
  requestId: string;
  asMain: boolean;
  visibility: Visibility;
  mintSlug: boolean; // true only for confirm-as-slug (§D.4)
}): Promise<CommitResult> {
  const req = await findRequestById(params.requestId);
  if (!req || req.status !== "resolved" || !req.resolvedAccountId || !req.resolvedHandle) {
    return { ok: false, error: "not_resolvable" };
  }
  // The main 分身 is the public face — provisioning forces public (§D.4).
  const visibility: Visibility = params.asMain ? "public" : params.visibility;

  try {
    return await prisma.$transaction(async (tx) => {
      if (params.asMain) {
        await tx.linkedAccount.updateMany({
          where: { userId: req.userId, isMain: true },
          data: { isMain: false },
        });
      }
      const linked = await tx.linkedAccount.create({
        data: {
          userId: req.userId,
          platform: req.platform,
          accountId: req.resolvedAccountId!,
          handle: req.resolvedHandle!,
          displayName: req.resolvedDisplayName,
          status: "verified",
          condition: "active",
          visibility,
          isMain: params.asMain,
        },
      });
      const proof = await tx.proofRecord.create({
        data: {
          linkedAccountId: linked.id,
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
          eventType: "bound",
          proofRecordId: proof.id,
        },
      });
      let slug: string | null = null;
      if (params.mintSlug) {
        slug = deriveSlug(req.resolvedHandle!);
        await tx.user.update({ where: { id: req.userId }, data: { slug } });
      }
      await tx.bindingRequest.update({
        where: { id: req.id },
        data: { status: "verified", consumedAt: new Date() },
      });
      return { ok: true as const, linkedAccountId: linked.id, slug };
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Prisma's meta.target is sometimes string[] (["slug"] / ["userId","platform","accountId"]),
    // sometimes a string. String(...) handles both; only the slug index contains "slug", and the
    // user-slug + linked-account uniques are the ONLY two reachable in this tx, so the test is unambiguous.
    const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "").toLowerCase();
    if (code === "P2002" && target.includes("slug")) return { ok: false, error: "slug_taken" };
    if (code === "P2002") return { ok: false, error: "duplicate_binding" }; // (userId, platform, accountId)
    throw e;
  }
}

export type ProvisionResult =
  | { ok: true; slug: string }
  | { ok: false; error: "slug_taken" | "not_found" };

/**
 * §D.5 setup picker: designate an ALREADY-verified account as 主要帳號 — set isMain + force public +
 * mint the slug from its handle. No new request/proof (the binding already exists).
 */
export async function provisionExistingAccount(
  userId: string,
  linkedAccountId: string,
): Promise<ProvisionResult> {
  const acct = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!acct || acct.userId !== userId) return { ok: false, error: "not_found" };
  const slug = deriveSlug(acct.handle);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.linkedAccount.updateMany({
        where: { userId, isMain: true },
        data: { isMain: false },
      });
      await tx.linkedAccount.update({
        where: { id: linkedAccountId },
        data: { isMain: true, visibility: "public" },
      });
      await tx.user.update({ where: { id: userId }, data: { slug } });
    });
    return { ok: true, slug };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "slug_taken" };
    throw e;
  }
}

/** Eligible existing main-account candidates for the §D.5 picker (verified, slug-eligible platforms). */
export function listProvisionCandidates(userId: string) {
  return prisma.linkedAccount.findMany({
    where: { userId, status: "verified", platform: "threads" }, // Slice 2: only Threads is slug-eligible
    orderBy: { verifiedAt: "asc" },
  });
}
```

- [ ] **Step 2: Write the DB test covering every branch**

```typescript
// lib/binding/repo.db.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  createBindingRequest,
  findActiveRequest,
  findLinkedAccount,
  markResolved,
  cancelRequest,
  commitBinding,
  provisionExistingAccount,
} from "./repo";

const hasDb = !!process.env.DATABASE_URL;
const userIds: string[] = [];

async function freshUser(email: string, shortRef: string) {
  const u = await prisma.user.create({ data: { email, shortRef } });
  userIds.push(u.id);
  return u;
}

async function resolvedRequest(userId: string, handle: string, code = "012345") {
  const req = await createBindingRequest({ userId, platform: "threads", code });
  return markResolved(req.id, {
    resolvedAccountId: handle,
    resolvedHandle: handle,
    resolvedDisplayName: "Disp",
    proofPostUrl: "https://www.threads.net/@x/post/ABC",
  });
}

afterAll(async () => {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("binding repo (DB)", () => {
  it("createBindingRequest is pending + findActiveRequest reuses it", async () => {
    const u = await freshUser("br-active@example.com", "BrActive01");
    const req = await createBindingRequest({ userId: u.id, platform: "threads", code: "000111" });
    expect(req.status).toBe("pending");
    expect((await findActiveRequest(u.id, "threads"))?.id).toBe(req.id);
  });

  it("commitBinding (ordinary, non-main) writes LinkedAccount + ProofRecord + bound event, no slug", async () => {
    const u = await freshUser("br-ord@example.com", "BrOrd0001");
    const req = await resolvedRequest(u.id, "ordhandle");
    const res = await commitBinding({ requestId: req.id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slug).toBeNull();
    const la = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(la?.isMain).toBe(false);
    expect(la?.visibility).toBe("private");
    expect(await prisma.proofRecord.count({ where: { linkedAccountId: res.linkedAccountId } })).toBe(1);
    expect(await prisma.bindingEvent.count({ where: { userId: u.id, eventType: "bound" } })).toBe(1);
    expect((await prisma.bindingRequest.findUnique({ where: { id: req.id } }))?.status).toBe("verified");
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.slug).toBeNull();
  });

  it("commitBinding (confirm-as-slug) mints the slug + forces isMain/public", async () => {
    const u = await freshUser("br-slug@example.com", "BrSlug001");
    const req = await resolvedRequest(u.id, "MintMe");
    const res = await commitBinding({ requestId: req.id, asMain: true, visibility: "private", mintSlug: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.slug).toBe("MintMe");
    const la = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(la?.isMain).toBe(true);
    expect(la?.visibility).toBe("public"); // forced despite visibility:"private"
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.slug).toBe("MintMe");
  });

  it("commitBinding returns slug_taken on a case-insensitive slug clash (first-claim-wins)", async () => {
    const u1 = await freshUser("br-race1@example.com", "BrRace001");
    await commitBinding({ requestId: (await resolvedRequest(u1.id, "RaceName")).id, asMain: true, visibility: "private", mintSlug: true });
    const u2 = await freshUser("br-race2@example.com", "BrRace002");
    const res = await commitBinding({ requestId: (await resolvedRequest(u2.id, "racename")).id, asMain: true, visibility: "private", mintSlug: true });
    expect(res).toEqual({ ok: false, error: "slug_taken" });
    expect((await prisma.user.findUnique({ where: { id: u2.id } }))?.slug).toBeNull(); // txn rolled back
  });

  it("commitBinding returns duplicate_binding when the same account is bound twice by one 正身 (§A.6)", async () => {
    const u = await freshUser("br-dup@example.com", "BrDup0001");
    await commitBinding({ requestId: (await resolvedRequest(u.id, "dupacct")).id, asMain: false, visibility: "private", mintSlug: false });
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "dupacct")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res).toEqual({ ok: false, error: "duplicate_binding" });
  });

  it("the SAME account may be bound by TWO different 正身 (no global lock, §A.6)", async () => {
    const a = await freshUser("br-shareA@example.com", "BrShareA0");
    const b = await freshUser("br-shareB@example.com", "BrShareB0");
    const ra = await commitBinding({ requestId: (await resolvedRequest(a.id, "shared")).id, asMain: false, visibility: "private", mintSlug: false });
    const rb = await commitBinding({ requestId: (await resolvedRequest(b.id, "shared")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(ra.ok && rb.ok).toBe(true);
  });

  it("cancelRequest commits nothing", async () => {
    const u = await freshUser("br-cancel@example.com", "BrCancel0");
    const req = await resolvedRequest(u.id, "cancelme");
    await cancelRequest(req.id);
    expect((await prisma.bindingRequest.findUnique({ where: { id: req.id } }))?.status).toBe("cancelled");
    expect(await prisma.linkedAccount.count({ where: { userId: u.id } })).toBe(0);
  });

  it("findLinkedAccount detects a re-validate (already-bound) and is null otherwise (§A.6)", async () => {
    const u = await freshUser("br-rebind@example.com", "BrRebind0");
    await commitBinding({ requestId: (await resolvedRequest(u.id, "boundacct")).id, asMain: false, visibility: "private", mintSlug: false });
    expect((await findLinkedAccount(u.id, "threads", "boundacct"))?.handle).toBe("boundacct");
    expect(await findLinkedAccount(u.id, "threads", "neveracct")).toBeNull();
  });

  it("provisionExistingAccount sets main + public + mints slug from the handle (§D.5)", async () => {
    const u = await freshUser("br-prov@example.com", "BrProv001");
    const res = await commitBinding({ requestId: (await resolvedRequest(u.id, "ProvMe")).id, asMain: false, visibility: "private", mintSlug: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const prov = await provisionExistingAccount(u.id, res.linkedAccountId);
    expect(prov).toEqual({ ok: true, slug: "ProvMe" });
    const la = await prisma.linkedAccount.findUnique({ where: { id: res.linkedAccountId } });
    expect(la?.isMain).toBe(true);
    expect(la?.visibility).toBe("public");
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.slug).toBe("ProvMe");
  });
});
```

- [ ] **Step 3: Run the DB test**

Run: `npx vitest run lib/binding/repo.db.test.ts`
Expected: PASS if `DATABASE_URL` is set; SKIPPED otherwise. If running against a DB, all 10 cases pass.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add lib/binding/repo.ts lib/binding/repo.db.test.ts
git commit -m "feat(binding): commit-on-confirm repo — requests, transactional commit, provisioning"
```

---

## Task 8: Add Account wizard page + start/submit actions

**Files:**
- Create: `app/add/[platform]/actions.ts`
- Create: `app/add/[platform]/AddAccountWizard.tsx`
- Create: `app/add/[platform]/page.tsx`
- Modify: `app/r/[shortRef]/page.tsx` (point the stub CTA at `/add/threads` — full picker lands in Task 10)
- Modify: `app/globals.css` (additive classes)

- [ ] **Step 1: Write the server actions**

```typescript
// app/add/[platform]/actions.ts
"use server";

import { redirect } from "next/navigation";
import type { Platform } from "@prisma/client";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { generateCode } from "@/lib/binding/code";
import {
  createBindingRequest,
  findActiveRequest,
  findRequestById,
  isExpired,
  markResolved,
} from "@/lib/binding/repo";

/** Create (or reuse) a pending request, then reveal the template via ?rid= (§D.2). */
export async function createRequestAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const platform = String(formData.get("platform") ?? "");
  const adapter = getAdapter(platform);
  if (!adapter) redirect("/");

  const existing = await findActiveRequest(user.id, platform as Platform);
  const req = existing ?? (await createBindingRequest({ userId: user.id, platform: platform as Platform, code: generateCode() }));
  redirect(`/add/${platform}?rid=${req.id}`);
}

export type SubmitState = { error?: string };

/** Resolve the pasted post URL through platform authority + match the code (§6.3 / §D.2). */
export async function submitProofUrlAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const url = String(formData.get("url") ?? "").trim();

  const adapter = getAdapter(platform);
  if (!adapter) return { error: "不支援的平台" };

  const req = await findRequestById(rid);
  if (!req || req.userId !== user.id || req.platform !== platform) return { error: "找不到驗證請求，請重新開始" };
  if (req.status !== "pending" || isExpired(req)) return { error: "驗證碼已過期，請重新產生貼文範本" };

  // Security gate: validate URL against THIS platform BEFORE any fetch (§D.2).
  const parsed = adapter.parsePostUrl(url);
  if (!parsed) return { error: `這不是有效的 ${adapter.label} 貼文網址` };

  // One fetch resolves author + checks the code + returns the clean canonical URL (§6.3).
  let resolved;
  try {
    resolved = await adapter.resolvePost(parsed, req.code);
  } catch {
    return { error: "無法讀取該貼文，請確認貼文為公開並再試一次" };
  }
  if (!resolved.codePresent) {
    return { error: "貼文中找不到正確的驗證碼，請確認你貼上的是剛剛發佈的那則貼文" };
  }

  await markResolved(req.id, {
    resolvedAccountId: resolved.accountId,
    resolvedHandle: resolved.handle,
    resolvedDisplayName: resolved.displayName,
    proofPostUrl: resolved.canonicalUrl, // query-free canonical, not the pasted ?xmt=… URL
  });
  redirect(`/add/${platform}/confirm?rid=${req.id}`);
}
```

- [ ] **Step 2: Write the client wizard component**

```tsx
// app/add/[platform]/AddAccountWizard.tsx
"use client";

import { useActionState, useState } from "react";
import { submitProofUrlAction, type SubmitState } from "./actions";

type Props = {
  platform: string;
  label: string;
  rid: string;
  template: string;
  composeIntentUrl: string | null;
  igNote?: boolean;
};

export function AddAccountWizard({ platform, label, rid, template, composeIntentUrl, igNote }: Props) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitProofUrlAction, {});
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="wizard">
      <p className="hint credibility">
        💡 這則貼文就是你的<strong>公開證明</strong>，保留它能讓你的正身更可信 —— 任何人都能點進去親自查證。
        日後<strong>編輯或刪除</strong>這則貼文會讓證明連結失效（編輯會改變貼文網址），綁定本身則不受影響。
      </p>

      <pre className="template">{template}</pre>

      <div className="wizard-actions">
        <button type="button" className="btn-primary" onClick={copy}>
          {copied ? "已複製 ✓" : "複製貼文內容"}
        </button>
        {composeIntentUrl ? (
          <a className="btn-secondary" href={composeIntentUrl} target="_blank" rel="noopener noreferrer">
            在 {label} 發佈 ↗
          </a>
        ) : null}
      </div>

      {igNote ? (
        <p className="hint">Instagram 需附上一張圖片，且貼文內的連結不可點擊 —— 建議也把網址放到個人簡介。</p>
      ) : null}

      <form action={action} className="form paste-form">
        <label className="label" htmlFor="url">貼文發佈後，把貼文網址貼回這裡</label>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <input id="url" name="url" type="url" required placeholder={`https://www.threads.net/@你的帳號/post/…`} className="input" />
        {state.error ? <p className="error">{state.error}</p> : null}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "驗證中…" : "驗證並繼續 →"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write the wizard page**

```tsx
// app/add/[platform]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { buildVerificationPost, profileUrlFor } from "@/lib/binding/template";
import { findRequestById, isExpired } from "@/lib/binding/repo";
import { createRequestAction } from "./actions";
import { AddAccountWizard } from "./AddAccountWizard";

export default async function AddAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ rid?: string }>;
}) {
  const { platform } = await params;
  const { rid } = await searchParams;

  // Unknown / not-yet-built platform (IG/miin in Slice 2) → generic 404 (the registry has no adapter).
  const adapter = getAdapter(platform);
  if (!adapter) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // No active request yet → show the "produce the template" button (creates + reveals via ?rid=).
  const req = rid ? await findRequestById(rid) : null;
  const haveLiveReq = req && req.userId === user.id && req.platform === platform && req.status === "pending" && !isExpired(req);

  if (!haveLiveReq) {
    return (
      <main className="wrap">
        <h1 className="wordmark sm">註冊分身 · {adapter.label}</h1>
        <p className="lede">產生一則含驗證碼的貼文範本，發佈後貼回網址即可完成綁定。</p>
        <form action={createRequestAction}>
          <input type="hidden" name="platform" value={platform} />
          <button type="submit" className="btn-primary">產生驗證貼文範本</button>
        </form>
        <footer className="foot">guasi.tw</footer>
      </main>
    );
  }

  const template = buildVerificationPost({
    hashtag: adapter.hashtag, // null for Threads (no pasteable hashtags)
    serviceTag: adapter.serviceTag,
    profileUrl: profileUrlFor(user),
    code: req!.code,
  });

  return (
    <main className="wrap">
      <h1 className="wordmark sm">註冊分身 · {adapter.label}</h1>
      <AddAccountWizard
        platform={platform}
        label={adapter.label}
        rid={req!.id}
        template={template}
        composeIntentUrl={adapter.composeIntentUrl ? adapter.composeIntentUrl(template) : null}
        igNote={platform === "instagram"}
      />
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 4: Point the Slice 1 pre-provisioned CTA at the wizard**

In `app/r/[shortRef]/page.tsx`, replace the stub `<button>` block:

```tsx
        <button type="button" className="btn-stub" disabled>
          設定主要帳號並開通公開網址 →（即將推出）
        </button>
```

with a working link (the full picker arrives in Task 10):

```tsx
        <a className="btn-primary" href="/add/threads">設定主要帳號並開通公開網址 →</a>
```

> Slice 1's `app/onboarding/actions.ts` already redirects to `/r/${user.shortRef}` on save, so the §D.1 onboarding CTA ("下一步：…") lands the user on this pre-provisioned page — whose CTA now leads into `/add/threads`. That closes the §D.1 → Add Account path without touching `app/onboarding/`.

- [ ] **Step 5: Add the additive CSS classes**

Append to `app/globals.css`. **The app is dark-themed** (`globals.css` uses `--bg:#0b0b0f`, `--fg:#f5f5f7`, `--muted:#8a8a94`, `--accent:#e8b500`; surfaces are `#15151c`/border `#2a2a33`/radius `0.6rem`; the highlight box `.hint.permanence` is `#1a160b`/border `#3a2f10`). These classes mirror those dark tokens — **do not use light hexes** (they'd be near-invisible):

```css
/* --- Slice 2: Add Account wizard + confirm --- */
.wizard { width: 100%; max-width: 28rem; display: flex; flex-direction: column; gap: 1rem; text-align: left; }
.template {
  white-space: pre-wrap;
  background: #15151c;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
  padding: 1rem;
  font-size: 0.9rem;
  color: var(--fg);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.wizard-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.paste-form { gap: 0.5rem; }
.credibility { background: #1a160b; border: 1px solid #3a2f10; border-radius: 0.6rem; padding: 0.75rem; }
/* Clearly-clickable secondary control (works as both <a> and <button>). NOT .btn-stub (that looks disabled). */
.btn-secondary {
  display: inline-block;
  text-align: center;
  padding: 0.7rem 0.9rem;
  background: transparent;
  border: 1px solid #34343f;
  border-radius: 0.6rem;
  color: var(--fg);
  text-decoration: none;
  font: inherit;
  cursor: pointer;
}
.confirm-card {
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: #15151c;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
  text-align: left;
}
.confirm-actions { display: flex; flex-direction: column; gap: 0.5rem; }
.confirm-actions fieldset { border: 1px solid #2a2a33; border-radius: 0.6rem; padding: 0.6rem 0.85rem; display: flex; flex-direction: column; gap: 0.4rem; }
.gate { display: flex; gap: 0.5rem; align-items: flex-start; color: var(--fg); }
.hint.warn, .warn { color: var(--accent); }
.url-preview { font-weight: 700; color: var(--fg); word-break: break-all; }
.picker { width: 100%; max-width: 28rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
.picker-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #15151c;
  border: 1px solid #2a2a33;
  border-radius: 0.6rem;
}
```

- [ ] **Step 6: Build to verify the routes compile**

Run: `npx next build`
Expected: build succeeds; `/add/[platform]` appears in the route list. (Requires DB env for `prisma migrate deploy` in the `build` script — if running locally without it, run `npx prisma generate && npx tsc --noEmit` instead and defer the full build to CI.)

- [ ] **Step 7: Commit**

```bash
git add app/add/\[platform\]/actions.ts app/add/\[platform\]/AddAccountWizard.tsx app/add/\[platform\]/page.tsx app/r/\[shortRef\]/page.tsx app/globals.css
git commit -m "feat(add-account): Threads wizard — template, compose/copy, paste-back resolution"
```

---

## Task 9: Confirm step — success/visibility (§D.3) + slug-confirm (§D.4)

**Files:**
- Create: `app/add/[platform]/confirm/actions.ts`
- Create: `app/add/[platform]/confirm/ConfirmForms.tsx`
- Create: `app/add/[platform]/confirm/page.tsx`

> One route, branching on state: **(0) resolved account already bound by this 正身 → "已綁定" notify, no write** (§A.6 re-validate; the re_verify refresh is Slice 5); otherwise **(1) owner has a slug → ordinary bind (§D.3)**; **(2) no slug + slug-eligible → slug-confirm/provisioning (§D.4, three actions)**; **(3) no slug + not slug-eligible → keep-as-分身 / cancel only**. Matches §H commit points exactly. The §D.3 copy also warns that **editing or deleting** the post breaks the proof link (editing changes the URL).

- [ ] **Step 1: Write the confirm actions**

```typescript
// app/add/[platform]/confirm/actions.ts
"use server";

import { redirect } from "next/navigation";
import type { Visibility } from "@prisma/client";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { cancelRequest, commitBinding, findRequestById } from "@/lib/binding/repo";

async function ownedResolvedRequest(rid: string, platform: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const req = await findRequestById(rid);
  if (!req || req.userId !== user.id || req.platform !== platform) redirect("/");
  return { user, req: req! };
}

/** §D.3 ordinary bind (owner already provisioned): commit non-main with the chosen visibility. */
export async function confirmOrdinaryAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const visibility = (formData.get("visibility") === "public" ? "public" : "private") as Visibility;
  const { user, req } = await ownedResolvedRequest(rid, platform);

  const res = await commitBinding({ requestId: req.id, asMain: false, visibility, mintSlug: false });
  if (!res.ok && res.error === "duplicate_binding") {
    redirect(`/add/${platform}/confirm?rid=${rid}&err=dup`);
  }
  redirect(user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`);
}

/** §D.4 confirm-as-slug: commit as main + force public + mint slug. */
export async function confirmAsSlugAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const { req } = await ownedResolvedRequest(rid, platform);

  const res = await commitBinding({ requestId: req.id, asMain: true, visibility: "public", mintSlug: true });
  if (!res.ok) {
    redirect(`/add/${platform}/confirm?rid=${rid}&err=${res.error}`); // slug_taken | duplicate_binding
  }
  redirect(`/gua/${res.ok ? res.slug : ""}`);
}

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
  redirect(`/r/${user.shortRef}`);
}

/** §D.3 wrong-account / §D.4 取消: a real cancel — commit nothing. */
export async function cancelRequestAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const rid = String(formData.get("rid") ?? "");
  const { user, req } = await ownedResolvedRequest(rid, platform);
  await cancelRequest(req.id);
  redirect(user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`);
}
```

- [ ] **Step 2: Write the client confirm forms (visibility radios + permanence gate)**

```tsx
// app/add/[platform]/confirm/ConfirmForms.tsx
"use client";

import { useState } from "react";

/** §D.3 ordinary bind — visibility choice (default 私密) + confirm/cancel. */
export function OrdinaryConfirm({
  platform,
  rid,
  confirm,
  cancel,
}: {
  platform: string;
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
    </div>
  );
}

/** §D.4 slug-confirm — three actions, with a permanence checkbox gating confirm-as-slug. */
export function SlugConfirm({
  platform,
  rid,
  slugUrl,
  taken,
  confirmAsSlug,
  keepAsAccount,
  cancel,
}: {
  platform: string;
  rid: string;
  slugUrl: string;
  taken: boolean;
  confirmAsSlug: (fd: FormData) => void;
  keepAsAccount: (fd: FormData) => void;
  cancel: (fd: FormData) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="confirm-actions">
      {taken ? (
        <p className="error">{slugUrl} 已被使用 —— 你可以保留此帳號為分身，或改用其他平台/帳號的名稱作為主要帳號。</p>
      ) : (
        <>
          <p>你的永久公開網址將會是：</p>
          <p className="url-preview">{slugUrl}</p>
          <p className="hint warn">此網址永久固定，無法更改。</p>
          <form action={confirmAsSlug} className="confirm-actions">
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={rid} />
            <label className="gate">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /> 我了解此網址無法更改
            </label>
            <button type="submit" className="btn-primary" disabled={!agreed}>確認，建立正身頁</button>
          </form>
        </>
      )}

      <form action={keepAsAccount} className="confirm-actions">
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        {/* §D.4 keep-as-分身 commits "per the §D.3 visibility choice — default 私密". */}
        <fieldset>
          <legend className="label">保留為分身的能見度</legend>
          <label className="label"><input type="radio" name="visibility" value="private" defaultChecked /> 私密（預設）</label>
          <label className="label"><input type="radio" name="visibility" value="public" /> 公開</label>
          <p className="hint warn">⚠ 一旦公開將永久顯示，無法改回私密。</p>
        </fieldset>
        <button type="submit" className="btn-secondary">保留為分身，綁定其他帳號作為主要帳號</button>
      </form>

      <form action={cancel}>
        <input type="hidden" name="platform" value={platform} />
        <input type="hidden" name="rid" value={rid} />
        <button type="submit" className="btn-secondary">取消（不綁定此帳號）</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Write the confirm page (branch on provisioning state)**

```tsx
// app/add/[platform]/confirm/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { findLinkedAccount, findRequestById } from "@/lib/binding/repo";
import { deriveSlug, isSlugAvailable } from "@/lib/binding/slug";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { OrdinaryConfirm, SlugConfirm } from "./ConfirmForms";
import {
  cancelRequestAction,
  confirmAsSlugAction,
  confirmOrdinaryAction,
  keepAsAccountAction,
} from "./actions";

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ rid?: string; err?: string }>;
}) {
  const { platform } = await params;
  const { rid, err } = await searchParams;

  const adapter = getAdapter(platform);
  if (!adapter) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const req = rid ? await findRequestById(rid) : null;
  if (!req || req.userId !== user.id || req.platform !== platform || req.status !== "resolved") {
    redirect(`/add/${platform}`);
  }

  const dateStr = new Date(req!.createdAt).toLocaleDateString("zh-TW");

  // §A.6 re-validate: if the resolved account is ALREADY bound by this 正身, don't bind again.
  // Slice 2 = NOTIFY only (no write); the re_verify refresh ships with the Manage tab (Slice 5).
  const alreadyBound = await findLinkedAccount(user.id, platform, req!.resolvedAccountId!);

  return (
    <main className="wrap">
      <h1 className="wordmark sm">確認綁定 · {adapter.label}</h1>

      {alreadyBound ? (
        // Already-bound notify (on-screen; no email in MVP). Discard the redundant request.
        <div className="confirm-card">
          <p>✓ @{req!.resolvedHandle} 已經是你綁定過的帳號了。</p>
          <p className="hint">
            這次不會重複綁定。日後若要更新證明（重新驗證），可到你的{" "}
            <strong>分身管理</strong> 操作（即將推出）。
          </p>
          <a className="btn-primary" href={user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`}>
            返回我的正身
          </a>
          <form action={cancelRequestAction}>
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="rid" value={req!.id} />
            <button type="submit" className="btn-secondary">關閉</button>
          </form>
        </div>
      ) : (
      <div className="confirm-card">
        <p>✓ @{req!.resolvedHandle} · 作者由平台確認 · {dateStr}</p>
        <p className="hint">
          刪除或編輯這則貼文都<strong>不會解除綁定</strong>；但會讓證明連結失效 ——{" "}
          <strong>編輯會改變貼文網址</strong>，刪除則讓貼文消失。保留原貼文能讓任何人點開查證，正身更可信。
        </p>
        {err === "dup" || err === "duplicate_binding" ? (
          <p className="error">你已經綁定過這個帳號了。</p>
        ) : null}

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
      </div>
      )}
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 (no type errors).

- [ ] **Step 5: Commit**

```bash
git add app/add/\[platform\]/confirm
git commit -m "feat(add-account): confirm step — ordinary bind (§D.3) + slug-confirm/provisioning (§D.4)"
```

---

## Task 10: Pre-provisioned page — setup picker + provision-existing (§D.5)

**Files:**
- Create: `app/r/[shortRef]/actions.ts`
- Modify: `app/r/[shortRef]/page.tsx`

- [ ] **Step 1: Write the provision-existing action**

```typescript
// app/r/[shortRef]/actions.ts
"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { provisionExistingAccount } from "@/lib/binding/repo";

/** §D.5: designate an already-verified account as 主要帳號 (mint slug + force public). */
export async function provisionExistingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const shortRef = String(formData.get("shortRef") ?? "");
  const linkedAccountId = String(formData.get("linkedAccountId") ?? ""); // a LinkedAccount.id, not a platform handle
  if (user.shortRef !== shortRef) redirect("/"); // owner-scoped

  const res = await provisionExistingAccount(user.id, linkedAccountId);
  if (!res.ok) {
    redirect(`/r/${shortRef}?provision=${linkedAccountId}&err=${res.error}`);
  }
  redirect(`/gua/${res.ok ? res.slug : ""}`);
}
```

- [ ] **Step 2: Rewrite the pre-provisioned page with the picker + slug-confirm panel**

Replace the body of `app/r/[shortRef]/page.tsx` (keep the imports for `notFound`/`permanentRedirect`/`redirect`/`getCurrentUser`/`findUserByShortRef`; add the new ones):

```tsx
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { findUserByShortRef } from "@/lib/identity/repo";
import { listProvisionCandidates } from "@/lib/binding/repo";
import { deriveSlug, isSlugAvailable } from "@/lib/binding/slug";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { provisionExistingAction } from "./actions";

export default async function PreProvisionedPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortRef: string }>;
  searchParams: Promise<{ provision?: string; err?: string }>;
}) {
  const { shortRef } = await params;
  const { provision, err } = await searchParams;

  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const owner = await findUserByShortRef(shortRef);
  if (!owner || owner.id !== viewer.id) notFound();
  if (owner.slug) permanentRedirect(`/gua/${owner.slug}`);

  const candidates = await listProvisionCandidates(owner.id);
  const selected = provision ? candidates.find((c) => c.id === provision) : null;

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

      {selected ? (
        // Slug-confirm panel for an existing verified account (§D.4 permanence gate, server-rendered).
        <div className="confirm-card">
          <p>將以這個帳號作為主要帳號並開通公開網址：</p>
          <p className="url-preview">{SITE_ORIGIN}/gua/{deriveSlug(selected.handle)}</p>
          {err === "slug_taken" || !(await isSlugAvailable(deriveSlug(selected.handle))) ? (
            <p className="error">{SITE_ORIGIN}/gua/{deriveSlug(selected.handle)} 已被使用 —— 請改用其他帳號。</p>
          ) : (
            <form action={provisionExistingAction} className="confirm-actions">
              <input type="hidden" name="shortRef" value={shortRef} />
              <input type="hidden" name="linkedAccountId" value={selected.id} />
              <p className="hint warn">此網址永久固定，無法更改。設為主要帳號會將其永久公開。</p>
              <button type="submit" className="btn-primary">確認，建立正身頁</button>
            </form>
          )}
          <a className="btn-secondary" href={`/r/${shortRef}`}>返回</a>
        </div>
      ) : (
        <>
          <div className="slot empty">
            <span className="slot-label">主要帳號 · 尚未設定</span>
          </div>

          {candidates.length > 0 ? (
            <div className="picker">
              <p className="hint">選一個已驗證的帳號作為主要帳號：</p>
              {candidates.map((c) => (
                <div key={c.id} className="picker-row">
                  <span>@{c.handle} · {c.platform}</span>
                  <a className="btn-secondary" href={`/r/${shortRef}?provision=${c.id}`}>★ 設為主要帳號</a>
                </div>
              ))}
            </div>
          ) : null}

          <a className="btn-primary" href="/add/threads">
            ＋ 驗證另一個帳號當主要帳號 →
          </a>
        </>
      )}

      <p className="hint"><a href="/onboarding">編輯個人資料</a></p>
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/r/\[shortRef\]/actions.ts app/r/\[shortRef\]/page.tsx
git commit -m "feat(provisioning): §D.5 setup picker + provision-an-existing-account slug-confirm"
```

---

## Task 11: Full test + lint + build gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS. Pure-logic suites (code/template/slug/threads/registry) run everywhere; the `*.db.test.ts` suites PASS against a real `DATABASE_URL` or SKIP without one.

- [ ] **Step 2: Run the DB suites against a database explicitly**

Run: `DATABASE_URL="$DATABASE_URL" npx vitest run lib/binding/repo.db.test.ts lib/binding/slug.db.test.ts`
Expected: all `binding repo (DB)` + `isSlugAvailable (DB)` cases PASS (not skipped). If skipped, set `DATABASE_URL` (pull with `vercel env pull` or use a Neon preview branch) and re-run — these are the tests that prove the commit transaction, slug-taken rollback, and per-owner uniqueness.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Production build**

Run: `npx next build`
Expected: succeeds; route list includes `/add/[platform]`, `/add/[platform]/confirm`, `/r/[shortRef]`, `/gua/[slug]`. (The `build` npm script runs `prisma migrate deploy` first — ensure `DATABASE_URL`/`DATABASE_URL_UNPOOLED` are set, or run `npx next build` after a manual `prisma generate`.)

- [ ] **Step 5: Commit any incidental fixes**

```bash
git add -A
git commit -m "chore(slice2): green test + lint + build gate"
```

---

## Task 12: Manual smoke (dev server) — the full Threads happy path

**Files:** none (manual verification; pages aren't in the vitest harness)

> Requires a logged-in 正身 (Google login, Slice 0) and a real Threads account to post from. Run `npm run dev` with `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN` from `vercel env pull`.
>
> **Editing a Threads post changes its URL (verified 2026-06-16).** If the tester edits the verification post after composing it, Threads mints a **new shortcode** and the old URL 302s to `/?error=invalid_post` → "無法讀取該貼文…請再試一次". Fix: **re-copy the current post URL** after any edit and paste that. The parser correctness itself is proven deterministically by the mocked unit test in Task 5 (the real `@gua.si.tw` / `ABCDEF` capture); this caveat is only about which URL the human pastes.

- [ ] **Step 1: First-account provisioning path**
  - Log in → complete onboarding → land on `/r/{shortRef}` → click **設定主要帳號並開通公開網址** → `/add/threads`.
  - Click **產生驗證貼文範本**; confirm the Threads template **leads with `@gua.si.tw`** (no `#` hashtag — Threads uses topics), and shows the `guasi.tw/r/{shortRef}` link and `我是分身驗證碼：{6 digits}`.
  - Click **在 Threads 發佈** (or copy) → publish the post from your Threads account → paste the post URL back → **驗證並繼續**.
  - On `/add/threads/confirm`: verify it shows `✓ @{your_handle}`, the permanence gate, and `guasi.tw/gua/{your_handle}`. Tick the checkbox → **確認，建立正身頁**.
  - Expect a redirect to `/gua/{your_handle}` (the Slice 3 stub renders — expected). Re-visiting `/r/{shortRef}` now 308-redirects there.

- [ ] **Step 2: Security gates**
  - Paste an `instagram.com/p/...` URL → expect "這不是有效的 Threads 貼文網址".
  - Paste a Threads URL for a post that lacks the code → expect the missing-code error.
  - Paste a Threads URL with a **spoofed `@someoneelse`** path but the real post id → expect the resolved handle to be the **true author**, not the path handle (§6.3).

- [ ] **Step 3: keep-as-分身 + picker path**
  - As a fresh 正身, bind a Threads account but choose **保留為分身，綁定其他帳號作為主要帳號** → expect to stay on `/r/{shortRef}` with the account listed under the picker.
  - Click **★ 設為主要帳號** for it → confirm → expect provisioning to `/gua/{handle}`.

- [ ] **Step 4: Cancel path**
  - Start a bind, resolve, then **取消** → expect no `linked_account` row created (check via `npx prisma studio` or a quick query) and a redirect back.

- [ ] **Step 5: Re-validate (already-bound) path + edit/delete warning**
  - Run Add Account again for an account you've **already bound** (post + paste a fresh proof from the same account) → on the confirm step expect the **"@{handle} 已經是你綁定過的帳號了"** notify, a **返回我的正身** link, and **no new `linked_account` row** (verify count unchanged in prisma studio).
  - On the normal confirm step (a not-yet-bound account), confirm the copy warns that **編輯或刪除** the post breaks the proof link while the binding stands.

- [ ] **Step 6: Record the result**
  - Note pass/fail per step. If the Threads compose-intent URL or crawler-UA SSR behaves differently than `platform-verification.md` documents (spec §F open item), capture the discrepancy for a follow-up before relying on it in production.

---

## Spec coverage check (self-review)

- **§H binding_requests / commit-on-confirm** → Tasks 1, 7 (state machine: pending→resolved→verified/cancelled; `expired` lazily via `isExpired`; the abandoned-cleanup cron is deferred per routing §2.2 — noted, not built).
- **§A.6 linked_accounts per-owner rows / no global lock** → Task 1 (`@@unique([userId, platform, accountId])`), Task 7 (duplicate_binding + "two 正身 share one account" tests).
- **§A.1 proof_records, no snapshots** → Task 1 (nullable snapshot columns), Task 7 (writes `proofPostUrl` only).
- **binding_events ledger (bound only)** → Task 1, Task 7. `re_verified`/condition flags are Slice 5 (out of scope, noted).
- **§D.2 per-platform wizard (Threads), URL security gate, no pre-declared handle, compose-intent vs copy** → Tasks 4, 5, 8.
- **§D.2.1 template (growth engine), short-link vs /gua/ profile URL** → Task 3, Task 8.
- **§D.3 success/visibility, wrong-account discard, deletion+edit guidance** → Task 9 (`OrdinaryConfirm`, `cancelRequestAction`; copy warns edit/delete breaks the proof link).
- **§A.6 re-validate already-bound account → notify only** → Task 7 (`findLinkedAccount`) + Task 9 (already-bound branch). The re_verify *write* (append proof + `re_verified` + condition-restore) is **Slice 5** (deferred, decided 2026-06-16).
- **§D.4 slug-confirm three actions, permanence gate, availability pre-check, taken handling, force public+main** → Tasks 6, 7, 9.
- **§D.5 pre-provisioned picker + provision-existing** → Task 10.
- **§A.4 IG/Threads-only slug source** → Task 5 (`slugEligible`), Task 7 (`listProvisionCandidates` filters to threads), Task 9 (non-eligible branch).
- **§H.2 first-claim-wins via unique index** → Task 1 (`User.slug @unique @db.Citext`, already shipped Slice 1), Task 7 (slug_taken rollback test).
- **Start with ONE platform** → Task 4 registry has only Threads; IG/miin routes 404 (Task 8).

**Out of scope (correctly deferred):** Identity Card render (Slice 3), Timeline (Slice 4), Manage/condition flags/disclose + **re-verify refresh of an already-bound account** (Slice 5 — Slice 2 only notifies), IG + miin adapters (later), abandoned-account TTL cron, search.
```
