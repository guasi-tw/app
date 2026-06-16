# Auth.js Site Login (Google OAuth MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up passwordless **site login via Google OAuth** so "a logged-in 正身 exists" — the gate every feature behind it depends on.

**Architecture:** Auth.js v5 (NextAuth) wired into the Next.js 16 App Router with the `@auth/prisma-adapter` on Neon. **Database sessions** (not JWT) for server-side revocation. `User` *is* the 正身, extended with app-owned profile columns (`displayName`, `avatarUrl`, `bio`, `createdAt`) seeded once from the Google profile via a thin **adapter `createUser` wrapper** (which also normalizes the email). A `signIn` callback rejects unverified Google emails. New users land logged-in immediately with a seeded, editable profile — no onboarding gate.

**Tech Stack:** Next.js 16.2.9 · React 19 · TypeScript 6 · Prisma 6.19.3 on Neon Postgres · `next-auth@beta` (v5) · `@auth/prisma-adapter` · Vitest (new test harness).

**Source spec:** [`2026-06-15-authjs-site-login-design.md`](../specs/2026-06-15-authjs-site-login-design.md). North star: [`2026-06-14-identity-backup-design.md`](../specs/2026-06-14-identity-backup-design.md) §8 (data model) / §12 (stack lock). Email login is **deferred** — see [`2026-06-15-email-login-future-feature.md`](../specs/2026-06-15-email-login-future-feature.md).

**Milestone version:** v0.6.0.

---

## Decisions closed in this plan (the spec's §9 open items)

1. **Seeding hook + email normalization** → both happen in a single **adapter `createUser` wrapper** (`lib/auth/adapter.ts`), not `events.createUser`. Rationale: it folds the seeded `displayName`/`avatarUrl` and the normalized `email` into the *same* `User` insert — atomic, can't be skipped, no second write, and the mapping is a pure function we can unit-test. `events.createUser` (a post-create update) is the rejected alternative: extra write, fires after the row already exists with a non-normalized email.
2. **Re-seed protection** → structural. `createUser` runs **once**, at account creation. A returning user resolves through `getUserByAccount` (no `createUser`), so later profile edits are never clobbered.
3. **Preview-deploy Google redirect-URI strategy** → register only the **production** and **localhost** redirect URIs in Google Cloud, and set `AUTH_REDIRECT_PROXY_URL=https://guasi.tw/api/auth` on Vercel's **Preview** environment so preview OAuth callbacks proxy through production. Vercel preview URLs are dynamic and can't be pre-registered; this is Auth.js v5's documented answer.
4. **Middleware** → **not built.** Route protection is out of scope. (Also: Next.js 16 renamed `middleware.ts` → `proxy.ts`; the deprecated name still works but we create neither file this milestone.)
5. **Session callback exposing `displayName`/`avatarUrl`** → **deferred.** The MVP shell shows login state from the built-in `session.user.name`/`image`. Seeded columns are written for future 建立正身 work; no read path needed yet. Avoids a `next-auth.d.ts` type-augmentation detour.
6. **Test runner** → **Vitest** (none existed before). Unit tests run in `node` env, no DB. The one DB-backed integration test self-skips when `DATABASE_URL` is unset, so `npm test` is green everywhere.

---

## File structure

