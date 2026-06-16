# Auth.js Site Login — Google OAuth (MVP)

**Date:** 2026-06-15
**Status:** 🟡 Design approved — ready for implementation plan
**Type:** Product + architecture design spec (not a full technical spec, not yet an execution tracker).
**North star:** the main design spec
[`2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — §12 (stack lock:
Auth.js v5, Prisma adapter) and §8 (data model: `users`/正身). Where this spec and §8/§12 disagree,
the main spec is the intent; reconcile by updating both.
**Companion:** [`2026-06-15-email-login-future-feature.md`](2026-06-15-email-login-future-feature.md)
— the **deferred** email-login (magic-link + OTP) design, scoped *out* of this MVP. The MVP is built
so email is an additive add-on (see §11 of that doc / §5 here).

> **Legend:** **[DECIDED]** locked in this brainstorm · **[REC]** recommendation, operator's final
> call · **[DEFERRED]** explicitly out of scope for this milestone.

---

## 1. Purpose

Stand up **site login** so that "a logged-in 正身 exists." This is the gate every feature behind it
(建立正身, 分身 binding, 分身管理) depends on. It is **site login only** and has nothing to do with
the §6.1 "no platform OAuth for identity" rule — logging in with Google ≠ proving you own a
Threads/IG account.

**[DECIDED]** the MVP ships **Google OAuth only**. Email login (magic-link + OTP) is deferred to a
future milestone — see the companion doc — because it adds real complexity (email delivery, OTP
brute-force/lockout, custom session minting) for a method we can add later without reworking anything.

**Conscious deferral, not accidental:** the audience (Meta-ban refugees) includes privacy-minded
users, and "Google only" is itself a single-vendor chokepoint. Email login is the planned escape
hatch; the Resend side is already set up (DNS-verified `send.guasi.tw` + API key) and waiting.

## 2. Scope

### In scope (this milestone)
- Auth.js v5 (NextAuth) wired into the Next.js App Router with the **Prisma adapter** on Neon.
- **Google OAuth** provider — the only login method in the MVP.
- **Database sessions** (via the adapter) — not JWT (chosen for server-side revocation, which matters
  for the §6.8 hacked-account flows).
- The **`User` model = 正身**, extended with app-owned profile columns (`displayName`, `avatarUrl`,
  `bio`, `createdAt`) — see §3. One Prisma migration.
- Login + logout UI: a `/login` page (Google button) and a logout affordance.
- `signIn` hardening: reject Google sign-in if the email isn't verified (§4).
- Env + config: Google Cloud OAuth client, `AUTH_SECRET`, etc. (see §7).
- Tests for the Google flows (see §8).

New users land **logged in immediately** with a seeded profile. No forced onboarding.

### Out of scope — **[DEFERRED]**
- **Email login (magic-link + OTP)** — full design parked in the
  [companion future-feature doc](2026-06-15-email-login-future-feature.md). Includes the `rid`/
  `LoginRequest` model, OTP throttling/lockout, account-linking-by-verified-email, and custom DB
  session minting. The MVP is built so this is additive (§5).
- The rich **建立正身** page (avatar upload, bio editor) and any **forced onboarding gate**. New
  users simply have an editable profile seeded from Google.
- **分身 binding** and everything in §6.2+ of the main spec.
- Route protection / middleware beyond exposing `auth` (kept minimal; real gating arrives with the
  features that need it).

## 3. Data model

The Auth.js Prisma adapter creates **`Account`**, **`Session`**, **`VerificationToken`** as standard
(the adapter migration includes `VerificationToken` even though the MVP has no email provider yet —
that's fine and keeps email additive). **`User` is the 正身**, extended with app-owned profile fields.
**[DECIDED]** "explicit profile fields, seeded."

```prisma
model User {
  // Auth.js-managed
  id            String    @id @default(cuid())
  email         String?   @unique          // normalized lowercase/trim at the boundary (§4)
  emailVerified DateTime?
  name          String?                     // from the Google profile
  image         String?                     // from the Google profile

  // app-owned 正身 profile (§8 of main spec)
  displayName   String?                     // seeded ← name on first login
  avatarUrl     String?                     // seeded ← image on first login
  bio           String?
  createdAt     DateTime  @default(now())

  accounts      Account[]
  sessions      Session[]
  // §8 relations (linked_accounts, binding_events, …) arrive with later feature work
}
```

> **⚠️ Naming collision — read this.** `User.accounts` (the Auth.js **`Account[]`**) is **NOT** the
> bound 分身. `Account` = a **site-login method** (the Google OAuth connection: `provider="google"`,
> `providerAccountId`, tokens). The verified **分身** social accounts are the separate §8
> **`linked_accounts`** table, which arrives with feature work. Also note: an OAuth login creates one
> `Account` row; a (future) email login creates **none** (its identity lives on `User.email`). Don't
> conflate `Account` (how you log in) with `linked_accounts` (which social identities you've proven).

- **`Account`** — one row per linked **login method**. MVP: the Google connection. (See the warning
  above.)
- **`Session`** — DB sessions live here (server-side revocation for §6.8).
- **`VerificationToken`** — created by the adapter; unused in the MVP (no email provider yet).

**Seeding:** on first login, copy `name → displayName` and `image → avatarUrl` (Google always
supplies these), as **editable defaults**. Seeding runs once at user creation (adapter `createUser` /
a `createUser` event), **not** on every login, so later edits are never clobbered by a re-login.

## 4. Auth flow & hardening

- **Google:** standard OAuth → `signIn` callback checks `email_verified` → adapter creates/loads the
  正身 → profile seeded on creation → DB session.
- **`signIn` hardening:** reject sign-in if `profile.email_verified !== true` (belt-and-suspenders;
  Google always sets it, we don't *assume* it). This also keeps the future email-linking model sound.
- **Email normalization:** lowercase + trim at the adapter boundary, so the stored `User.email` is
  canonical (the join key the future email method resolves to).

## 5. Forward-compatibility for email login

Email login is deferred, but the MVP deliberately preserves the hooks so it's **additive (no
migration of existing accounts)**:

1. **Auth.js + Prisma adapter** — multi-provider by design; adding email = register a provider (+ the
   `rid`/`LoginRequest` table from the companion doc). Existing `User`/`Account` rows untouched.
2. **`User.email` unique + from Google's *verified* email** — the join key email login will resolve
   to → same 正身.
3. **DB sessions** — email login mints the same kind of session.
4. **`email_verified` check kept now** — the same hardening the future linking model relies on.

The full email design (including why same-email linking is safe, the `rid` model, and OTP throttling)
lives in [`2026-06-15-email-login-future-feature.md`](2026-06-15-email-login-future-feature.md).

## 6. Components & file shape

Following the flat modular-monolith layout (`app/` + `lib/*` + `prisma/` at root):

- **`lib/auth/`** — Auth.js core.
  - `index.ts` — the `NextAuth({...})` call, exporting `auth`, `handlers`, `signIn`, `signOut`.
  - `providers.ts` — Google provider config.
  - `callbacks.ts` — the `signIn` hardening callback (reject unverified email) and `session` callback
    (expose `displayName`/`avatarUrl` on the session if useful).
  - `events.ts` (or an adapter `createUser` wrapper) — profile **seeding** on first login.
- **`app/api/auth/[...nextauth]/route.ts`** — the Auth.js route handler (`export { GET, POST } = handlers`).
- **`app/(auth)/login/`** — the login page (Google button).
- **`lib/db/`** — already exists (Prisma client singleton); the adapter plugs into it.
- **`middleware.ts`** — optional, minimal; only to surface `auth` for future route protection.

## 7. Config / env

New env vars — set in **Vercel (Prod/Preview/Dev)** and **local `.env`**, **none committed**;
`.env.example` updated with placeholders:

- `AUTH_SECRET` — `openssl rand -hex 32`.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from the Google Cloud OAuth client.
- `AUTH_URL` / `NEXTAUTH_URL` as needed per environment (preview URLs included).

(Resend / `AUTH_EMAIL_FROM` are **not** needed for this MVP — they belong to the deferred email
milestone.)

**Google Cloud OAuth client:** create with redirect URIs for production
(`https://guasi.tw/api/auth/callback/google`), preview deploys, and `localhost`. (Preview URLs are
dynamic on Vercel — confirm the redirect-URI strategy for previews in the plan; may need a stable
preview alias or `AUTH_REDIRECT_PROXY_URL`.)

## 8. Testing

- **Unit:** email normalization; profile-seeding logic; the `signIn` callback rejecting
  unverified-email sign-in.
- **Integration:** first Google login creates a 正身 with a seeded profile; a second login with the
  same Google account reuses the same 正身 (and does **not** re-seed / clobber edited profile fields);
  logout clears the session.
- **Manual smoke** on a preview deploy: a real Google login + logout round-trip.

## 9. Open items for the implementation plan

- Preview-deploy Google redirect-URI strategy (§7).
- Logout UX + where the session/`auth()` helper is consumed in the app shell.
- Confirm the seeding hook (adapter `createUser` wrapper vs `events.createUser`) in the pinned
  Auth.js v5 + `@auth/prisma-adapter` versions.
