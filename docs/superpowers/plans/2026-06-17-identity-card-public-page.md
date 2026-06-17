# Identity Card — public page (`/gua/{slug}`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/gua/{slug}` stub with the real public Identity Card (帳號 tab) — a server-rendered Linktree showing a 正身's verified 分身, with an owner-only 公開 ⇄ 管理 toggle.

**Architecture:** A server component (`page.tsx`) does the slug lookup, owner detection, and data load, then formats rows (resolving each account's live profile URL via the platform adapter) and hands a plain view-model to a client component (`IdentityCard`) that owns the 公開/管理 toggle state. Management chips are stubbed no-ops this slice; only 登出/切換帳號 and the share/copy button are functional. A new read-only repo query (`listIdentityAccounts`) does the visibility filtering, main/active/flagged split, ordering, and badge count.

**Tech Stack:** Next.js 16 App Router (React 19, RSC + client components), TypeScript, Prisma (Neon Postgres), Auth.js (next-auth v5), vitest.

**Reference spec:** [`docs/superpowers/specs/2026-06-16-identity-card-public-page-design.md`](../specs/2026-06-16-identity-card-public-page-design.md)

---

## File structure

**New files:**
- `app/gua/[slug]/types.ts` — shared `AccountView` view-model type (imported by page + components).
- `app/gua/[slug]/IdentityCard.tsx` — `"use client"`; header + badge + tab bar + 公開/管理 toggle + account list. Owns toggle state.
- `app/gua/[slug]/AccountRow.tsx` — presentational pill (main / active / flagged / private variants), optional ↗ click-out, stubbed manage chips.
- `app/gua/[slug]/ShareLink.tsx` — `"use client"`; 複製連結 copy-to-clipboard button (mirrors `AddAccountWizard.copy()`).
- `app/gua/[slug]/actions.ts` — `"use server"`; `signOutAction` (→ `/`) and `switchAccountAction` (→ `/login`).

**Modified files:**
- `app/gua/[slug]/page.tsx` — rewrite the stub into the real server-rendered card.
- `lib/identity/repo.ts` — add `listIdentityAccounts` + its `IdentityAccounts` type.
- `lib/binding/platforms/types.ts` — add `profileUrl(handle)` to `PlatformAdapter`.
- `lib/binding/platforms/threads.ts` — implement `profileUrl`.
- `lib/auth/providers.ts` — force Google's account chooser with `prompt: "select_account"`.
- `app/globals.css` — Linktree styles (`.idcard`, `.acct-pill`, etc.).

**New test files:**
- `lib/binding/platforms/threads.test.ts` (create, or add a `describe` block if it already exists).
- `lib/identity/repo.identity-accounts.db.test.ts` — DB-gated, follows the `repo.db.test.ts` skipIf pattern.
- `lib/auth/providers.test.ts`.

---

## Task 1: Platform adapter `profileUrl(handle)`

Adds a pure handle→profile-URL method to the adapter seam so rows can link out to the live platform profile. Threads only today; the interface keeps IG/miin pluggable.

**Files:**
- Modify: `lib/binding/platforms/types.ts`
- Modify: `lib/binding/platforms/threads.ts`
- Test: `lib/binding/platforms/threads.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/binding/platforms/threads.test.ts` (if the file already exists, append this `describe` block and reuse its existing import of `threadsAdapter`):

```ts
import { describe, it, expect } from "vitest";
import { threadsAdapter } from "./threads";

describe("threadsAdapter.profileUrl", () => {
  it("builds the canonical threads.com profile URL from a bare handle", () => {
    expect(threadsAdapter.profileUrl("alice")).toBe(
      "https://www.threads.com/@alice",
    );
  });

  it("does not double-prefix when the stored handle has no @", () => {
    expect(threadsAdapter.profileUrl("bob.dev")).toBe(
      "https://www.threads.com/@bob.dev",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- threads`
Expected: FAIL — `threadsAdapter.profileUrl is not a function` (and a TS error: `profileUrl` not on `PlatformAdapter`).

- [ ] **Step 3: Add `profileUrl` to the interface**

In `lib/binding/platforms/types.ts`, inside the `PlatformAdapter` interface, add the method right after `slugEligible` (before `parsePostUrl`):

```ts
  /** Whether a slug may be minted from a handle proven here. */
  readonly slugEligible: boolean;

  /** Live public profile URL for a stored (bare, no leading @) handle. */
  profileUrl(handle: string): string;

  parsePostUrl(url: string): ParsedPostUrl | null;
```

- [ ] **Step 4: Implement `profileUrl` on the Threads adapter**

In `lib/binding/platforms/threads.ts`, add the method to the exported `threadsAdapter` object (place it next to `parsePostUrl`/`resolvePost`):

```ts
export const threadsAdapter: PlatformAdapter = {
  key: "threads",
  label: "Threads",
  serviceTag: "@gua.si.tw",
  hashtag: null, // Threads uses topics, not pasteable hashtags
  slugEligible: true,
  profileUrl: (handle: string) => `https://www.threads.com/@${handle}`,
  parsePostUrl,
  resolvePost,
  composeIntentUrl: (text: string) =>
    `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- threads`
Expected: PASS (both new cases; existing Threads tests still green).

- [ ] **Step 6: Commit**

```bash
git add lib/binding/platforms/types.ts lib/binding/platforms/threads.ts lib/binding/platforms/threads.test.ts
git commit -m "feat: add profileUrl(handle) to PlatformAdapter + Threads impl"
```

---

## Task 2: `listIdentityAccounts` repo query

The read model for the card: visibility-filtered rows, split into main / active / flagged / private buckets, ordered oldest-verified-first, with a badge count that excludes private and flagged.

**Files:**
- Modify: `lib/identity/repo.ts`
- Test: `lib/identity/repo.identity-accounts.db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/identity/repo.identity-accounts.db.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { listIdentityAccounts } from "./repo";

const hasDb = !!process.env.DATABASE_URL;
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

// Helper: create a 正身 with a set of linked accounts.
async function seedUser(
  shortRef: string,
  accounts: Array<{
    handle: string;
    accountId: string;
    visibility?: "public" | "private";
    condition?: "active" | "banned" | "hacked";
    isMain?: boolean;
    verifiedAt?: Date;
  }>,
) {
  const user = await prisma.user.create({
    data: {
      email: `${shortRef}@example.com`,
      shortRef,
      linkedAccounts: {
        create: accounts.map((a) => ({
          platform: "threads",
          accountId: a.accountId,
          handle: a.handle,
          status: "verified",
          visibility: a.visibility ?? "public",
          condition: a.condition ?? "active",
          isMain: a.isMain ?? false,
          verifiedAt: a.verifiedAt ?? new Date(),
        })),
      },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe.skipIf(!hasDb)("listIdentityAccounts (DB)", () => {
  it("anonymous visitor sees only public+verified; private hidden; flagged last; oldest-first", async () => {
    const user = await seedUser("IdAcctVis01", [
      { handle: "secret", accountId: "secret", visibility: "private" },
      { handle: "newer", accountId: "newer", verifiedAt: new Date("2026-02-01") },
      { handle: "older", accountId: "older", verifiedAt: new Date("2026-01-01") },
      { handle: "main1", accountId: "main1", isMain: true },
      { handle: "hijacked", accountId: "hijacked", condition: "hacked" },
    ]);

    const res = await listIdentityAccounts(user.id, { includePrivate: false });

    expect(res.main?.handle).toBe("main1");
    expect(res.active.map((a) => a.handle)).toEqual(["older", "newer"]); // oldest-first
    expect(res.flagged.map((a) => a.handle)).toEqual(["hijacked"]);
    expect(res.privateAccounts).toEqual([]); // private hidden for visitor
    expect(res.count).toBe(3); // main + 2 active; excludes private + flagged
  });

  it("owner also gets private rows (still excluded from count)", async () => {
    const user = await seedUser("IdAcctOwn01", [
      { handle: "pub", accountId: "pub" },
      { handle: "hidden", accountId: "hidden", visibility: "private" },
    ]);

    const res = await listIdentityAccounts(user.id, { includePrivate: true });

    expect(res.active.map((a) => a.handle)).toEqual(["pub"]);
    expect(res.privateAccounts.map((a) => a.handle)).toEqual(["hidden"]);
    expect(res.count).toBe(1); // private never counts
  });

  it("a flagged main is demoted to flagged, not featured, and not counted", async () => {
    const user = await seedUser("IdAcctFlag1", [
      { handle: "bannedmain", accountId: "bannedmain", isMain: true, condition: "banned" },
      { handle: "good", accountId: "good" },
    ]);

    const res = await listIdentityAccounts(user.id, { includePrivate: false });

    expect(res.main).toBeNull();
    expect(res.flagged.map((a) => a.handle)).toEqual(["bannedmain"]);
    expect(res.active.map((a) => a.handle)).toEqual(["good"]);
    expect(res.count).toBe(1); // only "good"
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- identity-accounts`
Expected: FAIL — `listIdentityAccounts is not exported` / `is not a function`.
(If `DATABASE_URL` is unset the suite is skipped — set it before running, same as the existing `repo.db.test.ts`.)

- [ ] **Step 3: Implement `listIdentityAccounts`**

In `lib/identity/repo.ts`, add the import of the row type and the new function + return type. At the top, ensure `LinkedAccount` is imported from Prisma:

```ts
import type { LinkedAccount } from "@prisma/client";
```

Then append:

```ts
export type IdentityAccounts = {
  /** The active main 分身, featured on top (null if none / main is flagged). */
  main: LinkedAccount | null;
  /** Active non-main 分身, oldest-verified first (most credible). */
  active: LinkedAccount[];
  /** banned/hacked 分身 — rendered last as warning rows, no click-out. */
  flagged: LinkedAccount[];
  /** Owner-only private rows (empty for non-owners), oldest-first. */
  privateAccounts: LinkedAccount[];
  /** Badge count: active public accounts only (excludes private + flagged). */
  count: number;
};

/**
 * Read model for the public Identity Card. Loads a 正身's verified 分身, applies
 * the visibility filter, and splits them into render buckets.
 * Pass `includePrivate: true` only when the viewer is the owner.
 */
export async function listIdentityAccounts(
  userId: string,
  opts: { includePrivate: boolean },
): Promise<IdentityAccounts> {
  const rows = await prisma.linkedAccount.findMany({
    where: {
      userId,
      status: "verified",
      ...(opts.includePrivate ? {} : { visibility: "public" }),
    },
    orderBy: { verifiedAt: "asc" }, // oldest-verified first → most credible (§6.7)
  });

  const publicRows = rows.filter((r) => r.visibility === "public");
  const privateAccounts = rows.filter((r) => r.visibility === "private");

  const main = publicRows.find((r) => r.isMain && r.condition === "active") ?? null;
  const flagged = publicRows.filter((r) => r.condition !== "active");
  const active = publicRows.filter(
    (r) => r.condition === "active" && r.id !== main?.id,
  );
  const count = (main ? 1 : 0) + active.length;

  return { main, active, flagged, privateAccounts, count };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- identity-accounts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add lib/identity/repo.ts lib/identity/repo.identity-accounts.db.test.ts
git commit -m "feat: listIdentityAccounts read model for the Identity Card"
```

---

## Task 3: Force Google's account chooser

Adds `prompt: "select_account"` so signing back in reliably shows Google's account picker (today the bare provider can silently re-pick the same account, blocking the 切換帳號 flow).

**Files:**
- Modify: `lib/auth/providers.ts`
- Test: `lib/auth/providers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/auth/providers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { providers } from "./providers";

describe("auth providers", () => {
  it("forces Google's account chooser with prompt=select_account", () => {
    // Google is the only provider in the MVP.
    const google = providers[0] as { authorization?: { params?: Record<string, string> } };
    expect(google.authorization?.params?.prompt).toBe("select_account");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- providers`
Expected: FAIL — `expected undefined to be "select_account"` (bare provider has no prompt param).

- [ ] **Step 3: Add the authorization param**

Replace the body of `lib/auth/providers.ts`:

```ts
import Google from "next-auth/providers/google";

// MVP: Google is the only login method. Email (magic-link/OTP) is a deferred,
// additive provider — see 2026-06-15-email-login-future-feature.md.
//
// `prompt: "select_account"` forces Google's account chooser on every login so the
// 切換帳號 flow works — without it Google can silently re-pick the last account.
// One Google account = one 正身 (User keyed by unique email).
export const providers = [
  Google({
    authorization: { params: { prompt: "select_account" } },
  }),
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- providers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/providers.ts lib/auth/providers.test.ts
git commit -m "feat: force Google account chooser (prompt=select_account)"
```

---

## Task 4: Linktree styles in `globals.css`

All the CSS the card needs, reusing existing tokens (`--bg`, `--fg`, `--muted`, `--accent`, the `#15151c`/`#2a2a33` surfaces, `0.6rem` radius). Mobile-first, `max-width: 28rem`.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append the Linktree styles**

Add to the end of `app/globals.css`:

```css
/* ── Identity Card (/gua/{slug}) ───────────────────────────────────── */
.idcard {
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.id-header { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; text-align: center; }
.id-avatar { width: 5rem; height: 5rem; border-radius: 50%; object-fit: cover; background: #15151c; border: 1px solid #2a2a33; }
.id-name { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: 0.03em; }
.id-bio { margin: 0; font-size: 0.9rem; line-height: 1.6; color: var(--muted); max-width: 22rem; }
.id-badge {
  display: inline-block; padding: 0.25rem 0.7rem;
  font-size: 0.8rem; letter-spacing: 0.08em; color: #1a1500;
  background: var(--accent); border-radius: 999px; font-weight: 700;
}

.id-toggle { display: flex; gap: 0; align-self: center; border: 1px solid #2a2a33; border-radius: 999px; overflow: hidden; }
.id-toggle button {
  padding: 0.4rem 1rem; background: transparent; border: none; color: var(--muted);
  font: inherit; font-size: 0.85rem; cursor: pointer;
}
.id-toggle button.active { background: #15151c; color: var(--fg); }

.tabbar { display: flex; gap: 0; border-bottom: 1px solid #2a2a33; }
.tabbar .tab {
  flex: 1; padding: 0.7rem 0; background: transparent; border: none;
  border-bottom: 2px solid transparent; color: var(--muted);
  font: inherit; font-size: 0.95rem; cursor: pointer; text-align: center;
}
.tabbar .tab.active { color: var(--fg); border-bottom-color: var(--accent); }

.acct-list { display: flex; flex-direction: column; gap: 0.6rem; }
.acct-pill {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.85rem 1rem; background: #15151c; border: 1px solid #2a2a33;
  border-radius: 0.6rem; color: var(--fg); text-decoration: none;
}
a.acct-pill:hover { border-color: var(--accent); }
.acct-pill.main { border-color: var(--accent); background: #1a160b; }
.acct-pill.flag { opacity: 0.85; border-style: dashed; border-color: #3a2f10; }
.acct-pill.priv { border-style: dashed; }
.acct-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.acct-id { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.acct-handle { font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
.acct-meta { font-size: 0.78rem; color: var(--muted); }
.acct-out { color: var(--accent); font-size: 1rem; flex-shrink: 0; }
.acct-warn { font-size: 0.78rem; color: var(--accent); }

.acct-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip {
  padding: 0.3rem 0.65rem; font-size: 0.75rem; background: transparent;
  border: 1px solid #34343f; border-radius: 0.5rem; color: var(--fg);
  font: inherit; cursor: pointer;
}
.chip:hover { border-color: var(--accent); }

.id-manage-links { display: flex; flex-direction: column; gap: 0.6rem; padding-top: 0.5rem; }
.id-foot { display: flex; flex-direction: column; gap: 0.75rem; align-items: center; padding-top: 1rem; text-align: center; }
.id-foot a { color: var(--accent); }
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: Linktree (Identity Card) styles in globals.css"
```

---

## Task 5: View-model type + server actions

The shared `AccountView` type the page builds and the components consume, plus the two functional manage-view server actions.

**Files:**
- Create: `app/gua/[slug]/types.ts`
- Create: `app/gua/[slug]/actions.ts`

- [ ] **Step 1: Create the view-model type**

Create `app/gua/[slug]/types.ts`:

```ts
export type AccountVariant = "main" | "active" | "flagged" | "private";

/** Plain, serialisable row the server hands to the client card. */
export type AccountView = {
  id: string;
  handle: string;
  /** Pre-formatted YYYY-MM-DD verification date. */
  verifiedAt: string;
  /** Live platform profile URL, or null when the row is flagged (no click-out). */
  profileUrl: string | null;
  variant: AccountVariant;
  flagged: boolean;
};

/** The four render buckets for the card. */
export type AccountGroups = {
  main: AccountView | null;
  active: AccountView[];
  flagged: AccountView[];
  private: AccountView[];
};
```

- [ ] **Step 2: Create the server actions**

Create `app/gua/[slug]/actions.ts`:

```ts
"use server";

import { signOut } from "@/lib/auth";

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
```

- [ ] **Step 3: Commit**

```bash
git add app/gua/[slug]/types.ts app/gua/[slug]/actions.ts
git commit -m "feat: AccountView view-model + Identity Card server actions"
```

---

## Task 6: `AccountRow` presentational component

The pill: handle, `驗證於 {date}`, ↗ click-out (active rows), warning text (flagged), and optional stubbed manage chips.

**Files:**
- Create: `app/gua/[slug]/AccountRow.tsx`

- [ ] **Step 1: Create the component**

Create `app/gua/[slug]/AccountRow.tsx`:

```tsx
import type { AccountView } from "./types";

const VARIANT_CLASS: Record<AccountView["variant"], string> = {
  main: "acct-pill main",
  active: "acct-pill",
  flagged: "acct-pill flag",
  private: "acct-pill priv",
};

/** Stubbed (no-op) management chips — look final; Slice 5 wires them. */
function ManageChips({ account }: { account: AccountView }) {
  return (
    <div className="acct-actions">
      <button type="button" className="chip" disabled>
        {account.variant === "private" ? "🔒 設為公開（永久）" : "🔒 已公開（永久）"}
      </button>
      {!account.flagged && account.variant !== "main" && (
        <button type="button" className="chip" disabled>★ 設為主要</button>
      )}
      {account.flagged ? (
        <button type="button" className="chip" disabled>恢復 · 重新驗證 →</button>
      ) : (
        <button type="button" className="chip" disabled>回報遭盜用 / 停權</button>
      )}
    </div>
  );
}

export function AccountRow({
  account,
  manage = false,
}: {
  account: AccountView;
  manage?: boolean;
}) {
  const inner = (
    <>
      <div className="acct-row">
        <div className="acct-id">
          <span className="acct-handle">@{account.handle}</span>
          <span className="acct-meta">驗證於 {account.verifiedAt}</span>
        </div>
        {account.profileUrl && !manage && <span className="acct-out" aria-hidden>↗</span>}
      </div>
      {account.flagged && (
        <p className="acct-warn">⚠ 已回報遭盜用 · 此帳號已非本人</p>
      )}
      {manage && <ManageChips account={account} />}
    </>
  );

  // Public view: active rows are a click-out link; flagged rows are inert.
  if (!manage && account.profileUrl) {
    return (
      <a
        className={VARIANT_CLASS[account.variant]}
        href={account.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  return <div className={VARIANT_CLASS[account.variant]}>{inner}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/gua/[slug]/AccountRow.tsx
git commit -m "feat: AccountRow pill (main/active/flagged/private + stubbed chips)"
```

---

## Task 7: `ShareLink` copy button

複製連結 button that copies the full `guasi.tw/gua/{slug}` URL, mirroring `AddAccountWizard.copy()`'s clipboard-then-select fallback.

**Files:**
- Create: `app/gua/[slug]/ShareLink.tsx`

- [ ] **Step 1: Create the component**

Create `app/gua/[slug]/ShareLink.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const urlRef = useRef<HTMLSpanElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable → select the text so the user can copy manually
      setCopyFailed(true);
      const el = urlRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="acct-actions" style={{ justifyContent: "center" }}>
      <button type="button" className="chip" onClick={copy}>
        {copied ? "已複製 ✓" : "複製連結"}
      </button>
      {copyFailed && (
        <span ref={urlRef} className="acct-meta">{url}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/gua/[slug]/ShareLink.tsx
git commit -m "feat: ShareLink 複製連結 copy button"
```

---

## Task 8: `IdentityCard` client component

Header + badge + 公開/管理 toggle (owner-only) + 帳號/時間軸 tab bar + account list + manage controls + growth footer.

**Files:**
- Create: `app/gua/[slug]/IdentityCard.tsx`

- [ ] **Step 1: Create the component**

Create `app/gua/[slug]/IdentityCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { AccountGroups } from "./types";
import { AccountRow } from "./AccountRow";
import { ShareLink } from "./ShareLink";
import { signOutAction, switchAccountAction } from "./actions";

type Props = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  count: number;
  isOwner: boolean;
  publicUrl: string;
  viewerLoggedIn: boolean;
  ownerHomeUrl: string | null;
  accounts: AccountGroups;
};

export function IdentityCard({
  displayName,
  bio,
  avatarUrl,
  count,
  isOwner,
  publicUrl,
  viewerLoggedIn,
  ownerHomeUrl,
  accounts,
}: Props) {
  const [mode, setMode] = useState<"public" | "manage">("public");
  const [tab, setTab] = useState<"accounts" | "timeline">("accounts");
  const manage = isOwner && mode === "manage";

  return (
    <main className="idcard">
      <header className="id-header">
        {avatarUrl && <img className="id-avatar" src={avatarUrl} alt="" />}
        <h1 className="id-name">{displayName}</h1>
        {bio && <p className="id-bio">{bio}</p>}
        <span className="id-badge">{count} 個分身</span>
        {isOwner && (
          <div className="id-toggle">
            <button
              type="button"
              className={mode === "public" ? "active" : ""}
              onClick={() => setMode("public")}
            >
              公開檢視
            </button>
            <button
              type="button"
              className={mode === "manage" ? "active" : ""}
              onClick={() => setMode("manage")}
            >
              管理檢視
            </button>
          </div>
        )}
      </header>

      <nav className="tabbar">
        <button
          type="button"
          className={tab === "accounts" ? "tab active" : "tab"}
          onClick={() => setTab("accounts")}
        >
          帳號
        </button>
        <button
          type="button"
          className={tab === "timeline" ? "tab active" : "tab"}
          onClick={() => setTab("timeline")}
        >
          時間軸
        </button>
      </nav>

      {tab === "timeline" ? (
        <p className="id-bio" style={{ textAlign: "center" }}>時間軸施工中（Slice 4）。</p>
      ) : (
        <>
          <div className="acct-list">
            {accounts.main && <AccountRow account={accounts.main} manage={manage} />}
            {accounts.active.map((a) => (
              <AccountRow key={a.id} account={a} manage={manage} />
            ))}
            {manage &&
              accounts.private.map((a) => (
                <AccountRow key={a.id} account={a} manage />
              ))}
            {accounts.flagged.map((a) => (
              <AccountRow key={a.id} account={a} manage={manage} />
            ))}
          </div>

          {manage && (
            <div className="id-manage-links">
              <a className="btn-secondary" href="/add">＋ 註冊分身</a>
              <button type="button" className="btn-secondary" disabled>編輯個人資料</button>
              <form action={signOutAction}>
                <button type="submit" className="btn-secondary" style={{ width: "100%" }}>登出</button>
              </form>
              <form action={switchAccountAction}>
                <button type="submit" className="btn-secondary" style={{ width: "100%" }}>切換帳號</button>
              </form>
            </div>
          )}
        </>
      )}

      <footer className="id-foot">
        <ShareLink url={publicUrl} />
        {viewerLoggedIn ? (
          <a href={ownerHomeUrl ?? "/"}>前往你的正身 →</a>
        ) : (
          <a href="/login">建立你的正身 →</a>
        )}
      </footer>
    </main>
  );
}
```

> Note on `編輯個人資料`: rendered as a disabled stub this slice (the profile-edit flow isn't built yet — consistent with the other stubbed manage controls). `＋ 註冊分身` → `/add` is real navigation. Wire 編輯個人資料 when the edit route ships (Slice 5 or the profile-edit task).

- [ ] **Step 2: Commit**

```bash
git add app/gua/[slug]/IdentityCard.tsx
git commit -m "feat: IdentityCard client component (公開/管理 toggle + tabs)"
```

---

## Task 9: Rewrite `page.tsx` (server)

Wire it all together: lookup → 404, owner detection, data load, row formatting (date + adapter profile URL), and render `IdentityCard`.

**Files:**
- Modify: `app/gua/[slug]/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the full contents of `app/gua/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { findUserBySlug, listIdentityAccounts } from "@/lib/identity/repo";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { IdentityCard } from "./IdentityCard";
import type { AccountVariant, AccountView } from "./types";
import type { LinkedAccount } from "@prisma/client";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toView(a: LinkedAccount, variant: AccountVariant): AccountView {
  const adapter = getAdapter(a.platform);
  const clickable = a.condition === "active";
  return {
    id: a.id,
    handle: a.handle,
    verifiedAt: fmtDate(a.verifiedAt),
    profileUrl: clickable ? adapter?.profileUrl(a.handle) ?? null : null,
    variant,
    flagged: a.condition !== "active",
  };
}

export default async function IdentityCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Case-insensitive lookup via the citext slug column
  const user = await findUserBySlug(slug);
  if (!user) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === user.id;

  const data = await listIdentityAccounts(user.id, { includePrivate: isOwner });

  const accounts = {
    main: data.main ? toView(data.main, "main") : null,
    active: data.active.map((a) => toView(a, "active")),
    flagged: data.flagged.map((a) => toView(a, "flagged")),
    private: data.privateAccounts.map((a) => toView(a, "private")),
  };

  // Growth footer destination for a logged-in viewer → their own page.
  const ownerHomeUrl = viewer
    ? viewer.slug
      ? `/gua/${viewer.slug}`
      : `/r/${viewer.shortRef}`
    : null;

  return (
    <IdentityCard
      displayName={user.displayName ?? slug}
      bio={user.bio}
      avatarUrl={user.avatarUrl}
      count={data.count}
      isOwner={isOwner}
      publicUrl={`${SITE_ORIGIN}/gua/${slug}`}
      viewerLoggedIn={!!viewer}
      ownerHomeUrl={ownerHomeUrl}
      accounts={accounts}
    />
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit`
Expected: clean (no type errors).

Run: `npm run build`
Expected: build succeeds; `/gua/[slug]` compiles as a dynamic route.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all green (Tasks 1–3 tests + existing suite).

- [ ] **Step 4: Commit**

```bash
git add app/gua/[slug]/page.tsx
git commit -m "feat: render the real Identity Card at /gua/{slug}"
```

---

## Task 10: Manual verification on preview

No new automated coverage — exercise the live flows on a Vercel preview deploy. Push the branch / open the PR so a preview URL is created, then walk the checklist.

**Files:** none (verification only).

- [ ] **Step 1: Push + open PR for a preview deploy**

```bash
git push -u origin HEAD
gh pr create --fill
```

- [ ] **Step 2: Walk the manual checklist on the preview URL**

Against `/{preview}/gua/{slug}` for a 正身 that has ≥1 verified Threads 分身:

1. **Logged-out public view:** header (avatar/name/bio), `N 個分身` badge, ★主要 featured on top, active rows oldest-first, flagged rows last with `⚠ 已回報遭盜用 · 此帳號已非本人`, private rows NOT shown, 時間軸 tab shows `時間軸施工中（Slice 4）`, `複製連結` copies `guasi.tw/gua/{slug}`.
2. **Click-out:** an active row opens `https://www.threads.com/@{handle}` in a new tab; a flagged row is not a link.
3. **Owner logged-in:** 公開/管理 toggle appears, defaults to 公開檢視; switching to 管理檢視 shows private rows (dashed) + stubbed chips + `＋ 註冊分身` (→ `/add`) and a disabled `編輯個人資料`; chips are no-ops.
4. **Non-owner logged-in:** no toggle, no manage view.
5. **Growth footer:** logged-out → `建立你的正身 →` (`/login`); logged-in → `前往你的正身 →` to own `/gua/{slug}` (or `/r/{shortRef}` if no slug yet).
6. **Manage controls:** `登出` returns to Home logged-out; `切換帳號` → `/login` → Google chooser appears (the `select_account` prompt) → signing in as a different Google account lands in that account's 正身.

- [ ] **Step 3: Note any defects**

If any step fails, fix in a follow-up commit on the same branch and re-verify. Record the outcome in the session log of the design spec.

---

## Task 11: Docs — devlog, todo, tag

**Files:**
- Modify: `docs/devlog.md`
- Modify: `todo.md`
- Modify: `docs/superpowers/specs/2026-06-16-identity-card-public-page-design.md` (session log)

- [ ] **Step 1: Add the devlog v0.12.0 entry**

In `docs/devlog.md`, add a new top entry (newest-first) and a TL;DR table row, following the project's devlog format (heading `## v0.12.0 — Identity Card public page (Slice 3) (YYYY-MM-DD HH:MM)` using the final commit's git timestamp). Include:
- `**Review:** not yet`
- `**Design docs:**` bullet linking the spec: `Identity Card public page: [Spec](superpowers/specs/2026-06-16-identity-card-public-page-design.md) [Plan](superpowers/plans/2026-06-17-identity-card-public-page.md)`
- `**What was built:**` — the real `/gua/{slug}` Linktree, 公開/管理 toggle, `listIdentityAccounts` read model, adapter `profileUrl`, Google `select_account`, share button, 時間軸 placeholder.
- `**Key technical learnings:**` tagged bullets — e.g. `[insight]` server formats rows + resolves adapter URLs so the client card stays a dumb view; `[note]` flagged-main demotion rule in the read model; `[gotcha]` `prompt: "select_account"` is required for account switching to work.

- [ ] **Step 2: Check off Slice 3 in `todo.md`**

Mark the Slice 3 / public Identity Card item done.

- [ ] **Step 3: Append a session-log entry to the design spec**

In `docs/superpowers/specs/2026-06-16-identity-card-public-page-design.md` under `## Session log`, add a dated entry summarizing what shipped and the manual-verification outcome. Tick the build-checklist boxes that are now complete.

- [ ] **Step 4: Commit + tag**

```bash
git add docs/devlog.md todo.md docs/superpowers/specs/2026-06-16-identity-card-public-page-design.md
git commit -m "docs: devlog v0.12.0 — Identity Card public page (Slice 3)"
git tag v0.12.0
```

> Tag `v0.12.0` after the PR squash-merges to `main` if the project tags releases on `main` (confirm against the devlog/tag convention before tagging the branch).

---

## Self-review notes (spec coverage)

- **Decision 1 (管理 as toggle, not a 3rd tab):** Task 8 — `id-toggle` 公開/管理 segmented control; tabs are 帳號/時間軸 only. ✓
- **Decision 2 (flagged stay public, sink to bottom):** Task 2 ordering (flagged bucket last) + Task 8 render order. ✓
- **Decision 3 (no OG metadata; 複製連結 instead):** Task 7 `ShareLink`. ✓ (no `generateMetadata`.)
- **Decision 4 (badge = active public only):** Task 2 `count`. ✓ Test covers private + flagged exclusion.
- **Owner detection + private gating:** Task 9 `isOwner` + `includePrivate`. ✓
- **`profileUrl` click-out:** Tasks 1, 6, 9. ✓
- **Functional 登出/切換帳號 + Google `select_account`:** Tasks 3, 5, 8. ✓
- **時間軸 placeholder:** Task 8. ✓
- **Growth footer (viewer-aware):** Tasks 8, 9. ✓
- **Styling:** Task 4. ✓
- **編輯個人資料:** rendered as a disabled stub (route not yet built) — noted in Task 8; deferred wiring flagged. (Minor deviation from spec's "navigation" wording, justified because the destination route doesn't exist yet.)