**New files:**
- `.npmrc` — `legacy-peer-deps=true` (next-auth v5 peer range stops at Next 15; Vercel's build `npm install` needs this too).
- `vitest.config.ts` — Vitest config (node env, tsconfig path alias).
- `lib/auth/adapter.ts` — `normalizeEmail`, `buildCreateUserInput` (pure), `createAuthAdapter` (PrismaAdapter wrapper).
- `lib/auth/callbacks.ts` — `isGoogleEmailVerified` (pure), `signInCallback`.
- `lib/auth/providers.ts` — Google provider array.
- `lib/auth/index.ts` — the `NextAuth({...})` call; exports `handlers`, `auth`, `signIn`, `signOut`.
- `lib/auth/adapter.test.ts` — unit tests for `normalizeEmail` / `buildCreateUserInput`.
- `lib/auth/callbacks.test.ts` — unit tests for `isGoogleEmailVerified` / `signInCallback`.
- `lib/auth/adapter.db.test.ts` — DB integration test for seeding (self-skips without `DATABASE_URL`).
- `app/api/auth/[...nextauth]/route.ts` — Auth.js route handler.
- `app/(auth)/login/page.tsx` — login page (Google button).

**Modified files:**
- `package.json` — add deps + `test` script.
- `prisma/schema.prisma` — add `User`/`Account`/`Session`/`VerificationToken`; keep `HealthCheck`.
- `app/page.tsx` — consume `auth()`; show login/logout in the shell.
- `.env.example` — add `AUTH_*` placeholders.
- `docs/devlog.md`, `todo.md`, `CLAUDE.md` — milestone wrap-up.

**Manual (no code) — Task 10:** Google Cloud OAuth client + Vercel env vars.

---

## Task 1: Install dependencies & lock the peer-dep workaround

**Files:**
- Create: `.npmrc`
- Modify: `package.json`

- [ ] **Step 1: Create `.npmrc`**

`next-auth@beta` (v5) declares a peer range of `next: ^14 || ^15`, so a plain `npm install` fails against Next 16. This file makes both local and Vercel installs tolerate it.

```
legacy-peer-deps=true
```

- [ ] **Step 2: Install runtime + dev dependencies**

Run:
```bash
npm install next-auth@beta @auth/prisma-adapter
npm install -D vitest vite-tsconfig-paths
```
Expected: installs succeed (no `ERESOLVE` abort, thanks to `.npmrc`). `@prisma/client`/`prisma` are already present.

- [ ] **Step 3: Pin the resolved `next-auth` version**

`next-auth@beta` floats. Read the exact version npm resolved and pin it so prod/preview/local match.

Run:
```bash
node -p "require('./package.json').dependencies['next-auth']"
```
Then edit `package.json` so `next-auth` is pinned to that **exact** version (drop the `^`/`beta` tag — e.g. `"next-auth": "5.0.0-beta.29"`). Leave `@auth/prisma-adapter` with its caret.

- [ ] **Step 4: Add the `test` script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 5: Verify install integrity**

Run: `npm ls next-auth @auth/prisma-adapter vitest`
Expected: all three resolve, no missing/invalid markers.

- [ ] **Step 6: Commit**

```bash
git add .npmrc package.json package-lock.json
git commit -m "chore: add Auth.js v5, Prisma adapter, and Vitest deps"
```

---

## Task 2: Vitest harness bootstrap

**Files:**
- Create: `vitest.config.ts`
- Create (temporary): `lib/auth/smoke.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write a throwaway smoke test to prove the harness runs**

Create `lib/auth/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("vitest harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS — 1 passed (`vitest harness > runs`).

- [ ] **Step 4: Delete the smoke test**

Run: `rm lib/auth/smoke.test.ts`

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts
git commit -m "test: add Vitest harness"
```

---

## Task 3: Prisma schema — Auth.js models + 正身 profile fields

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_authjs_models/` (generated)

- [ ] **Step 1: Append the Auth.js + `User` models to `prisma/schema.prisma`**

Leave the existing `generator`, `datasource`, and `HealthCheck` blocks untouched. Append:

```prisma
// --- Auth.js (site login) — Milestone v0.6.0 ---
// See docs/superpowers/specs/2026-06-15-authjs-site-login-design.md.
// `User` IS the 正身 (main spec §8), extended with app-owned profile columns.
// NOTE: `Account` = a site-LOGIN method (the Google connection), NOT a bound 分身.
// Bound 分身 live in the future §8 `linked_accounts` table.

model User {
  // Auth.js-managed
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique          // normalized lowercase/trim at the adapter boundary
  emailVerified DateTime?
  image         String?

  // app-owned 正身 profile (seeded from Google on first login; editable later)
  displayName   String?
  avatarUrl     String?
  bio           String?
  createdAt     DateTime  @default(now())

  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 2: Confirm a direct DB URL is available for migrations**

Run: `node -e "console.log(!!process.env.DATABASE_URL_UNPOOLED || !!require('fs').readFileSync('.env','utf8').includes('DATABASE_URL_UNPOOLED'))"`
Expected: `true`. (Migrations use `directUrl = DATABASE_URL_UNPOOLED`, pointed at the Neon `vercel-dev` branch per `.env`.)

- [ ] **Step 3: Create and apply the migration against the dev branch**

Run: `npx prisma migrate dev --name add_authjs_models`
Expected: a new folder `prisma/migrations/<timestamp>_add_authjs_models/` with `migration.sql` creating `User`, `Account`, `Session`, `VerificationToken`; Prisma Client regenerates. `HealthCheck` is untouched.

- [ ] **Step 4: Sanity-check the generated SQL**

Run: `git status --short prisma/ && ls prisma/migrations/`
Expected: the new migration folder exists alongside `20260615213935_init_health_check`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Auth.js User/Account/Session/VerificationToken models"
```

---

## Task 4: Email normalization + create-user mapping (pure, TDD)

**Files:**
- Create: `lib/auth/adapter.ts`
- Test: `lib/auth/adapter.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `lib/auth/adapter.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { normalizeEmail, buildCreateUserInput } from "./adapter";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo.Bar@Example.COM ")).toBe("foo.bar@example.com");
  });
});

