# Slice 4 — Timeline tab (時間軸) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `時間軸施工中（Slice 4）` placeholder in the Identity Card with a real, leak-proof render of the append-only `BindingEvent` ledger (oldest-first, synthetic 建立正身 genesis row at top).

**Architecture:** A read model (`listTimelineEvents`) joins `BindingEvent` → `LinkedAccount` → `ProofRecord` in application code (no Prisma relations exist between them), applying the per-account current-visibility leak filter. A view-builder (`buildTimeline`) maps that to a plain serialisable `TimelineView[]` the way `buildAccountGroups` does for accounts. A dumb presentational `TimelineList` client component renders the vertical rail. Both `/gua/[slug]` and `/r/[shortRef]` pages build and pass the `timeline` prop. **Read-rendering + 繁中 copy only — no schema change, no migration.**

**Tech Stack:** Next 16 App Router · React 19 · TypeScript · Prisma (Neon Postgres) · Vitest · CSS in `app/globals.css`.

**Spec:** [`docs/superpowers/specs/2026-06-18-timeline-tab-design.md`](../specs/2026-06-18-timeline-tab-design.md). The PlatformIcon brand-coloring (decision 6) **already shipped as `v0.14.1`** — this plan only *consumes* `PlatformIcon`, never re-implements it.

**Conventions to match (read these files before starting):**
- Read model parallels [`lib/identity/repo.ts`](../../../lib/identity/repo.ts) `listIdentityAccounts` (the `includePrivate` pattern).
- View-builder parallels [`app/(site)/gua/[slug]/accounts.ts`](../../../app/(site)/gua/[slug]/accounts.ts) (`fmtDate`, `getAdapter`, plain serialisable views).
- Presentational component parallels [`app/(site)/gua/[slug]/AccountRow.tsx`](../../../app/(site)/gua/[slug]/AccountRow.tsx) (no `"use client"` directive; imported by the already-client `IdentityCard`).
- DB tests parallel [`lib/identity/repo.identity-accounts.db.test.ts`](../../../lib/identity/repo.identity-accounts.db.test.ts) (`describe.skipIf(!hasDb)`, `seedUser`, `afterAll` cleanup).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/identity/timeline.ts` | Create | `listTimelineEvents(userId, { includePrivate })` read model + `TimelineEntry` type. The leak-proof join. |
| `lib/identity/timeline.db.test.ts` | Create | DB tests for the read model (visibility filter, disclosure history, proof attach, order, defensive skip). |
| `app/(site)/gua/[slug]/timeline.ts` | Create | `buildTimeline(userId, isOwner)` view-builder + `TimelineView` type. Maps entries → serialisable view (date string + platform label). |
| `app/(site)/gua/[slug]/TimelineList.tsx` | Create | Dumb presentational vertical-rail component. Props in → JSX out. Client-side mode filter. |
| `app/globals.css` | Modify | Add `--danger` token + `.timeline` / `.tl-*` / `.dot` block. |
| `app/(site)/gua/[slug]/IdentityCard.tsx` | Modify | Add `timeline` prop; replace the placeholder with `<TimelineList>`. |
| `app/(site)/gua/[slug]/page.tsx` | Modify | Build + pass `timeline`. |
| `app/(site)/r/[shortRef]/page.tsx` | Modify | Build + pass `timeline`. |
| `app/(site)/gua/[slug]/page.test.ts` | Modify | Mock `./timeline`; assert the `timeline` prop is passed. |
| `app/(site)/r/[shortRef]/page.test.ts` | Modify | Mock `@/app/(site)/gua/[slug]/timeline` so the suite stays green. |

**Note on CSS tokens:** the spec lists `--line #2a2a33` as a token, but `:root` defines only `--bg --fg --muted --accent`; existing rules use the literal `#2a2a33`. This plan follows the existing code and uses the literal `#2a2a33`, introducing **only** `--danger` as a new token.

---

## Task 1: `listTimelineEvents` read model (the leak-proof join)

