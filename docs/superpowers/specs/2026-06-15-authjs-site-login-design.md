# Auth.js Site Login — Google OAuth + Email (6-digit code: magic-link + OTP)

**Date:** 2026-06-15
**Status:** 🟡 Design approved — ready for implementation plan
**Type:** Product + architecture design spec (not a full technical spec, not yet an execution tracker).
**North star:** the main design spec
[`2026-06-14-identity-backup-design.md`](2026-06-14-identity-backup-design.md) — §12 (stack lock:
Auth.js v5, Prisma adapter, Resend) and §8 (data model: `users`/正身, `email_tokens`). Where this
spec and §8/§12 disagree, the main spec is the intent; reconcile by updating both.

> **Legend:** **[DECIDED]** locked in this brainstorm · **[REC]** recommendation, operator's final
> call · **[DEFERRED]** explicitly out of scope for this milestone.

---

## 1. Purpose

Stand up **site login** so that "a logged-in 正身 exists." This is the gate every feature behind it
(建立正身, 分身 binding, 分身管理) depends on. It is **site login only** and has nothing to do with
the §6.1 "no platform OAuth for identity" rule — logging in with Google ≠ proving you own a
Threads/IG account.

Two passwordless methods, both resolving to **one 正身 per person**:
- **Google OAuth**
- **Email** — magic-link **and** 6-digit OTP, sent via **Resend** from `send.guasi.tw` (already
  DNS-verified + test-sent, 2026-06-15).

The defining requirement (the operator's explicit ask): **the same verified email via Google and via
email must resolve to the same 正身**, in either order.

## 2. Scope

### In scope (this milestone) — **[DECIDED]** "auth plumbing only"
- Auth.js v5 (NextAuth) wired into the Next.js App Router with the **Prisma adapter** on Neon.
- **Google OAuth** provider.
- **Email** provider: a single **6-digit code** backing both magic-link + OTP (see §6).
- **Database sessions** (via the adapter) — not JWT.
- **Bidirectional account-linking on verified email** (see §5).
- Login + logout UI: a `/login` page (Google button + email input) and an **OTP entry page**.
- The **`User` model = 正身**, extended with app-owned profile columns (`displayName`, `avatarUrl`,
  `bio`, `createdAt`) — see §4. One Prisma migration.
- Env + config: Google Cloud OAuth client, Resend wiring, `AUTH_SECRET`, etc. (see §9).
- Tests: unit + integration for the convergence cases and OTP lockout (see §10).

New users land **logged in immediately** with a seeded-or-blank profile. No forced onboarding.

### Out of scope — **[DEFERRED]** to later feature work
- The rich **建立正身** page (avatar upload, bio editor) and any **forced onboarding gate**.
  New users simply have an editable, possibly-blank profile.
- **分身 binding** and everything in §6.2+ of the main spec.
- **Cross-email manual linking** — a logged-in "connect Google / connect email" settings flow that
  merges two *different* verified emails into one 正身. This milestone links **same-email-only**
  (§5). Cross-email merge belongs with the future account-settings feature; it is unsafe to do at
  the login screen (see §5) and is recorded here so it isn't forgotten.
- Route protection / middleware beyond exposing `auth` (kept minimal; real gating arrives with the
  features that need it).

## 3. Components & file shape

Following the flat modular-monolith layout (`app/` + `lib/*` + `prisma/` at root):

- **`lib/auth/`** — Auth.js core.
  - `index.ts` — the `NextAuth({...})` call, exporting `auth`, `handlers`, `signIn`, `signOut`.
  - `providers.ts` — Google + the email provider config.
  - `callbacks.ts` — the `signIn` hardening callback (reject unverified email) and `session`
    callback (expose `displayName`/`avatarUrl` on the session if useful).
  - `events.ts` (or an adapter `createUser` wrapper) — profile **seeding** on first login.
- **`app/api/auth/[...nextauth]/route.ts`** — the Auth.js route handler (`export { GET, POST } = handlers`).
- **`lib/email/`** — Resend client + the combined link+OTP verification email template.
- **`lib/otp/`** — the thin OTP side: the OTP-entry page handler that forwards `email + code` to the
  native Auth.js callback, plus the attempt-lockout guard (§6). No custom session minting.
- **`app/(auth)/login/`** — the login page (Google button + email input).
- **`app/(auth)/otp/`** (or `/login/otp`) — the OTP entry page (email + 6-digit code).
- **`lib/db/`** — already exists (Prisma client singleton); the adapter and the login-attempt
  counter (§4) plug into it.
- **`middleware.ts`** — optional, minimal; only to surface `auth` for future route protection.

## 4. Data model

The Auth.js Prisma adapter creates **`Account`**, **`Session`**, **`VerificationToken`** as standard.
**`User` is the 正身**, extended with app-owned profile fields. **[DECIDED]** "explicit profile
fields, seeded."

```prisma
model User {
  // Auth.js-managed
  id            String    @id @default(cuid())
  email         String?   @unique          // normalized lowercase/trim at the boundary (§5)
  emailVerified DateTime?
  name          String?                     // from OAuth profile (Google)
  image         String?                     // from OAuth profile (Google)

  // app-owned 正身 profile (§8 of main spec)
  displayName   String?                     // seeded ← name on first Google login; else null
  avatarUrl     String?                     // seeded ← image on first Google login; else null
  bio           String?
  createdAt     DateTime  @default(now())

  accounts      Account[]
  sessions      Session[]
  // §8 relations (linked_accounts, binding_events, …) arrive with later feature work
}
```

- **`Account`** — one row per linked login method (a Google `Account`, and/or the email method).
  This is the join that makes "two ways in, one 正身" concrete.
- **`Session`** — DB sessions live here (chosen for **server-side revocation**, which matters
  directly for the §6.8 hacked-account flows).
- **`VerificationToken`** — Auth.js's native store for the **email login code**. We make the token a
  **6-digit code** (via `generateVerificationToken`), and it backs **both** the magic link and the
  OTP (single shared token — see §6). This supersedes the role §8 imagined for a separate
  `email_tokens` table; reconcile §8 when feature work lands.
- **Login-attempt counter** (small custom store — a tiny table or KV) — `VerificationToken` has no
  attempts column, so lockout (§6) needs a lightweight per-email failed-attempt counter
  (`identifier`, `count`, `window_start`). Kept minimal and portable; a DB table is fine for MVP.

**Seeding:** on first login via Google, copy `name → displayName` and `image → avatarUrl` if
present, as **editable defaults**. Email-signup users start `NULL` and fill them in later (deferred
建立正身 page). Seeding runs once at user creation (adapter `createUser` / a `createUser` event),
**not** on every login, so later edits are never clobbered by a re-login.

## 5. Account linking — same-email convergence

**[DECIDED]** auto-link on verified email, bidirectional, **same-email-only** for MVP.

### The rule
Linking is decided by **matching verified email**, *not* by "is it a Gmail address." A Google
account's email need not be `@gmail.com` (Google accounts exist on `@outlook.com`, company domains,
etc.), so a non-Gmail email-signup that later signs in with a Google account **carrying that same
email** merges correctly.