describe("buildCreateUserInput", () => {
  it("normalizes the email and seeds displayName/avatarUrl from name/image", () => {
    const out = buildCreateUserInput({
      email: " Alice@Example.com ",
      name: "Alice Wang",
      image: "https://lh3.googleusercontent.com/a/abc",
    });
    expect(out.email).toBe("alice@example.com");
    expect(out.displayName).toBe("Alice Wang");
    expect(out.avatarUrl).toBe("https://lh3.googleusercontent.com/a/abc");
  });

  it("leaves a missing email untouched and seeds nulls for missing name/image", () => {
    const out = buildCreateUserInput({ email: null, name: null, image: null });
    expect(out.email).toBeNull();
    expect(out.displayName).toBeNull();
    expect(out.avatarUrl).toBeNull();
  });

  it("preserves other fields passed by the adapter", () => {
    const out = buildCreateUserInput({ email: "a@b.com", emailVerified: null, extra: 1 } as never);
    expect((out as { extra: number }).extra).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- adapter.test.ts`
Expected: FAIL — cannot resolve `./adapter` / functions not defined.

- [ ] **Step 3: Implement `lib/auth/adapter.ts` (pure parts only)**

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";

/** Canonicalize an email so the stored User.email is the stable join key (spec §4). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Fold normalization + one-time profile seeding into the single User insert.
 * `displayName`/`avatarUrl` are seeded from the Google profile as EDITABLE defaults
 * and only ever written here (createUser fires once), so later edits aren't clobbered.
 */
export function buildCreateUserInput<T extends { email?: string | null; name?: string | null; image?: string | null }>(
  data: T,
): T & { email: string | null; displayName: string | null; avatarUrl: string | null } {
  return {
    ...data,
    email: data.email ? normalizeEmail(data.email) : (data.email ?? null),
    displayName: data.name ?? null,
    avatarUrl: data.image ?? null,
  };
}

/** PrismaAdapter with a createUser wrapper (normalize email + seed profile). */
export function createAuthAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    createUser: (data) => base.createUser!(buildCreateUserInput(data) as AdapterUser),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- adapter.test.ts`
Expected: PASS — 4 passed. (`createAuthAdapter` is exercised in Task 7.)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/adapter.ts lib/auth/adapter.test.ts
git commit -m "feat: adapter createUser wrapper — normalize email, seed profile"
```

---

## Task 5: `signIn` hardening callback (pure, TDD)

**Files:**
- Create: `lib/auth/callbacks.ts`
- Test: `lib/auth/callbacks.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `lib/auth/callbacks.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { isGoogleEmailVerified, signInCallback } from "./callbacks";

describe("isGoogleEmailVerified", () => {
  it("is true only when email_verified === true", () => {
    expect(isGoogleEmailVerified({ email_verified: true })).toBe(true);
  });
  it("is false for false / missing / non-boolean", () => {
    expect(isGoogleEmailVerified({ email_verified: false })).toBe(false);
    expect(isGoogleEmailVerified({})).toBe(false);
    expect(isGoogleEmailVerified({ email_verified: "true" })).toBe(false);
    expect(isGoogleEmailVerified(null)).toBe(false);
    expect(isGoogleEmailVerified(undefined)).toBe(false);
  });
});

describe("signInCallback", () => {
  it("rejects a Google sign-in with an unverified email", async () => {
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email_verified: false },
    } as never);
    expect(ok).toBe(false);
  });
  it("allows a Google sign-in with a verified email", async () => {
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email_verified: true },
    } as never);
    expect(ok).toBe(true);
  });
  it("allows non-Google providers unchanged", async () => {
    const ok = await signInCallback({ account: { provider: "email" }, profile: {} } as never);
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- callbacks.test.ts`
Expected: FAIL — cannot resolve `./callbacks`.

- [ ] **Step 3: Implement `lib/auth/callbacks.ts`**

```typescript
import type { NextAuthConfig } from "next-auth";

/** Google always sets email_verified; we verify rather than assume (spec §4). */
export function isGoogleEmailVerified(profile: unknown): boolean {
  return (
    typeof profile === "object" &&
    profile !== null &&
    (profile as { email_verified?: unknown }).email_verified === true
  );
}

/** Reject Google sign-in unless the Google email is verified; pass others through. */
export const signInCallback: NonNullable<NextAuthConfig["callbacks"]>["signIn"] = async ({
  account,
  profile,
}) => {
  if (account?.provider === "google") {
    return isGoogleEmailVerified(profile);
  }
  return true;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- callbacks.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/callbacks.ts lib/auth/callbacks.test.ts
git commit -m "feat: signIn callback rejects unverified Google email"
```

---

## Task 6: Auth.js core wiring (providers + NextAuth)

**Files:**
- Create: `lib/auth/providers.ts`
- Create: `lib/auth/index.ts`

- [ ] **Step 1: Write `lib/auth/providers.ts`**

The Google provider auto-reads `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` from the env (Auth.js v5 convention) — no inline secrets.

```typescript
import Google from "next-auth/providers/google";

// MVP: Google is the only login method. Email (magic-link/OTP) is a deferred,
// additive provider — see 2026-06-15-email-login-future-feature.md.
export const providers = [Google];
```

- [ ] **Step 2: Write `lib/auth/index.ts`**

```typescript
import NextAuth from "next-auth";
import { prisma } from "@/lib/db/client";
import { createAuthAdapter } from "./adapter";
import { providers } from "./providers";
import { signInCallback } from "./callbacks";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAuthAdapter(prisma),
  session: { strategy: "database" }, // server-side revocation for §6.8 hacked-account flows
  providers,
  trustHost: true, // Vercel / proxied hosts
  callbacks: { signIn: signInCallback },
  pages: { signIn: "/login" },
});
```

- [ ] **Step 3: Typecheck the new wiring**

Run: `npx tsc --noEmit`
Expected: no errors. (If `next-auth/adapters` types complain about the `AdapterUser` cast in Task 4, confirm the cast is present; it's intentional because `displayName`/`avatarUrl` are app columns, not Auth.js fields.)

- [ ] **Step 4: Commit**

```bash
git add lib/auth/providers.ts lib/auth/index.ts
git commit -m "feat: wire NextAuth (Google provider, DB sessions, Prisma adapter)"
```

---

## Task 7: DB integration test — seeding writes a normalized, seeded 正身 row

**Files:**
- Create: `lib/auth/adapter.db.test.ts`

This test runs the **real** wrapped adapter against the Neon `vercel-dev` branch (via `DATABASE_URL`). It self-skips when no DB is configured, so `npm test` stays green in environments without a database (e.g. plain CI).

- [ ] **Step 1: Write the integration test**

Create `lib/auth/adapter.db.test.ts`:
```typescript
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { createAuthAdapter } from "./adapter";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("createAuthAdapter.createUser (DB)", () => {
  it("creates a 正身 with a normalized email and seeded profile", async () => {
    const adapter = createAuthAdapter(prisma);
    const user = await adapter.createUser!({
      id: "ignored-by-prisma",
      email: " New.User@Example.COM ",
      emailVerified: null,
      name: "New User",
      image: "https://example.com/avatar.png",
    });
    createdIds.push(user.id);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.email).toBe("new.user@example.com");
    expect(row.displayName).toBe("New User");
    expect(row.avatarUrl).toBe("https://example.com/avatar.png");
    expect(row.bio).toBeNull(); // not seeded — user fills this in later
  });
});
```

- [ ] **Step 2: Run with the dev DB configured**

Run: `npm test -- adapter.db.test.ts`
Expected (with `.env` `DATABASE_URL` pointing at the Neon `vercel-dev` branch): PASS — 1 passed; the test user is deleted in cleanup.
Expected (no DB): the suite is **skipped**, still exit 0.

- [ ] **Step 3: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: all unit tests pass; the DB test passes or skips.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/adapter.db.test.ts
git commit -m "test: DB integration — adapter seeds normalized 正身 on create"
```

---

## Task 8: Auth.js route handler

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Write the route handler**

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 2: Verify the dev server boots and the provider endpoint responds**

Start the dev server in one shell: `npm run dev`
In another shell, run: `curl -s http://localhost:3000/api/auth/providers`
Expected: JSON listing the `google` provider, e.g. `{"google":{"id":"google","name":"Google",...}}`. (Requires `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`AUTH_SECRET` in `.env` — Task 10. If unset, the endpoint may 500; finish Task 10 first if so, or set throwaway local values.)
Stop the dev server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add "app/api/auth/[...nextauth]/route.ts"
git commit -m "feat: mount Auth.js route handler"
```

---

## Task 9: Login page + app-shell login/logout

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the login page**

Create `app/(auth)/login/page.tsx`. A server component with a server-action form so no client JS is needed:
```tsx
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="wrap">
      <h1 className="wordmark">登入我是正身</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit">使用 Google 登入</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Update `app/page.tsx` to reflect login state**

Replace the file with a server component that reads the session and shows a login link or a logout button:
```tsx
import { auth, signOut } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="wrap">
      <h1 className="wordmark">我是正身</h1>
      <p className="lede">
        主動驗證並串連你擁有的社群帳號，讓某個帳號被封時，存活的帳號能為你證明 ——
        也讓任何人都能公開查證「這些帳號是同一個人」。
      </p>
      {session?.user ? (
        <p className="status">
          已登入：{session.user.name ?? session.user.email}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit">登出</button>
          </form>
        </p>
      ) : (
        <p className="status">
          <a href="/login">登入</a> · 建置中 · coming soon
        </p>
      )}
      <footer className="foot">guasi.tw</footer>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck clean; `next build` succeeds. (`npm run build` runs `prisma migrate deploy` first against the dev branch — fine; the Auth.js migration is already applied.)

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login/page.tsx" app/page.tsx
git commit -m "feat: login page + app-shell login/logout"
```

---

## Task 10: Config / env — Google Cloud OAuth client & Vercel env vars (manual)

**Files:**
- Modify: `.env.example`

These steps configure external services and secrets; secrets are **never committed**.

- [ ] **Step 1: Generate `AUTH_SECRET` and add it to local `.env`**

Run: `openssl rand -hex 32`
Add to `.env` (gitignored): `AUTH_SECRET="<the value>"`.

- [ ] **Step 2: Create the Google Cloud OAuth 2.0 Client**

In Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (type: **Web application**):
- **Authorized JavaScript origins:** `https://guasi.tw`, `http://localhost:3000`
- **Authorized redirect URIs:**
  - `https://guasi.tw/api/auth/callback/google`
  - `http://localhost:3000/api/auth/callback/google`
  - (Do **not** add preview URLs — they're dynamic; previews proxy through prod, Step 5.)

Copy the Client ID and Client secret.

- [ ] **Step 3: Add Google creds to local `.env`**

```
AUTH_GOOGLE_ID="<client id>"
AUTH_GOOGLE_SECRET="<client secret>"
```

- [ ] **Step 4: Update `.env.example` with placeholders (committed)**

Append to `.env.example`:
```
# --- Auth.js site login (Google OAuth) — Milestone v0.6.0 ---
# AUTH_SECRET: generate with `openssl rand -hex 32`. Required in every environment.
AUTH_SECRET="replace-with-a-long-random-string"
# Google OAuth client (Cloud Console → Credentials → Web application).
AUTH_GOOGLE_ID="replace-with-google-oauth-client-id"
AUTH_GOOGLE_SECRET="replace-with-google-oauth-client-secret"
# Production canonical URL (custom domain). Set per-environment in Vercel.
AUTH_URL="https://guasi.tw"
# Preview-only: proxy OAuth callbacks through production (preview URLs are dynamic and
# can't be registered as Google redirect URIs). Set ONLY on Vercel's Preview env.
# AUTH_REDIRECT_PROXY_URL="https://guasi.tw/api/auth"
```

- [ ] **Step 5: Set Vercel environment variables (project `guasi-app`)**

In Vercel → Project Settings → Environment Variables:
- **Production:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL=https://guasi.tw`, **`AUTH_REDIRECT_PROXY_URL=https://guasi.tw/api/auth`**
- **Preview:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, **`AUTH_REDIRECT_PROXY_URL=https://guasi.tw/api/auth`** (no `AUTH_URL`)
- **Development:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

(Reuse one Google client across all envs — prod handles every real redirect; previews proxy through it.)

> ⚠️ **`AUTH_REDIRECT_PROXY_URL` must be set on BOTH Production and Preview.** Auth.js docs:
> *"If the variable is not set in the stable environment, the proxy functionality will not be
> enabled!"* Without it on Production, Google's callback to `guasi.tw` is handled as a local
> login, the preview's PKCE `code_verifier` cookie isn't present, and it fails with
> `InvalidCheck: pkceCodeVerifier could not be parsed`. `AUTH_SECRET` must also be the **same
> value** in Production and Preview (the proxy verifies the OAuth `state` with it).

- [ ] **Step 6: Commit the example only**

```bash
git add .env.example
git commit -m "docs: document Auth.js env vars in .env.example"
```

---

## Task 11: Ship, smoke-test on preview, and wrap up docs

**Files:**
- Modify: `docs/devlog.md`, `todo.md`, `CLAUDE.md`

- [ ] **Step 1: Open the PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: Auth.js site login (Google OAuth MVP)" \
  --body "Implements docs/superpowers/plans/2026-06-15-authjs-site-login.md (v0.6.0). Google-only site login via Auth.js v5 + Prisma adapter, DB sessions, seeded 正身 profile."
```

- [ ] **Step 2: Manual smoke on the preview deploy**

On the Vercel preview URL for the PR:
1. Visit `/login` → click **使用 Google 登入** → complete Google consent → land back on `/` showing **已登入：<name>**.
2. Confirm a `User` row exists in the preview Neon branch with `email` lowercased and `displayName`/`avatarUrl` seeded.
3. Click **登出** → returns to `/` showing the **登入** link (session cleared).
4. (Optional) Re-login → same `User` row reused (no duplicate; profile unchanged).

Record the result. If consent fails with `redirect_uri_mismatch`, re-check Step 2/Step 5 of Task 10 (the proxy URL + registered prod redirect).

- [ ] **Step 3: Update `todo.md`**

Tick the **Auth.js (site login)** item: mark Google-only MVP shipped as v0.6.0; leave the email-login sub-item deferred.

- [ ] **Step 4: Add the devlog entry**

Prepend a `## v0.6.0 — Auth.js site login (Google OAuth) (<date> <time from final commit>)` entry (newest-first) and a TL;DR table row linking to it. Include **What was built** and tagged **Key technical learnings** — at minimum:
- `[gotcha]` next-auth v5 peer range stops at Next 15 → `.npmrc` `legacy-peer-deps=true` (Vercel build install needs it too).
- `[gotcha]` Next 16 renamed `middleware.ts` → `proxy.ts`; we built neither (route protection out of scope).
- `[insight]` Seeding + email-normalization folded into the adapter `createUser` wrapper (one atomic insert) instead of `events.createUser`.
- `[insight]` Vercel preview OAuth proxied through prod via `AUTH_REDIRECT_PROXY_URL` (dynamic preview URLs can't be registered with Google).
Set `**Review:** not yet` and a **Design docs:** line pointing to the spec + this plan.

- [ ] **Step 5: Reconcile `CLAUDE.md`**

Confirm the "Tech stack" and "Site login" locked-decision lines still read true (Google-only MVP shipped, email deferred) — they should need no change. Do **not** touch the "Auth-code format and expiry window" open question: that's about 分身-binding verification codes, unrelated to this site-login milestone. If nothing needs changing, skip the edit.

- [ ] **Step 6: Commit docs and squash-merge**

```bash
git add docs/devlog.md todo.md CLAUDE.md
git commit -m "docs: v0.6.0 Auth.js site login — devlog, todo, context"
git push
```
Then squash-merge the PR (production deploy). After merge, run the same smoke (Step 2) against `https://guasi.tw`.

---

## Self-review — spec coverage

| Spec section | Covered by |
|---|---|
| §2 Auth.js v5 + Prisma adapter on Neon | Tasks 1, 3, 6 |
| §2 Google OAuth only | Task 6 (`providers.ts`) |
| §2 Database sessions | Task 6 (`session.strategy: "database"`) |
| §2/§3 `User`=正身 + profile columns, one migration | Task 3 |
| §2 Login + logout UI | Task 9 |
| §2/§4 `signIn` rejects unverified email | Task 5 |
| §3 Adapter creates Account/Session/VerificationToken | Task 3 |
| §3/§4 Profile seeding once on create | Task 4 (wrapper) + Task 7 (DB test) |
| §4 Email normalization at adapter boundary | Task 4 |
| §5 Forward-compat for email login | Structural (adapter, `User.email` unique, DB sessions, verify check) — Tasks 3–6 |
| §6 File shape (`lib/auth/*`, route handler, login route) | Tasks 4–9 |
| §6 `middleware.ts` (optional) | Deferred — Decision 4 (Next 16 `proxy.ts`; route protection out of scope) |
| §7 Env (`AUTH_SECRET`, Google creds, preview redirect strategy) | Task 10 |
| §8 Unit tests (normalize, seed, signIn guard) | Tasks 4, 5 |
| §8 Integration (seeded create) | Task 7 |
| §8 Manual smoke on preview | Task 11 Step 2 |
| §9 Open items (seeding hook, preview redirect, logout UX) | Decisions 1–5; Tasks 9–11 |