**Files:**
- Create: `lib/identity/timeline.ts`
- Test: `lib/identity/timeline.db.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/identity/timeline.db.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { listTimelineEvents } from "./timeline";

const hasDb = !!process.env.DATABASE_URL;
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

type EventSeed = {
  eventType:
    | "bound" | "disclosed" | "set_main"
    | "reported_banned" | "reported_hacked" | "re_verified" | "unbound";
  accountId: string;
  createdAt: Date;
  proofPostUrl?: string; // creates a ProofRecord and links it
};

type AccountSeed = {
  accountId: string;
  handle: string;
  visibility?: "public" | "private";
};

// Seed a 正身 with linked accounts + binding events (+ optional proof records).
async function seedUser(
  shortRef: string,
  accounts: AccountSeed[],
  events: EventSeed[],
  onboardedAt?: Date,
) {
  const user = await prisma.user.create({
    data: {
      email: `${shortRef}@example.com`,
      shortRef,
      onboardedAt: onboardedAt ?? null,
      linkedAccounts: {
        create: accounts.map((a) => ({
          platform: "threads",
          accountId: a.accountId,
          handle: a.handle,
          status: "verified",
          visibility: a.visibility ?? "public",
        })),
      },
    },
  });
  createdUserIds.push(user.id);

  for (const e of events) {
    let proofRecordId: string | undefined;
    if (e.proofPostUrl) {
      const la = await prisma.linkedAccount.findFirst({
        where: { userId: user.id, accountId: e.accountId },
      });
      const proof = await prisma.proofRecord.create({
        data: {
          linkedAccountId: la!.id,
          proofPostUrl: e.proofPostUrl,
          authCode: "000000",
          authorHandle: e.accountId,
        },
      });
      proofRecordId = proof.id;
    }
    await prisma.bindingEvent.create({
      data: {
        userId: user.id,
        platform: "threads",
        accountId: e.accountId,
        eventType: e.eventType,
        proofRecordId: proofRecordId ?? null,
        createdAt: e.createdAt,
      },
    });
  }
  return user;
}

describe.skipIf(!hasDb)("listTimelineEvents (DB)", () => {
  it("non-owner: private-account events absent; genesis + public events only", async () => {
    const user = await seedUser(
      "TlVis01",
      [
        { accountId: "pub", handle: "pub", visibility: "public" },
        { accountId: "sec", handle: "sec", visibility: "private" },
      ],
      [
        { eventType: "bound", accountId: "pub", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/pub" },
        { eventType: "bound", accountId: "sec", createdAt: new Date("2026-02-02"), proofPostUrl: "https://t/sec" },
      ],
      new Date("2026-01-01"),
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });

    expect(res.map((e) => e.kind)).toEqual(["genesis", "bound"]);
    expect(res.find((e) => e.handle === "sec")).toBeUndefined();
    expect(res[0].kind).toBe("genesis");
    expect(res[1].handle).toBe("pub");
  });

  it("owner (includePrivate): private events present and flagged isPrivate", async () => {
    const user = await seedUser(
      "TlOwn01",
      [
        { accountId: "pub", handle: "pub", visibility: "public" },
        { accountId: "sec", handle: "sec", visibility: "private" },
      ],
      [
        { eventType: "bound", accountId: "pub", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/pub" },
        { eventType: "bound", accountId: "sec", createdAt: new Date("2026-02-02"), proofPostUrl: "https://t/sec" },
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: true });

    const sec = res.find((e) => e.handle === "sec");
    expect(sec?.isPrivate).toBe(true);
    const pub = res.find((e) => e.handle === "pub");
    expect(pub?.isPrivate).toBe(false);
  });

  it("disclosure history: a bound-private-then-disclosed account shows its bound event once public", async () => {
    const user = await seedUser(
      "TlDisc01",
      [{ accountId: "later", handle: "later", visibility: "public" }], // currently public
      [
        { eventType: "bound", accountId: "later", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/l" },
        { eventType: "disclosed", accountId: "later", createdAt: new Date("2026-03-01") },
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });

    // The whole history surfaces because the account is public NOW.
    expect(res.map((e) => e.kind)).toEqual(["genesis", "bound", "disclosed"]);
  });

  it("proofPostUrl attached on bound/re_verified only; null elsewhere", async () => {
    const user = await seedUser(
      "TlProof01",
      [{ accountId: "a", handle: "a", visibility: "public" }],
      [
        { eventType: "bound", accountId: "a", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/b" },
        { eventType: "set_main", accountId: "a", createdAt: new Date("2026-02-02") },
        { eventType: "re_verified", accountId: "a", createdAt: new Date("2026-02-03"), proofPostUrl: "https://t/r" },
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });
    const byKind = Object.fromEntries(res.map((e) => [e.kind, e]));
    expect(byKind.bound.proofPostUrl).toBe("https://t/b");
    expect(byKind.re_verified.proofPostUrl).toBe("https://t/r");
    expect(byKind.set_main.proofPostUrl).toBeNull();
  });

  it("order createdAt asc, genesis first; genesis date = onboardedAt ?? createdAt", async () => {
    const onboarded = new Date("2026-01-15T00:00:00.000Z");
    const user = await seedUser(
      "TlOrder01",
      [{ accountId: "a", handle: "a", visibility: "public" }],
      [
        { eventType: "bound", accountId: "a", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/b" },
        { eventType: "set_main", accountId: "a", createdAt: new Date("2026-03-01") },
      ],
      onboarded,
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });
    expect(res[0].kind).toBe("genesis");
    expect(res[0].createdAt.getTime()).toBe(onboarded.getTime());
    expect(res.slice(1).map((e) => e.kind)).toEqual(["bound", "set_main"]);
  });

  it("defensive: an event whose account is missing is skipped", async () => {
    const user = await seedUser(
      "TlMiss01",
      [{ accountId: "a", handle: "a", visibility: "public" }],
      [
        { eventType: "bound", accountId: "a", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/b" },
        { eventType: "set_main", accountId: "ghost", createdAt: new Date("2026-02-02") }, // no such account
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });
    expect(res.map((e) => e.kind)).toEqual(["genesis", "bound"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/identity/timeline.db.test.ts`
