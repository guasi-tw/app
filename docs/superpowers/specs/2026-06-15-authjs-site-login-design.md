# Auth.js Site Login — Google OAuth + Email (Magic-link + OTP)

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
- **Email** provider: magic-link + 6-digit OTP (see §6 for the dual-token model).
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
- **`lib/otp/`** — OTP issue/verify logic (generate code, store in `email_tokens`, attempt-lockout,
  complete login). This is the custom side that reconciles OTP with DB sessions (§6).
- **`app/(auth)/login/`** — the login page (Google button + email input).
- **`app/(auth)/otp/`** (or `/login/otp`) — the OTP entry page (email + 6-digit code).
- **`lib/db/`** — already exists (Prisma client singleton); the adapter and `email_tokens` access
  plug into it.
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
- **`VerificationToken`** — Auth.js's native store for the **high-entropy magic-link token**.
- **`email_tokens`** (custom, anticipated by §8) — the **OTP** side. Shape:
  `id`, `email`, `code` (6-digit, stored hashed), `expires_at`, `consumed_at`, **`attempts`**
  (new — for lockout, §6). Optionally `user_id?` per §8. Keyed by email; one active row per login
  request.

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

## 6. Email login — dual-token model (magic-link + OTP)

**[DECIDED]** dual token. One email, two independent ways in, each with its own credential.

- **Magic link** — Auth.js's **native high-entropy** `VerificationToken`. Cryptographically strong;
  unchanged from the framework default.
- **OTP** — a **separate 6-digit code** for the **same login intent**, stored in `email_tokens`
  (hashed), rate-limited.

The single email shows both: a clickable link (carrying the high-entropy token) **and** the 6-digit
code to type on the OTP page.

### OTP guards (requirements)
- **Short expiry** (~10 min) + **single-use** (`consumed_at`).
- **Per-email attempt lockout** — invalidate the code after ~5 wrong attempts (the `attempts`
  counter on `email_tokens`). Without this, 10⁶ is brute-forceable for a known email.

### The integration subtlety (the main thing the plan must nail down)
Auth.js's **Credentials provider forces JWT sessions**, which conflicts with our **DB-session**
choice. Therefore the OTP **cannot** be implemented as a Credentials provider. The intended approach:

> The OTP page **verifies the code (with lockout) and then completes the *same* email login intent
> through the adapter** — establishing a normal DB session and applying the same auto-linking — rather
> than being a parallel auth path. The magic link uses `VerificationToken`; the OTP uses
> `email_tokens`; both converge on one adapter-backed login + DB session, so linking and session
> semantics are uniform regardless of which way the user came in.

Exact mechanics (how the OTP server action establishes an Auth.js DB session — e.g. a custom
verification route that calls the adapter's `createSession`, or driving the email-callback flow
server-side) are an **implementation-plan decision**, not settled here. The constraint is fixed: **no
JWT, no Credentials provider; OTP must yield a DB session and honor §5 linking.**

## 7. Auth flows (summary)

- **Google:** standard OAuth → `signIn` callback checks `email_verified` → adapter resolves/creates
  the 正身 by verified email (`allowDangerousEmailAccountLinking`) → profile seeded on creation → DB
  session.
- **Email — magic link:** request → high-entropy `VerificationToken` issued + emailed → click →
  Auth.js callback → adapter resolves/creates 正身 by email → DB session.
- **Email — OTP:** request → 6-digit code issued into `email_tokens` + emailed (same email as the
  link) → user types email + code on the OTP page → verify with lockout → complete the same email
  login intent → DB session (§6).
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

- Exact OTP→DB-session mechanism (§6) — how the OTP server action mints an Auth.js DB session.
- Preview-deploy Google redirect-URI strategy (§9).
- Whether the email provider also needs `allowDangerousEmailAccountLinking` in the pinned Auth.js
  version (§5).
- Final shape of `email_tokens` vs reuse of `VerificationToken` for the OTP side.
- Logout UX + where the session/`auth()` helper is consumed in the app shell.