- **Google email == existing login email** → ✅ auto-link / log into the same 正身, in either order
  (Google-first-then-email, or email-first-then-Google).
- **Google email ≠ existing login email** → ❌ **not** merged in this MVP; would create a second
  正身. Merging two *different* verified emails requires the **[DEFERRED]** logged-in manual-link
  flow (you must be authenticated as account A and then prove control of B — impossible safely at
  the login screen, because neither inbox proves control of the other).

### Why same-email auto-link is secure here
Auth.js flags cross-provider email linking as "dangerous" because of one attack: an attacker
pre-registers a User row carrying the victim's email via *an OAuth provider that returns an
unverified email*, then the victim signs in and gets linked into the attacker's account. **That
attack cannot occur in this config, in either direction, because every path to a User-with-email-X
already proves control of X:**
- **Google** always returns `email_verified: true`; nobody gets a Google token for an email they
  don't control (Google owns that namespace).
- **Magic-link / OTP** requires *receiving* mail at the address — intrinsic proof.

So the second method only succeeds if its user also controls the same verified inbox. Linking never
hands an account to someone who hasn't proven email ownership.

### Hardening (requirements, not options)
1. **`signIn` callback** rejects Google sign-in if `profile.email_verified !== true` (belt-and-
   suspenders; Google always sets it, we don't *assume* it).
2. **Email normalization** (lowercase + trim) applied consistently at the adapter boundary, so
   `Foo@x.com` and `foo@x.com` are one 正身.
3. **`allowDangerousEmailAccountLinking: true`** on the Google provider (and on the email provider
   too if the Auth.js version gates it there — both methods prove ownership, so it's appropriate on
   both).
4. **DB sessions** so a compromised session can be revoked server-side.

### Accepted non-security caveat
Gmail treats `a@gmail.com`, `a+x@gmail.com`, and `a.b@gmail.com` as one inbox, but Auth.js matches
the literal string. A user who mixes a plus-alias and the canonical address could end up with two
正身. **Accepted for MVP** (exact-string match) rather than building Gmail-canonicalization. Not a
vulnerability — just a possible duplicate.

## 6. Email login — single shared 6-digit code (magic-link + OTP)

**[DECIDED]** one shared token. The email login code is a **single 6-digit value** that backs **both**
ways in. **[DECIDED]** the email shows **code + link**.

- We customize the email provider's **`generateVerificationToken`** to return a **6-digit code**
  (instead of the default long random string). Auth.js stores it (hashed) in `VerificationToken`.
- The email (sent via Resend, customized `sendVerificationRequest`) shows **both**: the **6-digit
  code** to type, and a **magic link** that carries that same code.
- **Click or type, same token:** both paths complete through Auth.js's **native
  `/api/auth/callback/<email-provider>` flow** — clicking the link hits it directly; the OTP-entry
  page forwards `email + code` to the same callback. Auth.js then **creates the DB session and applies
  §5 account-linking for us**. Single-use: the token is consumed on first success.

### Why this is the simple path (no custom session plumbing)
Because the 6-digit code **is** the native `VerificationToken`, both entry methods ride Auth.js's own
email callback, which natively yields a **DB session** through the adapter. So there is **no
Credentials provider** (which would force JWT), **no custom session minting**, and **no separate OTP
store** to reconcile. The OTP page is a thin wrapper that posts `email + code` to the native callback.

### Guards (requirements — non-negotiable for a 6-digit token)
A 6-digit code is low entropy (10⁶), and it backs the link too, so both guards are mandatory:
- **Short expiry** (~10 min) + **single-use** (native `VerificationToken` semantics).
- **Per-email attempt lockout** — track failed verifications and invalidate after ~5 wrong tries,
  using the small login-attempt counter from §4 (the native callback doesn't count attempts on its
  own). Without this, 10⁶ is brute-forceable for a known email. Implementing the lockout around the
  native callback (middleware/route guard keyed by email + IP) is the **one** item the plan must
  detail.

## 7. Auth flows (summary)

- **Google:** standard OAuth → `signIn` callback checks `email_verified` → adapter resolves/creates
  the 正身 by verified email (`allowDangerousEmailAccountLinking`) → profile seeded on creation → DB
  session.
- **Email (one request, one 6-digit code):** request → `generateVerificationToken` mints a 6-digit
  code stored (hashed) in `VerificationToken` → one Resend email shows the **code + a link carrying
  it**. Then either:
  - **click the link** → native Auth.js callback, or
  - **type the code** on the OTP page → forwarded to the **same** native callback (with lockout).

  Either path → adapter resolves/creates 正身 by email → DB session. Single-use.
- **Convergence:** all four entry cases (Google-new, email-new, Google-then-email, email-then-Google)
  land on **one 正身** when the verified emails match (§5).

## 8. Build order

**[DECIDED]** Google OAuth first — fewest dependencies (just a Google Cloud OAuth client; no DNS or
mail), fastest path to a real logged-in DB session, and it stands up the shared Auth.js core +
Prisma adapter schema that the email provider then reuses. Email (link + OTP) second.

## 9. Config / env

New env vars — set in **Vercel (Prod/Preview/Dev)** and **local `.env`**, **none committed**;
`.env.example` updated with placeholders:

- `AUTH_SECRET` — `openssl rand -hex 32`.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from the Google Cloud OAuth client.
- `RESEND_API_KEY` — already obtained (2026-06-15); just needs wiring into envs.
- `AUTH_EMAIL_FROM` — a from-address on `send.guasi.tw` (e.g. `login@send.guasi.tw`).
- `AUTH_URL` / `NEXTAUTH_URL` as needed per environment (preview URLs included).

**Google Cloud OAuth client:** create with redirect URIs for production
(`https://guasi.tw/api/auth/callback/google`), preview deploys, and `localhost`. (Preview URLs are
dynamic on Vercel — confirm the redirect-URI strategy for previews in the plan; may need a stable
preview alias or `AUTH_REDIRECT_PROXY_URL`.)

## 10. Testing

- **Unit:** email normalization; profile-seeding logic; the `signIn` callback rejecting
  unverified-email Google sign-in; OTP generation + hashing + lockout counter.
- **Integration:** the four convergence cases →
  1. Google-new creates a 正身 with seeded profile.
  2. Email-new creates a 正身 with blank profile.
  3. Google-then-email (same email) → same single 正身.
  4. Email-then-Google (same email) → same single 正身.
  Plus: OTP wrong-code lockout; expired token/code rejected; cross-email Google does **not** merge
  (creates a separate account — documents the MVP boundary).
- **Manual smoke** on a preview deploy: a real Google login + a real Resend email (click the link
  *and*, separately, type the OTP).

## 11. Open items for the implementation plan

- **Lockout around the native callback (§6)** — where to enforce per-email/IP attempt limits given
  Auth.js's native callback doesn't count attempts (middleware vs route guard; store choice for the
  counter).
- Preview-deploy Google redirect-URI strategy (§9).
- Whether the email provider also needs `allowDangerousEmailAccountLinking` in the pinned Auth.js
  version (§5).
- Confirm a 6-digit `generateVerificationToken` + custom `sendVerificationRequest` (code + link)
  works cleanly with the pinned Auth.js email/Resend provider, including the OTP page forwarding to
  the native callback.
- Logout UX + where the session/`auth()` helper is consumed in the app shell.