Expected: FAIL — `listTimelineEvents` is not exported / module not found. (If `DATABASE_URL` is unset the suite is **skipped**, not failing — see Step 5 note.)

- [ ] **Step 3: Write the implementation**

Create `lib/identity/timeline.ts`:

```ts
import { prisma } from "@/lib/db/client";
import type { BindingEventType } from "@prisma/client";

/** A timeline row before view-formatting. Genesis is synthetic (kind "genesis"). */
export type TimelineEntry = {
  /** Event id, or "genesis" for the synthetic 建立正身 anchor. */
  id: string;
  kind: BindingEventType | "genesis";
  createdAt: Date;
  /** Platform key (drives the icon); null for genesis. */
  platform: string | null;
  /** null for genesis. */
  handle: string | null;
  /** Set only when the event carries a ProofRecord (bound / re_verified); null otherwise. */
  proofPostUrl: string | null;
  /** The account is currently private (owner view only; always false for genesis). */
  isPrivate: boolean;
};

/**
 * Read model for the Identity Card timeline. Joins BindingEvent → LinkedAccount →
 * ProofRecord in application code (no Prisma relations between them) and applies the
 * per-account current-visibility leak filter. Pass `includePrivate: true` only for the owner.
 *
 * Leak defense (decision 1): an event is shown publicly iff its account is `public` RIGHT NOW.
 * A disclosed account's entire history (incl. the while-private `bound`) appears at once.
 */
export async function listTimelineEvents(
  userId: string,
  opts: { includePrivate: boolean },
): Promise<TimelineEntry[]> {
  // 1. The user (for the genesis anchor) + their accounts (to resolve each event).
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardedAt: true, createdAt: true },
    }),
    prisma.linkedAccount.findMany({
      where: { userId },
      select: { platform: true, accountId: true, handle: true, visibility: true },
    }),
  ]);

  const acctByKey = new Map(
    accounts.map((a) => [`${a.platform}:${a.accountId}`, a]),
  );

  // 2. Events oldest-first (index [userId, createdAt] already exists).
  const events = await prisma.bindingEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  // 3. Resolve + filter.
  const resolved = events
    .map((e) => ({ e, acct: acctByKey.get(`${e.platform}:${e.accountId}`) }))
    .filter(({ acct }) => acct !== undefined) // defensive: skip orphan events
    .filter(({ acct }) => opts.includePrivate || acct!.visibility === "public");

  // 4. Batch-fetch proof URLs for the events that carry one.
  const proofIds = resolved
    .map(({ e }) => e.proofRecordId)
    .filter((id): id is string => id !== null);
  const proofs = proofIds.length
    ? await prisma.proofRecord.findMany({
        where: { id: { in: proofIds } },
        select: { id: true, proofPostUrl: true },
      })
    : [];
  const proofUrlById = new Map(proofs.map((p) => [p.id, p.proofPostUrl]));

  const eventEntries: TimelineEntry[] = resolved.map(({ e, acct }) => ({
    id: e.id,
    kind: e.eventType,
    createdAt: e.createdAt,
    platform: acct!.platform,
    handle: acct!.handle,
    proofPostUrl: e.proofRecordId ? proofUrlById.get(e.proofRecordId) ?? null : null,
    isPrivate: acct!.visibility !== "public",
  }));

  // 5. Prepend the synthetic genesis anchor (onboardedAt ?? createdAt; never private).
  const genesis: TimelineEntry = {
    id: "genesis",
    kind: "genesis",
    createdAt: user?.onboardedAt ?? user?.createdAt ?? new Date(0),
    platform: null,
    handle: null,
    proofPostUrl: null,
    isPrivate: false,
  };

  return [genesis, ...eventEntries];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/identity/timeline.db.test.ts`
Expected: PASS (all 6), or **skipped** if `DATABASE_URL` is unset.

- [ ] **Step 5: Verify against a database**

If `DATABASE_URL` is set in `.env`, the suite runs for real. If your local shell doesn't load it, run with it:
Run: `DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\"')" npx vitest run lib/identity/timeline.db.test.ts`
Expected: 6 passed, 0 skipped. If it reports "skipped", the env var didn't reach vitest — fix that before claiming the read model works.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/identity/timeline.ts lib/identity/timeline.db.test.ts
git commit -m "feat(timeline): leak-proof listTimelineEvents read model"
```

---

## Task 2: `buildTimeline` view-builder + `TimelineView` type

**Files:**
- Create: `app/(site)/gua/[slug]/timeline.ts`

- [ ] **Step 1: Write the implementation**

This mirrors `accounts.ts` (`fmtDate`, `getAdapter`). There is no separate unit test — it's a thin mapper exercised by the page test (Task 6) and the DB-backed read model (Task 1). Create `app/(site)/gua/[slug]/timeline.ts`:

```ts
import { listTimelineEvents } from "@/lib/identity/timeline";
import { getAdapter } from "@/lib/binding/platforms";
import type { BindingEventType } from "@prisma/client";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD — matches accounts.ts
}

/** Plain, serialisable timeline row the server hands to the client card. */
export type TimelineView = {
  /** Event id, or "genesis". */
  id: string;
  /** Pre-formatted YYYY-MM-DD. */
  date: string;
  kind: BindingEventType | "genesis";
  /** null for genesis. */
  handle: string | null;
  /** Platform key → PlatformIcon; null for genesis. */
  platform: string | null;
  /** adapter.label; null for genesis. */
  platformLabel: string | null;
  /** Set only on bound / re_verified. */
  proofPostUrl: string | null;
  /** Account currently private (owner view only; always false for genesis). */
  isPrivate: boolean;
};

/**
 * Build the serialisable timeline for the Identity Card. Owner (`isOwner`) gets the full
 * list (private entries flagged `isPrivate`); non-owners never receive private entries
 * from the server (defense in depth) — see listTimelineEvents.
 */
export async function buildTimeline(
  userId: string,
  isOwner: boolean,
): Promise<TimelineView[]> {
  const entries = await listTimelineEvents(userId, { includePrivate: isOwner });
  return entries.map((e) => {
    const adapter = e.platform ? getAdapter(e.platform) : null;
    const hasProof = e.kind === "bound" || e.kind === "re_verified";
    return {
      id: e.id,
      date: fmtDate(e.createdAt),
      kind: e.kind,
      handle: e.handle,
      platform: e.platform,
      platformLabel: e.platform ? adapter?.label ?? e.platform : null,
      proofPostUrl: hasProof ? e.proofPostUrl : null,
      isPrivate: e.isPrivate,
    };
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/(site)/gua/[slug]/timeline.ts"
git commit -m "feat(timeline): buildTimeline view-builder + TimelineView type"
```

---

## Task 3: Timeline CSS (`--danger` token + `.timeline` / `.tl-*` block)

**Files:**
- Modify: `app/globals.css` — add `--danger` to `:root` (line 6 area); append the timeline block after the `.acct-*` rules (after line 444 `.acct-warn`).

- [ ] **Step 1: Add the `--danger` token**

In `app/globals.css`, change the `:root` block:

```css
:root {
  color-scheme: dark;
  --bg: #0b0b0f;
  --fg: #f5f5f7;
  --muted: #8a8a94;
  --accent: #e8b500;
  --danger: #f0484f;
}
```

- [ ] **Step 2: Append the timeline block**

Add immediately after the `.acct-warn { ... }` rule (line 444):

```css
/* --- Timeline tab (Slice 4) — vertical rail + dots, oldest-first. --- */
.timeline {
  list-style: none; margin: 0; padding: 0 0 0 1rem;
  display: flex; flex-direction: column; gap: 1.1rem;
  border-left: 1px solid #2a2a33;
}
.tl-empty { font-size: 0.85rem; color: var(--muted); text-align: center; }
.tl-item { position: relative; }
.tl-item .dot {
  position: absolute; left: calc(-1rem - 5px); top: 0.2rem;
  width: 9px; height: 9px; border-radius: 999px; background: var(--muted);
}
.tl-item.genesis .dot, .tl-item.proof .dot { background: var(--accent); }
.tl-item.flag .dot { background: var(--danger); }
.tl-item.priv .dot { background: transparent; border: 1px solid var(--muted); }
.tl-body { display: flex; flex-direction: column; gap: 0.18rem; min-width: 0; }
.tl-date { font-size: 0.72rem; color: var(--muted); }
.tl-action { font-size: 0.85rem; font-weight: 600; color: var(--muted); }
.tl-item.genesis .tl-action { font-size: 1rem; color: var(--accent); }
.tl-item.flag .tl-action { color: var(--danger); font-weight: 800; }
.tl-acct { display: flex; align-items: center; gap: 0.4rem; font-size: 1.05rem; min-width: 0; }
.tl-acct .hd { font-weight: 800; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-acct .pl { font-size: 0.92rem; color: var(--muted); }
.tl-item.flag .tl-acct .hd { color: #f7a3a7; }
.tl-proof { font-size: 0.82rem; color: var(--accent); text-decoration: none; }
.tl-proof:hover { text-decoration: underline; }
.tl-priv-tag {
  font-size: 0.7rem; color: var(--muted);
  border: 1px dashed #34343f; border-radius: 999px; padding: 0.05rem 0.45rem;
}
/* Flag rows: alarming red wash + left border. Must read as "compromised account". */
.tl-item.flag {
  border-left: 2px solid var(--danger); padding: 0.35rem 0 0.35rem 0.6rem;
  background: rgba(240, 72, 79, 0.09); border-radius: 0 0.4rem 0.4rem 0;
}
/* Private rows (owner 管理檢視 only): dimmed, hollow-ring dot, dashed 私密 tag. */
.tl-item.priv { opacity: 0.68; }
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(timeline): --danger token + .timeline/.tl-* styles"
```

(Visual fine-tuning against the mockup happens in Task 7's manual check — the dot offset and flag wash padding may need a px nudge.)

---

## Task 4: `TimelineList` presentational component

**Files:**
- Create: `app/(site)/gua/[slug]/TimelineList.tsx`

No `"use client"` directive — it's imported by the already-client `IdentityCard`, exactly like `AccountRow.tsx`. It uses `PlatformIcon` (itself a client component).

- [ ] **Step 1: Write the implementation**

Create `app/(site)/gua/[slug]/TimelineList.tsx`:

```tsx
import type { TimelineView } from "./timeline";
import { PlatformIcon } from "./PlatformIcon";

/** Row label per event kind (繁體中文 / Taiwan). Genesis is the synthetic anchor. */
const KIND_LABEL: Record<TimelineView["kind"], string> = {
  genesis: "建立正身",
  bound: "綁定",
  disclosed: "設為公開",
  set_main: "設為主要",
  reported_hacked: "本人回報遭盜用",
  reported_banned: "本人回報已被停權",
  re_verified: "重新驗證",
  unbound: "解除綁定",
};

/** Per-kind modifier class: gold (genesis/proof), red (flag), or plain. */
function kindClass(kind: TimelineView["kind"]): string {
  if (kind === "genesis") return "genesis";
  if (kind === "bound" || kind === "re_verified") return "proof";
  if (kind === "reported_banned" || kind === "reported_hacked") return "flag";
  return "";
}

export function TimelineList({
  entries,
  manage,
}: {
  entries: TimelineView[];
  manage: boolean;
}) {
  // 公開檢視 hides private entries; 管理檢視 shows all (private marked 私密).
  // For a non-owner the server never sent private entries — both projections are safe.
  const visible = manage ? entries : entries.filter((e) => !e.isPrivate);

  if (visible.length === 0) {
    return <p className="tl-empty">尚無時間軸記錄。</p>;
  }

  return (
    <ol className="timeline">
      {visible.map((e) => {
        const flag = e.kind === "reported_banned" || e.kind === "reported_hacked";
        const priv = manage && e.isPrivate;
        const cls = ["tl-item", kindClass(e.kind), priv ? "priv" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={e.id} className={cls}>
            <span className="dot" aria-hidden />
            <div className="tl-body">
              <div className="tl-date">{e.date}</div>
              <div className="tl-action">
                {flag && "⚠ "}
                {KIND_LABEL[e.kind]}
              </div>
              {e.handle && (
                <div className="tl-acct">
                  <span className="hd">@{e.handle}</span>
                  {e.platform && <PlatformIcon platform={e.platform} size={17} />}
                  {e.platformLabel && <span className="pl">{e.platformLabel}</span>}
                  {priv && <span className="tl-priv-tag">👁 私密</span>}
                </div>
              )}
              {e.proofPostUrl && (
                <a
                  className="tl-proof"
                  href={e.proofPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看貼文 ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Confirms `KIND_LABEL` covers every `TimelineView["kind"]` — a missing key is a compile error.)

- [ ] **Step 3: Commit**

```bash
git add "app/(site)/gua/[slug]/TimelineList.tsx"
git commit -m "feat(timeline): TimelineList presentational component + 繁中 copy"
```

---

## Task 5: Wire `IdentityCard` — `timeline` prop replaces the placeholder

**Files:**
- Modify: `app/(site)/gua/[slug]/IdentityCard.tsx`

- [ ] **Step 1: Import `TimelineList` and the type**

Add to the imports block (after the `AccountRow` import, line 6):

```tsx
import { TimelineList } from "./TimelineList";
import type { TimelineView } from "./timeline";
```

- [ ] **Step 2: Add the `timeline` prop to the `Props` type**

In the `type Props = { ... }` block, add after `accounts: AccountGroups;` (line 20):

```tsx
  /** Append-only ledger rows, oldest-first (genesis at index 0). */
  timeline: TimelineView[];
```

- [ ] **Step 3: Destructure the new prop**

In the `IdentityCard({ ... })` parameter list, add `timeline,` after `accounts,` (line 38).

- [ ] **Step 4: Replace the placeholder with `<TimelineList>`**

Replace this block (lines 105-107):

```tsx
      {tab === "timeline" ? (
        <p className="id-bio" style={{ textAlign: "center" }}>時間軸施工中（Slice 4）。</p>
      ) : (
```

with:

```tsx
      {tab === "timeline" ? (
        <TimelineList entries={timeline} manage={manage} />
      ) : (
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — `page.tsx` and `r/[shortRef]/page.tsx` now miss the required `timeline` prop. That's expected; Task 6 wires them. (If you want a clean checkpoint, do Steps in Task 6 before re-running tsc.)

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/gua/[slug]/IdentityCard.tsx"
git commit -m "feat(timeline): render TimelineList in the 時間軸 tab"
```

---

## Task 6: Wire both pages to build + pass `timeline`; update page tests

**Files:**
- Modify: `app/(site)/gua/[slug]/page.tsx`
- Modify: `app/(site)/r/[shortRef]/page.tsx`
- Modify: `app/(site)/gua/[slug]/page.test.ts`
- Modify: `app/(site)/r/[shortRef]/page.test.ts`

- [ ] **Step 1: Update `gua/[slug]/page.test.ts` first (TDD)**

Add a `./timeline` mock after the `./accounts` mock (after line 37):

```tsx
vi.mock("./timeline", () => ({
  buildTimeline: () => Promise.resolve([{ id: "genesis", kind: "genesis" }]),
}));
```

Add a test inside `describe("/gua/[slug] page", ...)`:

```tsx
  it("builds and passes the timeline prop", async () => {
    currentUser = { id: "u1", slug: "alice", shortRef: "x" };
    const { props } = await call("alice");
    expect(Array.isArray(props.timeline)).toBe(true);
    expect((props.timeline as unknown[]).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run "app/(site)/gua/[slug]/page.test.ts"`
Expected: FAIL — `props.timeline` is `undefined` (page doesn't build it yet).

- [ ] **Step 3: Wire `gua/[slug]/page.tsx`**

Add the import after `buildAccountGroups` (line 6):

```tsx
import { buildTimeline } from "./timeline";
```

Replace the data-load line (line 29):

```tsx
  const { accounts, count, mainFlagged } = await buildAccountGroups(user.id, isOwner);
```

with:

```tsx
  const [{ accounts, count, mainFlagged }, timeline] = await Promise.all([
    buildAccountGroups(user.id, isOwner),
    buildTimeline(user.id, isOwner),
  ]);
```

Add `timeline={timeline}` to the `<IdentityCard ... />` props (after `accounts={accounts}`, line 48).

- [ ] **Step 4: Run the gua page test to verify it passes**

Run: `npx vitest run "app/(site)/gua/[slug]/page.test.ts"`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Wire `r/[shortRef]/page.tsx`**

Add the import after `buildAccountGroups` (line 5):

```tsx
import { buildTimeline } from "@/app/(site)/gua/[slug]/timeline";
```

Replace the data-load line (line 33):

```tsx
  const { accounts, count, mainFlagged } = await buildAccountGroups(owner.id, true);
```

with:

```tsx
  const [{ accounts, count, mainFlagged }, timeline] = await Promise.all([
    buildAccountGroups(owner.id, true),
    buildTimeline(owner.id, true),
  ]);
```

Add `timeline={timeline}` to the `<IdentityCard ... />` props (after `accounts={accounts}`, line 45).

- [ ] **Step 6: Keep the `/r/[shortRef]` test green**

In `app/(site)/r/[shortRef]/page.test.ts`, add a `buildTimeline` mock after the `accounts` mock (after line 44):

```tsx
vi.mock("@/app/(site)/gua/[slug]/timeline", () => ({
  buildTimeline: () => Promise.resolve([{ id: "genesis", kind: "genesis" }]),
}));
```

- [ ] **Step 7: Typecheck + full test run**

Run: `npx tsc --noEmit`
Expected: clean (the missing-prop error from Task 5 is now resolved).

Run: `npx vitest run`
Expected: all green (DB suites may show as skipped if `DATABASE_URL` is unset).

- [ ] **Step 8: Commit**

```bash
git add "app/(site)/gua/[slug]/page.tsx" "app/(site)/r/[shortRef]/page.tsx" \
  "app/(site)/gua/[slug]/page.test.ts" "app/(site)/r/[shortRef]/page.test.ts"
git commit -m "feat(timeline): build + pass timeline prop from both card pages"
```

---

## Task 7: Visual verification against the mockup

**Files:** none (manual check). Reference: [`docs/superpowers/specs/2026-06-18-timeline-tab-mockup.png`](../specs/2026-06-18-timeline-tab-mockup.png).

- [ ] **Step 1: Run the app and open a card with timeline data**

Run: `npm run dev`
Open `/gua/<a-seeded-slug>` (公開檢視) and `?view=manage` (管理檢視) as the owner.

- [ ] **Step 2: Compare each kind against the mockup**

Confirm:
- Oldest-first, **建立正身** gold at the top, latest event at the bottom.
- 綁定 / 重新驗證 rows show the gold `查看貼文 ↗` link + gold dot.
- 設為公開 / 設為主要 rows: muted dot, no proof link.
- 本人回報遭盜用 / 本人回報已被停權: `⚠` prefix, red label, red left-border + faint red wash, light-red handle.
- Every account-bearing row shows its brand-colored `PlatformIcon` (~17px); IG gradient, Threads mono.
- 管理檢視 only: private rows dimmed with a dashed `👁 私密` tag and hollow-ring dot; 公開檢視 hides them.

- [ ] **Step 3: Nudge CSS if needed**

If dot alignment or the flag wash padding differs from the mockup, adjust the `.tl-item .dot` offset / `.tl-item.flag` padding in `app/globals.css`. Re-check. Commit any tweak:

```bash
git add app/globals.css
git commit -m "style(timeline): align dots + flag wash to the mockup"
```

---

## Task 8: Docs + devlog (ship step)

Per the project's "ship it" flow, fold lasting decisions into the maintained docs. (The spec lists these under "Docs to fold — after the slice ships.")

**Files:**
- Modify: `docs/routes.md` — flip surface #8's note from `時間軸施工中` placeholder to live.
- Modify: `CLAUDE.md` — add a "Timeline (§E.2) rendering" bullet under **Locked decisions**: per-account current-visibility filter; all event types public; oldest-first; genesis row from `onboardedAt ?? createdAt`; proof link on `bound`/`re_verified`; no cache.
- Modify: `docs/devlog.md` — add the `v0.15.0` entry (newest-first) + TL;DR row; note it resolves the v0.14.0-design Slice-4 leak gotcha. Mark `**Review:** not yet`.
- Modify: `todo.md` — cross off Slice 4.

- [ ] **Step 1: Update `docs/routes.md`** — find surface #8 (`/gua/[slug]` / `/r/[shortRef]` Identity Card) and update the timeline-tab note to "live (Slice 4, v0.15.0)".

- [ ] **Step 2: Add the CLAUDE.md Locked-decisions bullet** (wording above).

- [ ] **Step 3: Add the devlog `v0.15.0` entry + TL;DR row** following the Devlog format in CLAUDE.md. Anchor for the TL;DR link: lowercase, drop punctuation except hyphens, spaces→hyphens.

- [ ] **Step 4: Cross off Slice 4 in `todo.md`.**

- [ ] **Step 5: Commit**

```bash
git add docs/routes.md CLAUDE.md docs/devlog.md todo.md
git commit -m "docs: Slice 4 timeline live — routes, locked decision, devlog v0.15.0"
```

---

## Final verification (before opening the PR)

- [ ] `npx tsc --noEmit` — clean.
- [ ] `npx vitest run` — green (with `DATABASE_URL` set so `timeline.db.test.ts` actually runs, not skips).
- [ ] Manual check (Task 7) done against the mockup.
- [ ] Then follow CLAUDE.md "Raise a PR" flow: branch off `main`, `gh pr create --base main`. **Stop — do not merge.**

---

## Self-Review (done while writing this plan)

**Spec coverage:**
- Overrides (oldest-first asc; genesis from `onboardedAt ?? createdAt`) → Task 1 read model + test.
- Decision 1 (per-account current-visibility leak filter) → Task 1 (`acct.visibility === "public"` gate) + disclosure-history test.
- Decision 2 (all event types surface) → `KIND_LABEL` covers every kind; no per-type classification.
- Decision 3 (synthetic genesis) → Task 1 prepend + test.
- Decision 4 (no caching) → not implemented; `Promise.all` direct reads only.
- Decision 5 (owner sees all; `isPrivate` flag; non-owner never receives private) → Task 1 `includePrivate` + Task 4 client filter.
- Decision 6 (brand PlatformIcon) → **already shipped v0.14.1**; only consumed (Task 4, `size={17}`).
- Data flow (2-3 indexed queries, JS join, batch proof fetch) → Task 1.
- Event copy table → `KIND_LABEL` + flag `⚠` prefix (Task 4).
- Visual design (rail/dots, account hero, danger wash, private dim) → Task 3 CSS + Task 4 classes.
- Testing list → Task 1 tests (6 cases) + Task 6 page test.
- Out of scope (no schema/migration, no new writers, `reason` unused) → respected; render does not depend on `reason`.

**Placeholder scan:** every code step shows complete code; no TBD/TODO. Manual-tuning step (Task 7) is a real verification step with concrete acceptance criteria, not a code placeholder.

**Type consistency:** `TimelineEntry` (Task 1) → `TimelineView` (Task 2) → `TimelineList` props (Task 4) → `IdentityCard` prop (Task 5) → page build (Task 6) all use the same `kind` union (`BindingEventType | "genesis"`) and `proofPostUrl`/`isPrivate`/`handle`/`platform` field names. `buildTimeline` / `listTimelineEvents` signatures match their call sites.
